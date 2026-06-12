import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Modal, Keyboard, Dimensions, TextInput, TouchableWithoutFeedback, Image, Alert, LayoutAnimation, UIManager, Animated as RNAnimated, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '../../hooks/useColors';
import { useProfile } from '../../contexts/ProfileContext';
import { useAlbum } from '../../contexts/AlbumContext';
import { useCountryContent } from '../../hooks/useCountryContent';
import { useAuth } from '../../contexts/AuthContext';
import { db, storage } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Gesture, GestureDetector, GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS, FadeInUp, SlideInDown, ZoomIn } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DolphinMascot } from '../../components/DolphinMascot';
import GlobeView, { GlobeViewRef } from '../../components/GlobeView';
import CountrySelectModal from '../../components/CountrySelectModal';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TabType = 'facts' | 'places' | 'culture' | 'events';

const TABS: { id: TabType; title: string; entries: number; icon: any; iconColor: string; iconBg: string }[] = [
  { id: 'facts', title: 'Facts', entries: 4, icon: 'lightbulb-outline', iconColor: '#d97706', iconBg: '#fef3c7' },
  { id: 'places', title: 'Places', entries: 4, icon: 'map-marker-outline', iconColor: '#059669', iconBg: '#d1fae5' },
  { id: 'culture', title: 'Culture', entries: 4, icon: 'account-group-outline', iconColor: '#4f46e5', iconBg: '#e0e7ff' },
  { id: 'events', title: 'Events', entries: 3, icon: 'calendar-blank-outline', iconColor: '#db2777', iconBg: '#fce7f3' },
];

const DUMMY_DATA = {
  facts: [
    { title: 'Vending Machine Nation', description: 'Japan has over 1 vending machine for every 23 people, selling hot coffee, fresh eggs, and even umbrellas.', icon: 'cup-water' },
    { title: 'Train Punctuality', description: 'If a train is even 1 minute late, an official delay certificate is issued — passengers use it to excuse lateness at work.', icon: 'train' }
  ],
  events: [
    { title: 'Cherry Blossom Season', date: 'Late March – Early April', description: 'Hanami festivals take over every city park. Locals stake spots days in advance for picnics beneath the blossoms.', icon: 'flower' },
    { title: 'Gion Matsuri', date: 'July', description: 'Kyoto\'s grandest festival, dating to 869 AD — processions of 32 enormous ceremonial floats fill the streets.', icon: 'lantern' }
  ]
};

export interface GeocodeSuggestion {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

const AlbumCard = ({ album, onPress, colors }: { album: any, onPress: () => void, colors: any }) => {
  const isEmpty = album.photoCount === 0;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.albumCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {/* Thumbnail Stack */}
      <View style={styles.thumbnailContainer}>
        {/* Left Photo (Tilted Left - Back) */}
        <View style={[styles.thumbnailPolaroid, { transform: [{ rotate: '-6deg' }], left: 0 }]}>
          {album.secondPhotoUrl ? (
            <Image source={{ uri: album.secondPhotoUrl }} style={styles.thumbnailImage} />
          ) : (
            <View style={[styles.thumbnailImage, { backgroundColor: colors.muted, justifyContent: 'center', alignItems: 'center' }]}>
              <Feather name="image" size={16} color={colors.mutedForeground} />
            </View>
          )}
        </View>

        {/* Right Photo (Tilted Right - Front) */}
        <View style={[styles.thumbnailPolaroid, { transform: [{ rotate: '4deg' }], right: 0 }]}>
          {album.latestPhotoUrl ? (
            <Image source={{ uri: album.latestPhotoUrl }} style={styles.thumbnailImage} />
          ) : (
            <View style={[styles.thumbnailImage, { backgroundColor: colors.muted, justifyContent: 'center', alignItems: 'center' }]}>
              {isEmpty ? <Feather name="lock" size={16} color={colors.mutedForeground} /> : <Feather name="image" size={16} color={colors.mutedForeground} />}
            </View>
          )}
        </View>

        {/* Floating Flag */}
        {album.flag && (
          <View style={styles.flagBadge}>
            {album.flag.startsWith('http') ? (
              <Image source={{ uri: album.flag }} style={styles.flagImage} />
            ) : (
              <Text style={styles.flagEmoji}>{album.flag}</Text>
            )}
          </View>
        )}
      </View>

      {/* Metadata */}
      <View style={styles.albumMeta}>
        <Text style={[styles.albumTitle, { color: colors.foreground }]} numberOfLines={1}>
          {album.country}
        </Text>
        <Text style={[styles.albumSubtitle, { color: colors.mutedForeground }]}>
          {album.photoCount} {album.photoCount === 1 ? 'memory' : 'memories'}
        </Text>
      </View>

      {/* Optional Lock Icon Overlay for 0 memories, matching wireframe */}
      {isEmpty && (
        <View style={[styles.lockOverlay, { backgroundColor: colors.muted }]}>
          <Feather name="lock" size={14} color={colors.mutedForeground} />
        </View>
      )}
    </TouchableOpacity>
  );
};

export default function MemoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, hydrated } = useProfile();

  // NEW VIEW STATE
  const [viewMode, setViewMode] = useState<'albums' | 'globe'>('albums');

  // Memory View State
  const { addCountry, visitedCountries } = useAlbum();
  const [albumSearchQuery, setAlbumSearchQuery] = useState('');

  // Filter logic for the grid
  const filteredAlbums = visitedCountries.filter(album =>
    album.country.toLowerCase().includes(albumSearchQuery.toLowerCase())
  );

  // Globe View State
  const unlockedCountries = useMemo(() => {
    return visitedCountries
      .filter(c => c.photoCount > 0)
      .map(c => c.country.toLowerCase());
  }, [visitedCountries]);

  const globeRef = useRef<GlobeViewRef>(null);
  const [selectedGlobeCountry, setSelectedGlobeCountry] = useState<any>(null);
  const [showGlobeModal, setShowGlobeModal] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchAnim = useRef(new RNAnimated.Value(0)).current;
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

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

  const toggleSearch = () => {
    if (Platform.OS !== 'web' && profile.hapticsEnabled) Haptics.selectionAsync();

    if (isSearchActive) {
      Keyboard.dismiss();
      RNAnimated.spring(searchAnim, {
        toValue: 0,
        useNativeDriver: false,
        friction: 9,
        tension: 60,
      }).start(() => setIsSearchActive(false));
    } else {
      setIsSearchActive(true);
      RNAnimated.spring(searchAnim, {
        toValue: 1,
        useNativeDriver: false,
        friction: 9,
        tension: 60,
      }).start();
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setIsFetchingSuggestions(false);
      return;
    }
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
    }, 400);
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [searchQuery]);

  const searchBarWidth = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [48, SCREEN_WIDTH - 40],
  });
  const searchInputOpacity = searchAnim.interpolate({
    inputRange: [0.5, 1],
    outputRange: [0, 1],
  });

  const searchCity = (locationQuery: string | GeocodeSuggestion) => {
    const queryStr = typeof locationQuery === 'string'
      ? locationQuery
      : `${locationQuery.name}${locationQuery.state && locationQuery.state !== locationQuery.name ? `, ${locationQuery.state}` : ''}, ${locationQuery.country}`;

    if (!queryStr.trim()) return;
    if (Platform.OS !== 'web' && profile.hapticsEnabled) Haptics.selectionAsync();

    let searchTarget = typeof locationQuery === 'string' ? locationQuery : locationQuery.name;
    if (typeof searchTarget === 'string' && searchTarget.includes(',')) {
      searchTarget = searchTarget.split(',')[0].trim();
    }

    globeRef.current?.flyToCountry(searchTarget);
    addRecentSearch(queryStr);
    setSearchQuery('');
    setSuggestions([]);
  };

  const handleGlobeCountrySelect = (countryData: any) => {
    setSelectedGlobeCountry(countryData);
    setShowGlobeModal(true);
    globeRef.current?.setAutoRotate(false);
  };

  const handleGlobeDestinationSet = (countryName: string) => {
    setShowGlobeModal(false);
    globeRef.current?.setAutoRotate(true);

    if (Platform.OS !== 'web' && profile.hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    addCountry(countryName);
    router.push(('/album/' + countryName) as any);
  };

  if (!hydrated) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]}>

      {viewMode === 'albums' && (
        <View style={styles.albumsContainer}>
          {/* Header */}
          <View style={[styles.albumsHeader, { marginTop: insets.top + 16 }]}>
            <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.card }]} onPress={() => setViewMode('globe')}>
              <Feather name="globe" size={20} color={colors.primary} />
            </TouchableOpacity>

            <View style={styles.titleStack}>
              <Text style={[styles.mainTitle, { color: colors.foreground }]}>Albums</Text>
            </View>

            <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.card }]} onPress={() => setViewMode('globe')}>
              <Feather name="plus" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchPillContainer}>
            <View style={[styles.searchPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="search" size={18} color={colors.mutedForeground} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Search..."
                placeholderTextColor={colors.mutedForeground}
                value={albumSearchQuery}
                onChangeText={setAlbumSearchQuery}
              />
            </View>
          </View>

          {/* Grid */}
          <FlatList
            data={filteredAlbums}
            keyExtractor={(item: any) => item.country}
            numColumns={2}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridRow}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <AlbumCard
                album={item}
                colors={colors}
                onPress={() => {
                  router.push(('/album/' + item.country) as any);
                }}
              />
            )}
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', marginTop: 40, color: colors.mutedForeground }}>
                No albums found. Tap + to add a country.
              </Text>
            }
          />
        </View>
      )}

      {viewMode === 'globe' && (
        // ==========================================
        //             GLOBE VIEW
        // ==========================================
        <View style={StyleSheet.absoluteFillObject}>
          <GlobeView ref={globeRef} onCountrySelect={handleGlobeCountrySelect} unlockedCountries={unlockedCountries} />

          {isSearchActive && (
            <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); toggleSearch(); }}>
              <View style={[StyleSheet.absoluteFillObject, { zIndex: 5 }]} />
            </TouchableWithoutFeedback>
          )}

          {/* Floating Back Button & Search Area */}
          <View pointerEvents="box-none" style={[styles.headerArea, { paddingTop: (insets.top || 20) + 16, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }]}>
            <View style={styles.headerRow} pointerEvents="box-none">
              <RNAnimated.View
                style={[styles.headerTextCol, {
                  opacity: searchAnim.interpolate({ inputRange: [0, 0.3], outputRange: [1, 0] }),
                  transform: [{ scale: searchAnim.interpolate({ inputRange: [0, 0.3], outputRange: [1, 0.8] }) }]
                }]}
                pointerEvents={isSearchActive ? "none" : "auto"}
              >
                <TouchableOpacity
                  style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => setViewMode('albums')}
                >
                  <Feather name="arrow-left" size={20} color="#fff" />
                </TouchableOpacity>
              </RNAnimated.View>

              <View style={styles.headerActions} pointerEvents="auto">
                <RNAnimated.View style={[styles.searchWrapper, { width: searchBarWidth }]}>
                  <BlurView intensity={40} tint="dark" style={styles.searchGlass}>
                    <RNAnimated.View style={[styles.inputContainer, { opacity: searchInputOpacity }]} pointerEvents={isSearchActive ? 'auto' : 'none'}>
                      <TextInput
                        style={[styles.searchInput, { color: '#ffffff' }]}
                        placeholder="Search destinations..."
                        placeholderTextColor="rgba(255, 255, 255, 0.6)"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={() => { searchCity(searchQuery); toggleSearch(); }}
                        returnKeyType="search"
                        autoFocus={isSearchActive}
                        autoCorrect={false}
                      />
                    </RNAnimated.View>
                    <TouchableOpacity activeOpacity={0.7} style={styles.searchIconBox} onPress={toggleSearch}>
                      <Feather name={isSearchActive ? "x" : "search"} size={20} color="#ffffff" />
                    </TouchableOpacity>
                  </BlurView>
                </RNAnimated.View>
              </View>
            </View>

            {/* Search Dropdown Menu */}
            <RNAnimated.View
              pointerEvents={isSearchActive ? 'auto' : 'none'}
              style={[
                styles.dropdownContainer,
                { top: (insets.top || 20) + 16 + 48 + 8, width: searchBarWidth },
                { opacity: searchAnim, transform: [{ translateY: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }
              ]}
            >
              {isSearchActive && (searchQuery.trim().length > 0 || recentSearches.length > 0) && (
                <BlurView intensity={40} tint="dark" style={styles.dropdownGlass}>
                  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    {searchQuery.trim().length === 0 && recentSearches.length > 0 && (
                      <View style={styles.listSection}>
                        <Text style={[styles.sectionLabel, { color: 'rgba(255, 255, 255, 0.6)' }]}>RECENT SEARCHES</Text>
                        {recentSearches.map((recentCity, idx) => (
                          <TouchableOpacity
                            key={`recent-${idx}`}
                            style={styles.suggestionRow}
                            onPress={() => { searchCity(recentCity); toggleSearch(); }}
                          >
                            <View style={styles.iconCircle}><Feather name="clock" size={14} color="rgba(255, 255, 255, 0.6)" /></View>
                            <Text style={[styles.suggestionText, { color: '#ffffff' }]}>{recentCity}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {isFetchingSuggestions && searchQuery.trim().length > 0 && (
                      <View style={styles.loadingContainer}><ActivityIndicator size="small" color="#ffffff" /></View>
                    )}

                    {!isFetchingSuggestions && suggestions.length > 0 && (
                      <View style={styles.listSection}>
                        <Text style={[styles.sectionLabel, { color: 'rgba(255, 255, 255, 0.6)' }]}>SUGGESTIONS</Text>
                        {suggestions.map((item, idx) => (
                          <TouchableOpacity
                            key={`sugg-${idx}`}
                            style={styles.suggestionRow}
                            onPress={() => { searchCity(item); toggleSearch(); }}
                          >
                            <View style={styles.iconCircle}><Feather name="map-pin" size={14} color="rgba(255, 255, 255, 0.6)" /></View>
                            <View style={styles.suggestionTextData}>
                              <Text style={[styles.suggestionText, { color: '#ffffff' }]}>{item.name}</Text>
                              <Text style={[styles.suggestionSubtext, { color: 'rgba(255, 255, 255, 0.6)' }]}>
                                {item.state && item.state !== item.name ? `${item.state}, ` : ''}{item.country}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {!isFetchingSuggestions && searchQuery.trim().length > 0 && suggestions.length === 0 && (
                      <View style={styles.loadingContainer}><Text style={[styles.suggestionSubtext, { color: 'rgba(255, 255, 255, 0.6)' }]}>No destinations found.</Text></View>
                    )}
                  </ScrollView>
                </BlurView>
              )}
            </RNAnimated.View>
          </View>

          <CountrySelectModal
            visible={showGlobeModal}
            country={selectedGlobeCountry}
            onClose={() => { setShowGlobeModal(false); globeRef.current?.setAutoRotate(true); }}
            onSelect={handleGlobeDestinationSet}
          />
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerArea: { paddingHorizontal: 20, paddingBottom: 0 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', width: '100%' },
  headerTextCol: { flex: 1, paddingRight: 16 },
  headerActions: { position: 'absolute', right: 0, top: 2, flexDirection: 'row', zIndex: 10 },
  searchWrapper: { height: 48, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  searchGlass: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', overflow: 'hidden' },
  searchIconBox: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  inputContainer: { position: 'absolute', left: 0, right: 48, height: '100%', justifyContent: 'center', paddingLeft: 16 },
  searchInput: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 15, padding: 0 },
  dropdownContainer: { position: 'absolute', right: 20, zIndex: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  dropdownGlass: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', overflow: 'hidden', maxHeight: 280 },
  listSection: { paddingVertical: 12 },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.2, paddingHorizontal: 16, marginBottom: 8 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  iconCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(150, 150, 150, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  suggestionTextData: { flex: 1, justifyContent: 'center' },
  suggestionText: { fontFamily: 'Inter_500Medium', fontSize: 15 },
  suggestionSubtext: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  loadingContainer: { padding: 24, alignItems: 'center', justifyContent: 'center' },

  // --- Album Grid Styles ---
  albumsContainer: { flex: 1, paddingHorizontal: 20 },
  albumsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  iconButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  titleStack: { alignItems: 'center', flex: 1 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5, color: '#5c7ce5', textTransform: 'uppercase', marginBottom: 4 },
  mainTitle: { fontFamily: 'Inter_700Bold', fontSize: 30, marginBottom: 4 },
  subTitle: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  searchPillContainer: { marginBottom: 24 },
  searchPill: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 24, paddingHorizontal: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 },
  gridContent: { paddingBottom: 100 },
  gridRow: { justifyContent: 'space-between', marginBottom: 16 },

  // --- Album Card Styles ---
  albumCard: { width: (SCREEN_WIDTH - 56) / 2, borderRadius: 16, padding: 12, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  thumbnailContainer: { height: 100, width: '100%', position: 'relative', marginBottom: 16 },
  thumbnailPolaroid: { position: 'absolute', width: '70%', aspectRatio: 1, backgroundColor: '#fff', padding: 4, borderRadius: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  thumbnailImage: { flex: 1, borderRadius: 4, overflow: 'hidden' },
  flagBadge: { position: 'absolute', bottom: -8, right: '25%', backgroundColor: '#fff', padding: 2, borderRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, zIndex: 10 },
  flagImage: { width: 24, height: 18, borderRadius: 2 },
  flagEmoji: { fontSize: 18 },
  albumMeta: { gap: 2 },
  albumTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  albumSubtitle: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  lockOverlay: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});