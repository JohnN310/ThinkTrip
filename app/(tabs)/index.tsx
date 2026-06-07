import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Modal, Keyboard, Dimensions, TextInput, TouchableWithoutFeedback, Image, Alert, LayoutAnimation, UIManager, Animated as RNAnimated } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '../../hooks/useColors';
import { useProfile } from '../../contexts/ProfileContext';
import { useAlbum } from '../../context/AlbumContext';
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

const INITIAL_MEMORIES = [
  'https://images.unsplash.com/photo-1580828369019-4b36125021ed?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1551458981-817c76892c2b?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1610260463137-97d51ee9fa59?auto=format&fit=crop&q=80&w=400',
];

const ITEM_WIDTH = (SCREEN_WIDTH - 64) / 2;
const ITEM_HEIGHT = ITEM_WIDTH + 30;
const GAP = 16;

const getPosition = (index: number) => {
  'worklet';
  return {
    x: (index % 2) * (ITEM_WIDTH + GAP),
    y: Math.floor(index / 2) * (ITEM_HEIGHT + GAP),
  };
};

const DraggablePolaroid = ({ img, id, isEditing, onStartEditing, onDelete, memoriesLength, colors, positions, onReorderComplete }: any) => {
  const isDragging = useSharedValue(false);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startPos = useSharedValue({ x: 0, y: 0 });
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .minDistance(isEditing ? 15 : 10000)
    .activateAfterLongPress(isEditing ? 300 : 400)
    .onStart(() => {
      if (!isEditing) {
        runOnJS(onStartEditing)();
      }
      isDragging.value = true;
      const currentIndex = positions.value[id];
      startPos.value = getPosition(currentIndex);
      translateX.value = 0;
      translateY.value = 0;
      scale.value = withSpring(1.05);
      zIndex.value = 100;
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;

      const currentX = startPos.value.x + e.translationX + ITEM_WIDTH / 2;
      const currentY = startPos.value.y + e.translationY + ITEM_HEIGHT / 2;

      const col = Math.floor(currentX / (ITEM_WIDTH + GAP));
      const row = Math.floor(currentY / (ITEM_HEIGHT + GAP));
      let hoverIndex = row * 2 + col;
      hoverIndex = Math.max(0, Math.min(memoriesLength - 1, hoverIndex));

      const oldIndex = positions.value[id];

      if (hoverIndex !== oldIndex) {
        const newPositions = Object.assign({}, positions.value);
        const otherId = Object.keys(newPositions).find(k => newPositions[k] === hoverIndex);

        if (otherId) {
          newPositions[otherId] = oldIndex;
          newPositions[id] = hoverIndex;
          positions.value = newPositions;
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    })
    .onEnd(() => {
      isDragging.value = false;

      translateX.value = withSpring(0, { damping: 50, stiffness: 200 });
      translateY.value = withSpring(0, { damping: 50, stiffness: 200 });
      scale.value = withSpring(1);
      zIndex.value = 10;

      runOnJS(onReorderComplete)(positions.value);
    });

  const animatedStyle = useAnimatedStyle(() => {
    const currentIndex = positions.value[id];
    const pos = getPosition(currentIndex);

    if (isDragging.value) {
      return {
        position: 'absolute',
        top: startPos.value.y,
        left: startPos.value.x,
        zIndex: 100,
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value },
          { scale: scale.value },
          { rotate: currentIndex % 2 === 0 ? '-2deg' : '2deg' }
        ],
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
      };
    } else {
      return {
        position: 'absolute',
        top: withSpring(pos.y, { damping: 50, stiffness: 200 }),
        left: withSpring(pos.x, { damping: 50, stiffness: 200 }),
        zIndex: zIndex.value,
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value },
          { scale: scale.value },
          { rotate: currentIndex % 2 === 0 ? '-2deg' : '2deg' }
        ],
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      };
    }
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        hitSlop={{ top: 20, right: 20, bottom: 20, left: 20 }}
        style={[styles.polaroid, { backgroundColor: colors.card, marginBottom: 0 }, animatedStyle]}
      >
        <Image source={{ uri: img }} style={[styles.polaroidImage, { backgroundColor: colors.border }]} />
        <Text style={[styles.polaroidText, { color: colors.mutedForeground }]}>Add a note...</Text>

        {isEditing && (
          <TouchableOpacity
            style={[styles.deleteBadge, { top: -10, right: -10, width: 28, height: 28, borderRadius: 14 }]}
            onPress={() => onDelete(id)}
            activeOpacity={0.8}
            hitSlop={{ top: 20, right: 20, bottom: 20, left: 20 }}
          >
            <Feather name="x" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

const PhotoStack = ({ latestPhotoUrl, index }: { latestPhotoUrl: string | null, index: number }) => {
  return (
    <View style={{ width: 64, height: 64, marginRight: 16 }}>
      <Animated.View entering={ZoomIn.delay(index * 100 + 100)} style={{ position: 'absolute', width: 56, height: 56, backgroundColor: '#E5E7EB', borderRadius: 8, top: 0, left: 4, transform: [{ rotate: '6deg' }] }} />
      <Animated.View entering={ZoomIn.delay(index * 100 + 150)} style={{ position: 'absolute', width: 60, height: 60, backgroundColor: '#D1D5DB', borderRadius: 8, top: 2, left: 2, transform: [{ rotate: '-3deg' }] }} />
      <Animated.View entering={ZoomIn.delay(index * 100 + 200)} style={{ position: 'absolute', width: 64, height: 64, backgroundColor: '#F3F4F6', borderRadius: 8, top: 0, left: 0, overflow: 'hidden', borderWidth: 2, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}>
        {latestPhotoUrl ? (
          <Image source={{ uri: latestPhotoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Feather name="image" size={20} color="#9CA3AF" />
          </View>
        )}
      </Animated.View>
    </View>
  );
};

export interface GeocodeSuggestion {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

export default function MemoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, hydrated } = useProfile();
  const { user } = useAuth();
  
  // NEW VIEW STATE
  const [viewMode, setViewMode] = useState<'memory' | 'globe'>('memory');

  // Memory View State
  const { addCountry, visitedCountries, updateAlbumMeta, removeCountry } = useAlbum();
  const [currentCountry, setCurrentCountry] = useState<string | null>(null);

  useEffect(() => {
    if (!currentCountry && visitedCountries.length > 0) {
      setCurrentCountry(visitedCountries[0].country);
    } else if (visitedCountries.length === 0 && currentCountry !== null) {
      setCurrentCountry(null);
    }
  }, [visitedCountries.length, currentCountry]);

  const destination = currentCountry || '';
  const { data, isLoading } = useCountryContent(destination);
  const [activeTab, setActiveTab] = useState<TabType>('facts');
  const [memories, setMemories] = useState<string[]>([]);
  const positions = useSharedValue<Record<string, number>>({});
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [showAlbumMenu, setShowAlbumMenu] = useState(false);
  const [isEditingMemories, setIsEditingMemories] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

  // Memory View Effects
  useEffect(() => {
    async function fetchMemories() {
      if (!user || !destination) {
        setMemories(INITIAL_MEMORIES);
        positions.value = Object.assign({}, ...INITIAL_MEMORIES.map((m, i) => ({ [m]: i })));
        return;
      }
      try {
        const docRef = doc(db, 'users', user.uid, 'albums', destination);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().photos) {
          const fetchedPhotos = docSnap.data().photos;
          setMemories(fetchedPhotos);
          positions.value = Object.assign({}, ...fetchedPhotos.map((m: string, i: number) => ({ [m]: i })));
        } else {
          setMemories([]);
          positions.value = {};
        }
      } catch (err) {
        console.error('Failed to fetch memories', err);
      }
    }
    fetchMemories();
  }, [destination, user]);

  useEffect(() => {
    async function fetchFlag() {
      if (!destination) return;
      try {
        const response = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(destination)}`);
        const result = await response.json();
        if (result && result[0] && result[0].flags) {
          setFlagUrl(result[0].flags.png || result[0].flags.svg);
        }
      } catch (err) {
        console.warn('Failed to fetch flag', err);
      }
    }
    fetchFlag();
  }, [destination]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      const uri = result.assets[0].uri;

      if (!user) {
        const newArr = [...memories, uri];
        setMemories(newArr);
        positions.value = Object.assign({}, ...newArr.map((m, i) => ({ [m]: i })));
        updateAlbumMeta(destination, uri, newArr.length);
        return;
      }

      setIsUploading(true);
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const storageReference = ref(storage, `users/${user.uid}/albums/${destination}/${filename}`);
        await uploadBytes(storageReference, blob);
        const downloadUrl = await getDownloadURL(storageReference);

        const newArr = [...memories, downloadUrl];
        setMemories(newArr);
        positions.value = Object.assign({}, ...newArr.map((m, i) => ({ [m]: i })));

        const docRef = doc(db, 'users', user.uid, 'albums', destination);
        setDoc(docRef, { photos: newArr }, { merge: true }).catch(err => console.error("Error saving photo URL to firestore:", err));
        updateAlbumMeta(destination, downloadUrl, newArr.length);
      } catch (err) {
        console.error("Error uploading image:", err);
        Alert.alert("Upload Failed", "There was an error saving your photo to the cloud.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleDeleteMemory = (idToDelete: string) => {
    Alert.alert(
      "Delete Photo",
      "Are you sure you want to remove this memory?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const newArr = memories.filter(m => m !== idToDelete);
            setMemories(newArr);
            positions.value = Object.assign({}, ...newArr.map((m, i) => ({ [m]: i })));

            if (user) {
              const docRef = doc(db, 'users', user.uid, 'albums', destination);
              setDoc(docRef, { photos: newArr }, { merge: true }).catch(console.error);
              updateAlbumMeta(destination, newArr[0] || null, newArr.length);

              if (idToDelete.includes('firebasestorage.googleapis.com')) {
                try {
                  const storageRef = ref(storage, idToDelete);
                  deleteObject(storageRef).catch(console.error);
                } catch (e) {
                  console.error("Failed to parse storage reference from URL", e);
                }
              }
            }
          }
        }
      ]
    );
  };

  const handleReorderComplete = (newPositions: Record<string, number>) => {
    const sorted = [...memories].sort((a, b) => newPositions[a] - newPositions[b]);
    setMemories(sorted);

    if (user) {
      const docRef = doc(db, 'users', user.uid, 'albums', destination);
      setDoc(docRef, { photos: sorted }, { merge: true }).catch(console.error);
      updateAlbumMeta(destination, sorted[0] || null, sorted.length);
    }
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
    setCurrentCountry(countryName);
    setViewMode('memory');
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
      
      {viewMode === 'memory' ? (
        // ==========================================
        //             MEMORY VIEW
        // ==========================================
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEnabled={!isEditingMemories && !!currentCountry}
          contentContainerStyle={!currentCountry ? { flex: 1, justifyContent: 'center', alignItems: 'center' } : undefined}
        >
          {/* Top Right Album Button - ALWAYS VISIBLE */}
          <TouchableOpacity
            style={{ position: 'absolute', top: insets.top + 10, right: 24, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}
            onPress={() => setShowAlbumMenu(true)}
          >
            <Feather name="book" size={16} color="#fff" />
            <Text style={{ color: '#fff', marginLeft: 8, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Album</Text>
          </TouchableOpacity>

          {!currentCountry ? (
            <View style={{ alignItems: 'center', padding: 32 }}>
              <Feather name="globe" size={48} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: colors.foreground, marginBottom: 8, textAlign: 'center' }}>No Country Selected</Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.mutedForeground, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
                You haven't added any countries to your albums yet. Search to get started!
              </Text>
              <TouchableOpacity style={styles.addButton} onPress={() => setViewMode('globe')}>
                <Text style={styles.addButtonText}>Explore the Globe</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Dark Atmospheric Header Area */}
              <TouchableOpacity activeOpacity={0.9} onPress={() => setViewMode('globe')} style={[styles.darkHeaderBackground, { minHeight: insets.top + 220 }]}>
                {flagUrl && (
                  <Image
                    source={{ uri: flagUrl }}
                    style={[StyleSheet.absoluteFillObject, { opacity: 0.4 }]}
                    resizeMode="cover"
                  />
                )}
                <View style={[styles.heroContent, { marginTop: insets.top + 40 }]}>
                  <Text style={styles.heroEyebrow}>DESTINATION</Text>
                  <Text style={styles.heroTitle} numberOfLines={1} adjustsFontSizeToFit>{destination}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Feather name="globe" size={14} color="#D1D5DB" />
                    <Text style={styles.heroSubtitle}>Tap to explore on globe</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Memory Trace Section */}
              <View style={styles.memorySection}>
                <View style={styles.memoryHeaderRow}>
                  <View style={styles.memoryEyebrowRow}>
                    <Feather name="camera" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.memoryEyebrow, { color: colors.mutedForeground }]}>MEMORY TRACE</Text>
                  </View>

                  {isEditingMemories ? (
                    <TouchableOpacity style={[styles.addButton, { backgroundColor: '#238310ff' }]} onPress={() => setIsEditingMemories(false)} activeOpacity={0.8}>
                      <Feather name="check" size={16} color="#ffffff" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.foreground, opacity: isUploading ? 0.5 : 1 }]} onPress={pickImage} activeOpacity={0.8} disabled={isUploading}>
                      {isUploading ? <ActivityIndicator size="small" color={colors.background} style={{ marginRight: 4 }} /> : <Feather name="plus" size={16} color={colors.background} />}
                      <Text style={[styles.addButtonText, { color: colors.background }]}>{isUploading ? '' : 'Add'}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={[styles.polaroidGrid, { height: Math.ceil((memories.length + 1) / 2) * (ITEM_HEIGHT + GAP) }]}>
                  {memories.map((img) => (
                    <DraggablePolaroid
                      key={img}
                      img={img}
                      id={img}
                      isEditing={isEditingMemories}
                      onStartEditing={() => setIsEditingMemories(true)}
                      onDelete={handleDeleteMemory}
                      onReorderComplete={handleReorderComplete}
                      memoriesLength={memories.length}
                      positions={positions}
                      colors={colors}
                    />
                  ))}
                  <TouchableOpacity
                    style={[
                      styles.polaroid,
                      styles.polaroidEmpty,
                      {
                        position: 'absolute',
                        top: Math.floor(memories.length / 2) * (ITEM_HEIGHT + GAP),
                        left: (memories.length % 2) * (ITEM_WIDTH + GAP),
                        borderColor: colors.border,
                        backgroundColor: colors.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255, 255, 255, 0.5)',
                        opacity: isUploading ? 0.5 : 1
                      }
                    ]}
                    onPress={pickImage}
                    activeOpacity={0.7}
                    disabled={isUploading}
                  >
                    {isUploading ? <ActivityIndicator size="large" color={colors.mutedForeground} /> : <Feather name="plus" size={32} color={colors.mutedForeground} />}
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {/* Hero Card Album Modal */}
          <Modal visible={showAlbumMenu} transparent animationType="fade">
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
              <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowAlbumMenu(false)} />

              <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
                <Animated.View
                  entering={SlideInDown.duration(400)}
                  style={{
                    backgroundColor: colors.background,
                    borderTopLeftRadius: 32,
                    borderTopRightRadius: 32,
                    paddingTop: 32,
                    paddingHorizontal: 24,
                    paddingBottom: insets.bottom + 24,
                    maxHeight: '85%'
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.foreground }}>Your Albums</Text>
                    <TouchableOpacity onPress={() => setShowAlbumMenu(false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' }}>
                      <Feather name="x" size={20} color={colors.foreground} />
                    </TouchableOpacity>
                  </View>

                  {visitedCountries.length === 0 && (
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 22 }}>You haven't added any countries yet. Tap "Explore the Globe" to select one!</Text>
                  )}

                  <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                    {visitedCountries.map((album, index) => (
                      <Animated.View key={album.country} entering={FadeInUp.delay(index * 100)}>
                        <Swipeable
                          renderRightActions={() => (
                            <TouchableOpacity
                              style={{
                                backgroundColor: '#EF4444',
                                justifyContent: 'center',
                                alignItems: 'center',
                                width: 80,
                                borderRadius: 20,
                                marginBottom: 12,
                                marginLeft: 12,
                              }}
                              onPress={() => {
                                Alert.alert(
                                  "Delete Album",
                                  `Are you sure you want to remove ${album.country}?`,
                                  [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                      text: "Delete",
                                      style: "destructive",
                                      onPress: () => {
                                        removeCountry(album.country);
                                        if (album.country === currentCountry) {
                                          const fallback = visitedCountries.find(c => c.country !== album.country)?.country || 'Japan';
                                          setCurrentCountry(fallback);
                                        }
                                      }
                                    }
                                  ]
                                );
                              }}
                            >
                              <Feather name="trash-2" size={24} color="#FFF" />
                            </TouchableOpacity>
                          )}
                        >
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              padding: 16,
                              backgroundColor: colors.card,
                              borderRadius: 20,
                              marginBottom: 12,
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.04,
                              shadowRadius: 12,
                              elevation: 2
                            }}
                            activeOpacity={0.7}
                            onPress={() => {
                              setCurrentCountry(album.country);
                              setShowAlbumMenu(false);
                            }}
                          >
                            <PhotoStack latestPhotoUrl={album.latestPhotoUrl} index={index} />

                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                {album.flag?.startsWith('http') ? (
                                  <Image source={{ uri: album.flag }} style={{ width: 22, height: 16, marginRight: 8, borderRadius: 2 }} />
                                ) : (
                                  album.flag && <Text style={{ fontSize: 18, marginRight: 6 }}>{album.flag}</Text>
                                )}
                                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 18, color: colors.foreground, flexShrink: 1 }} numberOfLines={1}>
                                  {album.country}
                                </Text>
                              </View>
                              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.mutedForeground }}>
                                {album.photoCount} {album.photoCount === 1 ? 'memory' : 'memories'}
                              </Text>
                            </View>

                            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                          </TouchableOpacity>
                        </Swipeable>
                      </Animated.View>
                    ))}
                  </ScrollView>
                </Animated.View>
              </View>
            </BlurView>
          </Modal>
        </ScrollView>
      ) : (
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
              <View style={styles.headerTextCol} pointerEvents="auto">
                <TouchableOpacity
                  style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => setViewMode('memory')}
                >
                  <Feather name="arrow-left" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

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
              {isSearchActive && (
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
  searchInput: { fontFamily: 'Inter_500Medium', fontSize: 15, height: '100%', width: '100%', padding: 0 },
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
  darkHeaderBackground: { backgroundColor: '#1E1B2E', borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden' },
  heroContent: { paddingHorizontal: 24, marginBottom: 32 },
  heroEyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#9CA3AF', letterSpacing: 2, marginBottom: 4 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 48, color: '#ffffff', letterSpacing: -1, marginBottom: 8 },
  heroSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#D1D5DB', lineHeight: 22 },
  memorySection: { paddingHorizontal: 24, paddingTop: 16, marginBottom: 40 },
  memoryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  memoryEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memoryEyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 12, letterSpacing: 1.5 },
  addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 6 },
  addButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#ffffff' },
  polaroidGrid: { position: 'relative', width: '100%' },
  polaroid: { width: (SCREEN_WIDTH - 64) / 2, backgroundColor: '#ffffff', padding: 8, borderRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3, marginBottom: 8 },
  polaroidImage: { width: '100%', aspectRatio: 1, backgroundColor: '#E5E7EB', marginBottom: 12, borderRadius: 2 },
  polaroidText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 4 },
  deleteBadge: { position: 'absolute', top: -8, right: -8, backgroundColor: '#EF4444', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  polaroidEmpty: { aspectRatio: 0.85, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', backgroundColor: 'rgba(255, 255, 255, 0.5)', shadowOpacity: 0, elevation: 0, transform: [{ rotate: '0deg' }] },
});