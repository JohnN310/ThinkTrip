import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Modal, Animated, Keyboard, Dimensions, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useColors } from '../../hooks/useColors';
import { useProfile } from '../../contexts/ProfileContext';
import { Destination } from '../../lib/destinations';
import { buildPackingList, Category } from '../../lib/packingList';
import { Card } from '../../components/Card';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DolphinMascot } from '../../components/DolphinMascot';
import GlobeView, { GlobeViewRef } from '../../components/GlobeView';
import CountrySelectModal from '../../components/CountrySelectModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const getAqiLabel = (aqiIndex: number) => {
  if (!aqiIndex) return 'Unknown';
  const labels = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
  return labels[aqiIndex - 1] || 'Unknown';
};

const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_WEATHER_KEY;
const POPULAR_CITIES = ['Tokyo, JP', 'London, England, GB', 'New York, US', 'Paris, Ile-de-France, FR', 'Bangkok, TH', 'Dubai, AE', 'Seoul, KR', 'Marrakesh, MA'];

export interface GeocodeSuggestion {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

export default function PlanScreen() {

  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, toggleSavedLocation, hydrated } = useProfile();

  const [liveWeather, setLiveWeather] = useState<any>(null);
  const [trueLiveWeather, setTrueLiveWeather] = useState<any>(null);
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);

  // --- Welcome Guide Scroll State ---
  const welcomeScrollRef = useRef<ScrollView>(null);
  const [welcomeScrollHeight, setWelcomeScrollHeight] = useState(0);
  const [welcomeContentHeight, setWelcomeContentHeight] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const isWelcomeScrollable = welcomeContentHeight > welcomeScrollHeight;

  const handleWelcomeScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 20) {
      setIsAtBottom(true);
    } else {
      setIsAtBottom(false);
    }
  };

  useEffect(() => {
    if (isWelcomeScrollable) setIsAtBottom(false);
    else setIsAtBottom(true);
  }, [isWelcomeScrollable]);

  const [guideReady, setGuideReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGuideReady(true), 1000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hydrated || !guideReady) return;
    AsyncStorage.getItem('@thinktrip_plan_guide_seen').then(val => {
      if (!val) setShowWelcomeGuide(true);
    });
  }, [hydrated, guideReady]);

  const dismissWelcomeGuide = async () => {
    await AsyncStorage.setItem('@thinktrip_plan_guide_seen', 'true');
    setShowWelcomeGuide(false);
  };

  const [forecast, setForecast] = useState<any[]>([]);
  const [showForecastSheet, setShowForecastSheet] = useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(-1);
  const savedLocations: string[] = profile.savedLocations || [];

  const [hasSetInitialCity, setHasSetInitialCity] = useState(false);
  const [selectedPackingItem, setSelectedPackingItem] = useState<any>(null);
  const [showPackingSheet, setShowPackingSheet] = useState(false);
  const packingFadeAnim = useRef(new Animated.Value(0)).current;
  const packingSlideAnim = useRef(new Animated.Value(800)).current;

  // Globe State
  const globeRef = useRef<GlobeViewRef>(null);
  const [selectedGlobeCountry, setSelectedGlobeCountry] = useState<any>(null);
  const [showGlobeModal, setShowGlobeModal] = useState(false);

  const handleGlobeCountrySelect = (countryData: any) => {
    setSelectedGlobeCountry(countryData);
    setShowGlobeModal(true);
  };

  const handleGlobeDestinationSet = (cityName: string) => {
    setShowGlobeModal(false);
    
    // 1. Update the destination state directly with the selected name
    // This avoids the network request currently required by loadDestinationData
    setDestination(prev => ({
      ...prev,
      key: cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: cityName,
      // You can preserve or reset climate data here depending on your preference
      climate: { tempLow: 0, tempHigh: 0, humidity: 0 }, 
    }));

    // 2. Perform navigation/UI updates
    addRecentSearch(cityName);
    setSelectedChip(cityName);
    setSelectedDayIndex(-1);
    setSelectedPointIndex(0);
    
    // Optional: If you want to fetch weather later, you could trigger 
    // a non-blocking fetch here, but the navigation is now instant.
  };

  const openPackingSheet = (item: any) => {
    setSelectedPackingItem(item);
    setShowPackingSheet(true);
    Animated.parallel([
      Animated.timing(packingFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(packingSlideAnim, { toValue: 0, damping: 24, stiffness: 200, useNativeDriver: true })
    ]).start();
  };

  const closePackingSheet = () => {
    Animated.parallel([
      Animated.timing(packingFadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(packingSlideAnim, { toValue: 800, duration: 250, useNativeDriver: true })
    ]).start(() => {
      setShowPackingSheet(false);
      setSelectedPackingItem(null);
    });
  };

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(800)).current;

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 800, duration: 250, useNativeDriver: true })
    ]).start(() => setShowForecastSheet(false));
  };

  const [destination, setDestination] = useState<Destination>({
    key: 'new-york',
    name: 'New York',
    region: '—',
    climate: { tempLow: 0, tempHigh: 0, humidity: 0 },
    alerts: [],
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedChip, setSelectedChip] = useState('New York');
  const [initialLoadFailed, setInitialLoadFailed] = useState(false);
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQueryRef = useRef('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const loadRecents = async () => {
      try {
        const stored = await AsyncStorage.getItem('@thinktrip_recent_searches');
        if (stored) setRecentSearches(JSON.parse(stored));
      } catch (e) {
        console.warn("Failed to load recent searches", e);
      }
    };
    loadRecents();
  }, [hydrated]);

  const addRecentSearch = (cityName: string) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(c => c.toLowerCase() !== cityName.toLowerCase());
      const updated = [cityName, ...filtered].slice(0, 5);
      AsyncStorage.setItem('@thinktrip_recent_searches', JSON.stringify(updated)).catch(e => console.warn(e));
      return updated;
    });
  };

  const loadDestinationData = async (locationQuery: string | GeocodeSuggestion) => {
    try {
      const unitQuery = profile.units === 'imperial' ? 'imperial' : 'metric';
      let weatherUrl = '';
      let targetName = '';
      let foundGeoData: any = null;

      if (typeof locationQuery === 'string') {
        let lookupLat: number | null = null;
        let lookupLon: number | null = null;

        try {
          const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(locationQuery)}&limit=5&appid=${OPENWEATHER_API_KEY}`);
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData && geoData.length > 0) {
              lookupLat = geoData[0].lat;
              lookupLon = geoData[0].lon;
              foundGeoData = geoData[0];
            }
          }
        } catch (e) {
          console.warn("Geocode pre-lookup failed");
        }

        if (lookupLat !== null && lookupLon !== null) {
          weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lookupLat}&lon=${lookupLon}&units=${unitQuery}&appid=${OPENWEATHER_API_KEY}`;
        } else {
          weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(locationQuery)}&units=${unitQuery}&appid=${OPENWEATHER_API_KEY}`;
        }
        targetName = locationQuery;
      } else {
        weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${locationQuery.lat}&lon=${locationQuery.lon}&units=${unitQuery}&appid=${OPENWEATHER_API_KEY}`;
        const statePart = locationQuery.state && locationQuery.state !== locationQuery.name ? `, ${locationQuery.state}` : '';
        targetName = `${locationQuery.name}${statePart}, ${locationQuery.country}`;
      }

      const weatherRes = await fetch(weatherUrl);
      const weatherData = await weatherRes.json();
      if (!weatherRes.ok || !weatherData.coord) throw new Error('City not found');

      setInitialLoadFailed(false);
      let finalName = targetName;
      if (typeof locationQuery === 'string') {
        if (foundGeoData) {
          const statePart = foundGeoData.state && foundGeoData.state !== foundGeoData.name ? `, ${foundGeoData.state}` : '';
          finalName = `${foundGeoData.name}${statePart}, ${foundGeoData.country}`;
        } else {
          finalName = `${weatherData.name}, ${weatherData.sys.country}`;
        }
      }

      const formatDescription = (desc: string) => desc.replace(/\b\w/g, c => c.toUpperCase());
      let currentIcon = '01d';
      let currentDesc = 'Clear Sky';

      if (weatherData.weather && weatherData.weather.length > 0) {
        currentIcon = weatherData.weather[0].icon;
        currentDesc = formatDescription(weatherData.weather[0].description);
      }

      const liveWeatherData = {
        temp: Math.round(weatherData.main.temp),
        tempLow: Math.round(weatherData.main.temp_min),
        tempHigh: Math.round(weatherData.main.temp_max),
        humidity: weatherData.main.humidity,
        aqiLabel: 'Good',
        iconCode: currentIcon,
        displayCondition: currentDesc,
      };

      setLiveWeather(liveWeatherData);
      setTrueLiveWeather(liveWeatherData);
      setDestination({
        key: finalName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: finalName,
        region: weatherData.sys.country,
        climate: {
          tempLow: liveWeatherData.tempLow,
          tempHigh: liveWeatherData.tempHigh,
          humidity: liveWeatherData.humidity,
        },
        alerts: [],
      });
      return finalName;
    } catch (err) {
      console.warn('Load destination data failed:', err);
      throw err;
    }
  };

  useEffect(() => {
    if (!hydrated) {
      setHasSetInitialCity(false);
      setSelectedDayIndex(-1);
      return;
    }
    if (hydrated && !hasSetInitialCity) {
      setHasSetInitialCity(true);
      const defaultCity = savedLocations.length > 0 ? savedLocations[0] : 'New York, US';
      setSelectedChip(defaultCity);
      setDestination(prev => ({
        ...prev,
        key: defaultCity.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: defaultCity
      }));
      loadDestinationData(defaultCity).catch(err => {
        setInitialLoadFailed(true);
      });
    }
  }, [hydrated, hasSetInitialCity, savedLocations]);

  useEffect(() => {
    if (!hasSetInitialCity) return;
    loadDestinationData(destination.name).catch((error) => console.error(error));
  }, [profile.units]);

  // State to track if the search is open
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Animation value for the width expansion
  const searchAnim = useRef(new Animated.Value(0)).current;

  const toggleSearch = () => {
    if (Platform.OS !== 'web' && profile.hapticsEnabled) Haptics.selectionAsync();

    if (isSearchActive) {
      // Dismiss keyboard and collapse
      Keyboard.dismiss();
      Animated.spring(searchAnim, {
        toValue: 0,
        useNativeDriver: false, // width animations require false
        friction: 9,
        tension: 60,
      }).start(() => setIsSearchActive(false));
    } else {
      // Expand and show input
      setIsSearchActive(true);
      Animated.spring(searchAnim, {
        toValue: 1,
        useNativeDriver: false,
        friction: 9,
        tension: 60,
      }).start();
    }
  };

  // Fetch Autocomplete Suggestions
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setIsFetchingSuggestions(false);
      return;
    }

    // Clear previous timeout to debounce typing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(async () => {
      setIsFetchingSuggestions(true);
      try {
        const res = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(searchQuery)}`);
        
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const mapped = data.map((c: any) => ({
              name: c.name.common,
              state: c.subregion || '',
              country: c.region || '',
              lat: c.latlng?.[0] || 0,
              lon: c.latlng?.[1] || 0,
            })).slice(0, 5);
            setSuggestions(mapped);
          } else {
            setSuggestions([]);
          }
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.warn("Failed to fetch suggestions", error);
      } finally {
        setIsFetchingSuggestions(false);
      }
    }, 400); // 400ms delay for premium typing feel

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [searchQuery]);

  // Interpolate the animation value into actual pixel widths
  const searchBarWidth = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [48, SCREEN_WIDTH - 40], // From circle to screen width minus margins
  });

  // Delay the text fade-in slightly so it doesn't clip outside the pill while expanding
  const searchInputOpacity = searchAnim.interpolate({
    inputRange: [0.5, 1], 
    outputRange: [0, 1],
  });

  const searchCity = (locationQuery: string | GeocodeSuggestion, fromChip = false) => {
    const queryStr = typeof locationQuery === 'string'
      ? locationQuery
      : `${locationQuery.name}${locationQuery.state && locationQuery.state !== locationQuery.name ? `, ${locationQuery.state}` : ''}, ${locationQuery.country}`;

    if (!queryStr.trim()) return;

    if (Platform.OS !== 'web' && profile.hapticsEnabled) Haptics.selectionAsync();

    // Act as navigation/selection trigger
    let searchTarget = typeof locationQuery === 'string' ? locationQuery : locationQuery.name;
    // If the recent search or query contains a comma (e.g. "Vietnam, VN"), extract just the country name for the globe matcher
    if (typeof searchTarget === 'string' && searchTarget.includes(',')) {
      searchTarget = searchTarget.split(',')[0].trim();
    }

    globeRef.current?.flyToCountry(searchTarget);

    addRecentSearch(queryStr);
    setSearchQuery('');
    setSuggestions([]);
    setIsSearchFocused(false);
  };


  if (!hydrated || !hasSetInitialCity) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ─── 3D Globe Background (FULL SCREEN) ─── */}
      <View style={StyleSheet.absoluteFillObject}>
        <GlobeView ref={globeRef} onCountrySelect={handleGlobeCountrySelect} />
      </View>

      {/* ─── Floating Header Area ─── */}
      <View
        pointerEvents="box-none"
        style={[styles.headerArea, { paddingTop: (insets.top || 20) + 16, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }]}
      >
        <View style={styles.headerRow} pointerEvents="box-none">

          <View style={styles.headerTextCol} pointerEvents="none">
            {/* <Text style={[styles.titleText, { color: colors.foreground }]}>
              World Map
            </Text> */}
            {/* <Text style={[styles.subtitleText, { color: colors.mutedForeground }]}>
              Tap and zoom to explore information,{'\n'}history, and upcoming festivals.
            </Text> */}
          </View>

          <View style={styles.headerActions} pointerEvents="auto">
            <Animated.View style={[styles.searchWrapper, { width: searchBarWidth }]}>
              <BlurView
                intensity={colors.isDark ? 40 : 60}
                tint={colors.isDark ? "dark" : "light"}
                style={styles.searchGlass}
              >
                {/* 1. The Input Field (Rendered first, positioned absolutely so it expands smoothly) */}
                <Animated.View 
                  style={[styles.inputContainer, { opacity: searchInputOpacity }]} 
                  pointerEvents={isSearchActive ? 'auto' : 'none'}
                >
                  <TextInput
                    style={[styles.searchInput, { color: colors.foreground }]}
                    placeholder="Search destinations..."
                    placeholderTextColor={colors.mutedForeground}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={() => {
                      searchCity(searchQuery);
                      toggleSearch(); 
                    }}
                    returnKeyType="search"
                    autoFocus={isSearchActive}
                    autoCorrect={false}
                  />
                </Animated.View>

                {/* 2. The Icon (Rendered second, anchors firmly to the right side) */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.searchIconBox}
                  onPress={toggleSearch}
                >
                  <Feather 
                    name={isSearchActive ? "x" : "search"} 
                    size={20} 
                    color={colors.foreground} 
                  />
                </TouchableOpacity>
              </BlurView>
            </Animated.View>
          </View>

        </View>

        {/* ─── Search Dropdown Menu ─── */}
        <Animated.View
          pointerEvents={isSearchActive ? 'auto' : 'none'}
          style={[
            styles.dropdownContainer,
            { top: (insets.top || 20) + 16 + 48 + 8 },
            {
              opacity: searchAnim,
              transform: [{
                translateY: searchAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0] // Subtle slide down effect
                })
              }]
            }
          ]}
        >
          {isSearchActive && (
            <BlurView
              intensity={colors.isDark ? 40 : 60}
              tint={colors.isDark ? "dark" : "light"}
              style={styles.dropdownGlass}
            >
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                
                {/* STATE 1: Empty Query -> Show Recent Searches */}
                {searchQuery.trim().length === 0 && recentSearches.length > 0 && (
                  <View style={styles.listSection}>
                    <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>RECENT SEARCHES</Text>
                    {recentSearches.map((recentCity, idx) => (
                      <TouchableOpacity 
                        key={`recent-${idx}`} 
                        style={styles.suggestionRow}
                        onPress={() => {
                          searchCity(recentCity);
                          toggleSearch();
                        }}
                      >
                        <View style={styles.iconCircle}>
                          <Feather name="clock" size={14} color={colors.mutedForeground} />
                        </View>
                        <Text style={[styles.suggestionText, { color: colors.foreground }]}>{recentCity}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* STATE 2: Fetching Suggestions */}
                {isFetchingSuggestions && searchQuery.trim().length > 0 && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.foreground} />
                  </View>
                )}

                {/* STATE 3: Display Suggestions */}
                {!isFetchingSuggestions && suggestions.length > 0 && (
                  <View style={styles.listSection}>
                    <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SUGGESTIONS</Text>
                    {suggestions.map((item, idx) => {
                      const locationName = `${item.name}${item.state && item.state !== item.name ? `, ${item.state}` : ''}, ${item.country}`;
                      return (
                        <TouchableOpacity 
                          key={`sugg-${idx}`} 
                          style={styles.suggestionRow}
                          onPress={() => {
                            searchCity(item);
                            toggleSearch();
                          }}
                        >
                          <View style={styles.iconCircle}>
                            <Feather name="map-pin" size={14} color={colors.mutedForeground} />
                          </View>
                          <View style={styles.suggestionTextData}>
                            <Text style={[styles.suggestionText, { color: colors.foreground }]}>{item.name}</Text>
                            <Text style={[styles.suggestionSubtext, { color: colors.mutedForeground }]}>
                              {item.state && item.state !== item.name ? `${item.state}, ` : ''}{item.country}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* STATE 4: No Results */}
                {!isFetchingSuggestions && searchQuery.trim().length > 0 && suggestions.length === 0 && (
                  <View style={styles.loadingContainer}>
                    <Text style={[styles.suggestionSubtext, { color: colors.mutedForeground }]}>No destinations found.</Text>
                  </View>
                )}

              </ScrollView>
            </BlurView>
          )}
        </Animated.View>

      </View>

      {/* ─── Modals ─── */}
      <CountrySelectModal
        visible={showGlobeModal}
        country={selectedGlobeCountry}
        onClose={() => setShowGlobeModal(false)}
        onSelect={handleGlobeDestinationSet}
      />

      <Modal visible={showPackingSheet} transparent animationType="none" onRequestClose={closePackingSheet}>
        <Animated.View style={[styles.sheetBackdrop, { opacity: packingFadeAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closePackingSheet} />
          <Animated.View style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + 20,
              transform: [{ translateY: packingSlideAnim }]
            }
          ]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]} />
            {selectedPackingItem && (
              <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 20, paddingBottom: 20 }}>
                {/* Modal Content */}
              </ScrollView>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Welcome Guide Modal */}
      <Modal visible={showWelcomeGuide} transparent animationType="fade">
        <View style={[styles.modalBackdrop, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <View style={[styles.welcomeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ScrollView
              ref={welcomeScrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 80 }}
              onLayout={(e) => setWelcomeScrollHeight(e.nativeEvent.layout.height)}
              onContentSizeChange={(w, h) => setWelcomeContentHeight(h)}
              onScroll={handleWelcomeScroll}
              scrollEventThrottle={16}
            >
              <View style={[styles.welcomeHero, { backgroundColor: colors.muted }]}>
                <DolphinMascot size={150} />
              </View>
              <View style={styles.welcomeGreetRow}>
                <View style={[styles.welcomeGreetDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.welcomeGreetText, { color: colors.mutedForeground }]}>PLAN & PREPARE</Text>
              </View>
              <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>Hi, let's plan your journey.</Text>
            </ScrollView>
            <TouchableOpacity
              style={[
                styles.welcomeBtnFixed,
                { backgroundColor: (!isWelcomeScrollable || isAtBottom) ? colors.primary : colors.muted }
              ]}
              onPress={() => {
                if (!isWelcomeScrollable || isAtBottom) dismissWelcomeGuide();
                else welcomeScrollRef.current?.scrollToEnd({ animated: true });
              }}
            >
              <Text style={[
                styles.welcomeBtnText,
                { color: (!isWelcomeScrollable || isAtBottom) ? colors.primaryForeground : colors.foreground }
              ]}>
                {(!isWelcomeScrollable || isAtBottom) ? "Let's go" : "Scroll down"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerArea: { paddingHorizontal: 20, paddingBottom: 0 },

  // New Header Layout Styles
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    position: 'relative', // Ensures absolute children align to this container
    width: '100%',
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 16
  },
  titleText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    letterSpacing: -0.5,
    marginBottom: 4
  },
  subtitleText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18
  },
  headerActions: {
    position: 'absolute', // Detaches from flex flow
    right: 0,             // Locks to the right edge
    top: 2,               // Replaces previous marginTop
    flexDirection: 'row',
    zIndex: 10,
  },
  searchWrapper: {
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  searchGlass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end', // Keeps the icon perfectly still on the right
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  searchIconBox: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2, // Keeps icon above input text
  },
  inputContainer: {
    position: 'absolute',
    left: 0,
    right: 48, // Leaves exact room for the icon box so text doesn't overlap
    height: '100%',
    justifyContent: 'center',
    paddingLeft: 16, // Pushes text away from the left edge
  },
  searchInput: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    height: '100%',
    width: '100%',
    padding: 0, // Resets default Android padding
  },

  // Dropdown Styles
  dropdownContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  dropdownGlass: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
    maxHeight: 280, // Prevents the list from taking over the whole screen
  },
  listSection: {
    paddingVertical: 12,
  },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.2,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(150, 150, 150, 0.15)', // Very subtle clinical backing
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  suggestionTextData: {
    flex: 1,
    justifyContent: 'center',
  },
  suggestionText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
  },
  suggestionSubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modals / Sheet Base Styles
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 14 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  welcomeCard: {
    width: '100%',
    height: '85%',
    maxHeight: 700,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden'
  },
  welcomeHero: { width: '100%', height: 160, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 24, overflow: 'hidden' },
  welcomeGreetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  welcomeGreetDot: { width: 8, height: 8, borderRadius: 4 },
  welcomeGreetText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.5 },
  welcomeTitle: { fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -0.5, marginBottom: 10 },
  welcomeBtnFixed: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
});