import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, ActivityIndicator, Animated, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { useColors } from '../hooks/useColors';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface GlobeViewProps {
  onCountrySelect: (countryData: { name: string; iso_a2: string }) => void;
  unlockedCountries?: string[];
}

export interface GlobeViewRef {
  flyToCountry: (query: string) => void;
  setAutoRotate: (shouldRotate: boolean) => void;
}

const GlobeView = forwardRef<GlobeViewRef, GlobeViewProps>(({ onCountrySelect, unlockedCountries = [] }, ref) => {
  const colors = useColors();
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useImperativeHandle(ref, () => ({
    flyToCountry: (query: string) => {
      if (webViewRef.current && !isLoading) {
        const payload = { type: 'selectCountry', query };
        webViewRef.current.injectJavaScript(`window.postMessage(${JSON.stringify(JSON.stringify(payload))}, '*'); true;`);
      }
    },
    setAutoRotate: (shouldRotate: boolean) => {
      if (webViewRef.current && !isLoading) {
        const payload = { type: 'setAutoRotate', shouldRotate };
        webViewRef.current.injectJavaScript(`window.postMessage(${JSON.stringify(JSON.stringify(payload))}, '*'); true;`);
      }
    }
  }));

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>
        * {
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
          user-select: none;
          outline: none;
        }
        body { margin: 0; padding: 0; background-color: transparent; overflow: hidden; }
        #globeViz { width: 100vw; height: 100vh; }
      </style>
      <script src="https://unpkg.com/three"></script>
      <script src="https://unpkg.com/globe.gl"></script>
      <script src="https://unpkg.com/d3-array"></script>
      <script src="https://unpkg.com/d3-geo"></script>
    </head>
    <body>
      <div id="globeViz"></div>
      <script>
        let world;
        let selectedD = null;
        let isDarkMode = true;
        let unlockedCountriesList = [];

        const THEMES = {
          dark: {
            bg: '#000000',
            bgImage: 'https://unpkg.com/three-globe/example/img/night-sky.png',
            globeImage: 'https://unpkg.com/three-globe/example/img/earth-dark.jpg',
            atmosphere: '#A855F7',
            polyCap: 'rgba(20, 20, 30, 0.8)',
            polySide: 'rgba(168, 85, 247, 0.2)',
            polyStroke: '#A855F7',
            polyHover: 'rgba(168, 85, 247, 0.9)',
            polySelected: '#A855F7'
          },
          light: {
            bg: '#000000',
            bgImage: 'https://unpkg.com/three-globe/example/img/night-sky.png',
            globeImage: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
            atmosphere: 'rgba(139,92,246,0.5)',
            polyCap: 'rgba(255, 255, 255, 0)',
            polySide: 'rgba(255, 255, 255, 0)',
            polyStroke: 'rgba(139, 92, 246, 0.4)',
            polyHover: 'rgba(139, 92, 246, 0.3)',
            polySelected: 'rgba(139, 92, 246, 0.6)'
          }
        };

        function applyTheme(isDark) {
          isDarkMode = isDark;
          const t = isDark ? THEMES.dark : THEMES.light;
          
          if (world) {
            world.backgroundColor(t.bg)
                 .backgroundImageUrl(t.bgImage)
                 .globeImageUrl(t.globeImage)
                 .atmosphereColor(t.atmosphere)
                 .polygonSideColor(() => t.polySide)
                 .polygonStrokeColor(() => t.polyStroke);
            
            const mat = world.globeMaterial();
            if (mat && mat.color) {
               mat.color.set('#ffffff'); 
            }
            
            updatePolygons();
          }
        }

        // ONE unified styling function for the globe
        function updatePolygons(hoverD = null) {
           const t = isDarkMode ? THEMES.dark : THEMES.light;
           world.polygonCapColor(d => {
             if (d === selectedD) return t.polySelected;
             if (hoverD && d === hoverD) return t.polyHover;
             
             const name = (d.properties.NAME || '').toLowerCase();
             const admin = (d.properties.ADMIN || '').toLowerCase();
             const isUnlocked = unlockedCountriesList.includes(name) || unlockedCountriesList.includes(admin);
             
             if (isUnlocked) return '#10b981'; // Green for unlocked countries
             return t.polyCap;
           })
           .polygonAltitude(d => {
             if (d === selectedD) return 0.06;
             if (hoverD && d === hoverD) return 0.04;
             
             const name = (d.properties.NAME || '').toLowerCase();
             const admin = (d.properties.ADMIN || '').toLowerCase();
             const isUnlocked = unlockedCountriesList.includes(name) || unlockedCountriesList.includes(admin);

             if (isUnlocked) return 0.025; // Slightly raised
             return 0.01;
           });
        }

        function initGlobe() {
          const globeDiv = document.getElementById('globeViz');
          world = Globe()(globeDiv)
            .showAtmosphere(true)
            .atmosphereAltitude(0.15)
            .onPolygonHover(hoverD => {
               // Simply pass the hovered polygon to our central function
               updatePolygons(hoverD);
            })
            .onPolygonClick(d => {
              selectedD = d;
              updatePolygons(null); // Clear hover state on click

              try {
                const [lng, lat] = d3.geoCentroid(d);
                world.pointOfView({ lat, lng, altitude: 1.8 }, 900);
              } catch(e) {
                console.warn('Centroid calculation failed', e);
              }

              if (window.ReactNativeWebView && d && d.properties) {
                const payload = {
                  type: 'countrySelect',
                  name: d.properties.NAME || d.properties.ADMIN,
                  iso_a2: d.properties.ISO_A2
                };
                window.ReactNativeWebView.postMessage(JSON.stringify(payload));
              }
            });

          fetch('https://unpkg.com/globe.gl/example/datasets/ne_110m_admin_0_countries.geojson')
            .then(res => res.json())
            .then(countries => {
              world.polygonsData(countries.features);
              world.controls().autoRotate = true;
              world.controls().autoRotateSpeed = 0.5;
            })
            .catch(err => console.error("Error loading GeoJSON", err));
            
          applyTheme(true);
        }

        initGlobe();

        window.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!world) return;
            
            if (data.type === 'updateTheme') {
              applyTheme(data.isDark);
            } 
            else if (data.type === 'updateGlobeState') {
              if (data.unlockedCountries) {
                unlockedCountriesList = data.unlockedCountries;
              }
              applyTheme(data.isDark);
            }
            else if (data.type === 'zoomIn') {
              const currentPov = world.pointOfView();
              world.pointOfView({ altitude: Math.max(0.1, currentPov.altitude * 0.7) }, 400);
            } 
            else if (data.type === 'zoomOut') {
              const currentPov = world.pointOfView();
              world.pointOfView({ altitude: Math.min(4, currentPov.altitude * 1.4) }, 400);
            }
            else if (data.type === 'setAutoRotate') {
              if (world) {
                world.controls().autoRotate = data.shouldRotate;
              }
            }
            else if (data.type === 'selectCountry') {
              if (!world || !world.polygonsData()) return;
              
              const query = (data.query || '').toLowerCase();
              const d = world.polygonsData().find(p => {
                 const name = (p.properties.NAME || '').toLowerCase();
                 const admin = (p.properties.ADMIN || '').toLowerCase();
                 const iso = (p.properties.ISO_A2 || '').toLowerCase();
                 return name === query || admin === query || iso === query || name.includes(query) || admin.includes(query);
              });

              if (d) {
                selectedD = d;
                updatePolygons(null); // Ensure hover state is cleared

                try {
                  const [lng, lat] = d3.geoCentroid(d);
                  world.pointOfView({ lat, lng, altitude: 1.8 }, 900);
                } catch(e) {}

                if (window.ReactNativeWebView) {
                  const payload = {
                    type: 'countrySelect',
                    name: d.properties.NAME || d.properties.ADMIN,
                    iso_a2: d.properties.ISO_A2
                  };
                  window.ReactNativeWebView.postMessage(JSON.stringify(payload));
                }
              }
            }
          } catch(e) {}
        });
      </script>
    </body>
    </html>
  `;

  useEffect(() => {
    if (webViewRef.current && !isLoading) {
      const payload = { type: 'updateGlobeState', isDark: colors.isDark, unlockedCountries: unlockedCountries.map(c => c.toLowerCase()) };
      webViewRef.current.injectJavaScript(`window.postMessage(${JSON.stringify(JSON.stringify(payload))}, '*'); true;`);
    }
  }, [colors.isDark, isLoading, unlockedCountries]);

  const handleZoom = (direction: 'in' | 'out') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (webViewRef.current && !isLoading) {
      const payload = { type: direction === 'in' ? 'zoomIn' : 'zoomOut' };
      webViewRef.current.injectJavaScript(`window.postMessage(${JSON.stringify(JSON.stringify(payload))}, '*'); true;`);
    }
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'countrySelect') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onCountrySelect({ name: data.name, iso_a2: data.iso_a2 });
      }
    } catch (e) {
      console.warn('Failed to parse message from WebView', e);
    }
  };

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
      <Animated.View style={[styles.webViewContainer, { opacity: fadeAnim }]}>
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          onLoadEnd={handleLoadEnd}
          onMessage={handleMessage}
          style={styles.webView}
          scrollEnabled={false}
          bounces={false}
          originWhitelist={['*']}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />

        {/* ─── Zoom Controls Overlay ─── */}
        {/* {!isLoading && (
          <View style={styles.zoomControls}>
            <TouchableOpacity 
              style={[styles.zoomBtn, { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }]} 
              activeOpacity={0.7} 
              onPress={() => handleZoom('in')}
            >
              <Feather name="plus" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.zoomBtn, { backgroundColor: colors.card }]} 
              activeOpacity={0.7} 
              onPress={() => handleZoom('out')}
            >
              <Feather name="minus" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        )} */}
      </Animated.View>
    </View>
  );
});

export default GlobeView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  webViewContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  zoomControls: {
    position: 'absolute',
    right: 20,
    bottom: '15%', // Place it comfortably above the bottom navigation tabs
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  zoomBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
