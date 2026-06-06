import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Image, Modal, Alert, LayoutAnimation, UIManager, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '../../hooks/useColors';
import { useCountryContent } from '../../hooks/useCountryContent';
import { useAlbum } from '../../context/AlbumContext';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { db, storage } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

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

// Fallback dummy data
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
const ITEM_HEIGHT = ITEM_WIDTH + 30; // Calculated based on layout elements
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
    .minDistance(isEditing ? 0 : 10000)
    .activateAfterLongPress(isEditing ? 0 : 400)
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

      // Calculate current hover position
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
      // Wait for spring to finish before resetting zIndex
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
        zIndex: zIndex.value, // Continuously use the shared value so it doesn't instantly snap under others
        transform: [
          { translateX: translateX.value }, // Use the shared value here as it's animating to 0 in onEnd!
          { translateY: translateY.value }, // Use the shared value here too
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
      <Animated.View style={[styles.polaroid, { backgroundColor: colors.card, marginBottom: 0 }, animatedStyle]}>
        <Image source={{ uri: img }} style={[styles.polaroidImage, { backgroundColor: colors.border }]} />
        <Text style={[styles.polaroidText, { color: colors.mutedForeground }]}>Add a note...</Text>

        {isEditing && (
          <TouchableOpacity
            style={styles.deleteBadge}
            onPress={() => onDelete(id)}
            activeOpacity={0.8}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Feather name="x" size={14} color="#fff" />
          </TouchableOpacity>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

export default function HomeScreen() {
  const { country } = useLocalSearchParams<{ country: string }>();
  const [currentCountry, setCurrentCountry] = useState(country || 'Japan');

  useEffect(() => {
    if (country) {
      setCurrentCountry(country);
    }
  }, [country]);

  const destination = currentCountry;
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useCountryContent(destination);
  const { visitedCountries } = useAlbum();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('facts');
  const [memories, setMemories] = useState<string[]>([]);
  const positions = useSharedValue<Record<string, number>>({});

  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [showAlbumMenu, setShowAlbumMenu] = useState(false);
  const [isEditingMemories, setIsEditingMemories] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // --- Fetch Memories from Firebase ---
  useEffect(() => {
    async function fetchMemories() {
      if (!user) {
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
          // If no album document exists, start empty
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

  // --- Photo Library Integration ---
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Force a square crop to fit the polaroid style perfectly
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      const uri = result.assets[0].uri;

      if (!user) {
        // Fallback for unauthenticated users
        setMemories(prev => {
          const newArr = [...prev, uri];
          positions.value = Object.assign({}, ...newArr.map((m, i) => ({ [m]: i })));
          return newArr;
        });
        return;
      }

      setIsUploading(true);
      try {
        // 1. Convert URI to Blob
        const response = await fetch(uri);
        const blob = await response.blob();

        // 2. Upload to Firebase Storage
        const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const storageReference = ref(storage, `users/${user.uid}/albums/${destination}/${filename}`);
        await uploadBytes(storageReference, blob);

        // 3. Get Download URL
        const downloadUrl = await getDownloadURL(storageReference);

        // 4. Save to Firestore
        setMemories(prev => {
          const newArr = [...prev, downloadUrl];
          positions.value = Object.assign({}, ...newArr.map((m, i) => ({ [m]: i })));

          // Save to firestore in background
          const docRef = doc(db, 'users', user.uid, 'albums', destination);
          setDoc(docRef, { photos: newArr }, { merge: true }).catch(err => console.error("Error saving photo URL to firestore:", err));

          return newArr;
        });
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
            setMemories(prev => {
              const newArr = prev.filter(m => m !== idToDelete);
              positions.value = Object.assign({}, ...newArr.map((m, i) => ({ [m]: i })));

              if (user) {
                const docRef = doc(db, 'users', user.uid, 'albums', destination);
                setDoc(docRef, { photos: newArr }, { merge: true }).catch(console.error);

                // Optional: Delete from storage if it's a firebase URL
                if (idToDelete.includes('firebasestorage.googleapis.com')) {
                  try {
                    const storageRef = ref(storage, idToDelete);
                    deleteObject(storageRef).catch(console.error);
                  } catch (e) {
                    console.error("Failed to parse storage reference from URL", e);
                  }
                }
              }
              return newArr;
            });
          }
        }
      ]
    );
  };

  const handleReorderComplete = (newPositions: Record<string, number>) => {
    setMemories(prev => {
      const sorted = [...prev].sort((a, b) => newPositions[a] - newPositions[b]);

      if (user) {
        const docRef = doc(db, 'users', user.uid, 'albums', destination);
        setDoc(docRef, { photos: sorted }, { merge: true }).catch(console.error);
      }

      return sorted;
    });
  };

  const renderCards = () => {
    const contentList = data?.[activeTab]?.length ? data[activeTab] : (DUMMY_DATA[activeTab as keyof typeof DUMMY_DATA] || []);
    const activeTabData = TABS.find(t => t.id === activeTab);

    return (
      <View style={styles.cardsContainer}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name={activeTabData?.icon} size={18} color={activeTabData?.iconColor} />
          <Text style={[styles.sectionHeaderText, { color: activeTabData?.iconColor }]}>
            {activeTab.toUpperCase()}
          </Text>
        </View>

        {contentList.map((item: any, index: number) => (
          <View key={index} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.cardIconBox, { backgroundColor: activeTabData?.iconBg }]}>
              <MaterialCommunityIcons
                name={item.icon || 'star-outline'}
                size={24}
                color={activeTabData?.iconColor}
              />
            </View>
            <View style={styles.cardTextContent}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title || item.name}</Text>
              {item.date && (
                <View style={styles.dateRow}>
                  <Feather name="calendar" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{item.date}</Text>
                </View>
              )}
              <Text style={[styles.cardDescription, { color: colors.mutedForeground }]}>{item.description}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        scrollEnabled={!isEditingMemories}
      >
        {/* Dark Atmospheric Header Area */}
        <View style={[styles.darkHeaderBackground, { height: insets.top + 220 }]}>
          {flagUrl && (
            <Image
              source={{ uri: flagUrl }}
              style={[StyleSheet.absoluteFillObject, { borderBottomLeftRadius: 40, borderBottomRightRadius: 40, opacity: 0.4 }]}
              resizeMode="cover"
            />
          )}
        </View>

        {/* Top Right Album Button */}
        <TouchableOpacity
          style={{ position: 'absolute', top: insets.top + 10, right: 24, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}
          onPress={() => setShowAlbumMenu(true)}
        >
          <Feather name="book" size={16} color="#fff" />
          <Text style={{ color: '#fff', marginLeft: 8, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Album</Text>
        </TouchableOpacity>

        {/* Hero Text */}
        <View style={[styles.heroContent, { marginTop: insets.top + 40 }]}>
          <Text style={styles.heroEyebrow}>DESTINATION</Text>
          <Text style={styles.heroTitle}>{destination}</Text>
          <Text style={styles.heroSubtitle}>Where ancient tradition meets the ultramodern</Text>
        </View>

        {/* Memory Trace Section (MOVED UP) */}
        <View style={styles.memorySection}>
          <View style={styles.memoryHeaderRow}>
            <View style={styles.memoryEyebrowRow}>
              <Feather name="camera" size={14} color={colors.mutedForeground} />
              <Text style={[styles.memoryEyebrow, { color: colors.mutedForeground }]}>MEMORY TRACE</Text>
            </View>

            {isEditingMemories ? (
              <TouchableOpacity style={[styles.addButton, { backgroundColor: '#238310ff' }]} onPress={() => setIsEditingMemories(false)} activeOpacity={0.8}>
                <Feather name="check" size={16} color="#ffffff" />
                {/* <Text style={[styles.addButtonText, { color: '#ffffff' }]}>Done</Text> */}
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
            {/* Empty state add button */}
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

        {/* 2x2 Grid Tab Selector */}
        {/* <View style={styles.gridContainer}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                activeOpacity={0.8}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.gridItem,
                  {
                    backgroundColor: isActive ? colors.card : 'transparent',
                    borderColor: isActive ? colors.border : 'transparent',
                    shadowOpacity: isActive && !colors.isDark ? 0.08 : 0,
                  }
                ]}
              >
                <View style={styles.gridItemHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: isActive ? tab.iconBg : (colors.isDark ? '#27272A' : '#F3F4F6') }]}>
                    <MaterialCommunityIcons
                      name={tab.icon}
                      size={20}
                      color={isActive ? tab.iconColor : colors.mutedForeground}
                    />
                  </View>
                </View>
                <View style={styles.gridItemText}>
                  <Text style={[styles.gridItemTitle, { color: colors.foreground }]}>{tab.title}</Text>
                  <Text style={[styles.gridItemSubtitle, { color: colors.mutedForeground }]}>{tab.entries} entries</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View> */}

        {/* Content Section based on Tab */}
        {/* <View style={styles.contentWrapper}>
          {renderCards()}
        </View> */}

      </ScrollView>

      {/* Album Modal */}
      <Modal visible={showAlbumMenu} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setShowAlbumMenu(false)}
        >
          <View style={{ width: '85%', backgroundColor: colors.card, borderRadius: 24, padding: 24, maxHeight: '70%' }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, marginBottom: 16, color: colors.foreground }}>Travel Album</Text>
            {visitedCountries.length === 0 && (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 22 }}>You haven't added any countries yet. Go to the Plan tab and select one!</Text>
            )}
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {visitedCountries.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  onPress={() => {
                    setCurrentCountry(c);
                    setShowAlbumMenu(false);
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: c === currentCountry ? colors.primary : colors.foreground }}>{c}</Text>
                  {c === currentCountry && <Feather name="check" size={20} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  darkHeaderBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1E1B2E',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  heroContent: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  heroEyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#9CA3AF',
    letterSpacing: 2,
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 48,
    color: '#ffffff',
    letterSpacing: -1,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#D1D5DB',
    paddingRight: 40,
    lineHeight: 22,
  },
  memorySection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    marginBottom: 40, // Added spacing before the grid starts
  },
  memoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', // Aligns the eyebrow and button neatly
    marginBottom: 16,
  },
  memoryEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memoryEyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#6B7280',
    letterSpacing: 1.5,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  addButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#ffffff',
  },
  polaroidGrid: {
    position: 'relative',
    width: '100%',
  },
  polaroid: {
    width: (SCREEN_WIDTH - 64) / 2,
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 8,
  },
  polaroidImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
    borderRadius: 2,
  },
  polaroidText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 4,
  },
  deleteBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  polaroidEmpty: {
    aspectRatio: 0.85,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    shadowOpacity: 0,
    elevation: 0,
    transform: [{ rotate: '0deg' }]
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 32,
  },
  gridItem: {
    width: (SCREEN_WIDTH - 52) / 2,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridItemHeader: {
    marginRight: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridItemText: {
    flex: 1,
  },
  gridItemTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    marginBottom: 2,
  },
  gridItemSubtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  contentWrapper: {
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionHeaderText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    letterSpacing: 1.5,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 40,
  },
  card: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  cardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardTextContent: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    marginBottom: 6,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cardDate: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  cardDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },
});