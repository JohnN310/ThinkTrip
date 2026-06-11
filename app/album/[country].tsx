import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '../../hooks/useColors';
import { useAuth } from '../../contexts/AuthContext';
import { useAlbum } from '../../contexts/AlbumContext';
import { db, storage } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { Image } from 'expo-image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const INITIAL_MEMORIES = [
  'https://images.unsplash.com/photo-1580828369019-4b36125021ed?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1551458981-817c76892c2b?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1610260463137-97d51ee9fa59?auto=format&fit=crop&q=80&w=400',
];

const PADDING = 20;
const GAP = 12;
const ITEM_WIDTH = (SCREEN_WIDTH - (PADDING * 2) - (GAP * 2)) / 3;
const ITEM_HEIGHT = ITEM_WIDTH + 20;

const getPosition = (index: number) => {
  'worklet';
  return {
    x: (index % 3) * (ITEM_WIDTH + GAP),
    y: Math.floor(index / 3) * (ITEM_HEIGHT + GAP),
  };
};

const DraggablePolaroid = ({ img, id, index, isEditing, onStartEditing, onDelete, memoriesLength, colors, positions, onReorderComplete }: any) => {
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
      let hoverIndex = row * 3 + col;
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
    const currentIndex = positions.value[id] ?? index;
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
        <Image source={{ uri: img }} style={[styles.polaroidImage, { backgroundColor: colors.border }]} resizeMode="cover" />
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

export default function AlbumScreen() {
  const { country } = useLocalSearchParams();
  const destination = (country as string) || '';
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { updateAlbumMeta } = useAlbum();

  const [memories, setMemories] = useState<string[]>([]);
  const positions = useSharedValue<Record<string, number>>({});
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [isEditingMemories, setIsEditingMemories] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      const uri = result.assets[0].uri;

      if (!user) {
        const newArr = [...memories, uri];
        setMemories(newArr);
        positions.value = Object.assign({}, ...newArr.map((m, i) => ({ [m]: i })));
        updateAlbumMeta(destination, newArr[newArr.length - 1] || null, newArr[newArr.length - 2] || null, newArr.length);
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
        updateAlbumMeta(destination, newArr[newArr.length - 1] || null, newArr[newArr.length - 2] || null, newArr.length);
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
              updateAlbumMeta(destination, newArr[newArr.length - 1] || null, newArr[newArr.length - 2] || null, newArr.length);

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
      updateAlbumMeta(destination, sorted[sorted.length - 1] || null, sorted[sorted.length - 2] || null, sorted.length);
    }
  };

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* Floating Top Navigation */}
      <View style={[styles.floatingNav, { top: insets.top + 10 }]}>
        <TouchableOpacity style={[styles.navButton, { backgroundColor: colors.card }]} onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.navButton, { backgroundColor: colors.card }]} onPress={pickImage} disabled={isUploading}>
          {isUploading ? (
            <ActivityIndicator size="small" color={colors.foreground} />
          ) : (
            <Feather name="plus" size={24} color={colors.foreground} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        scrollEnabled={!isEditingMemories}
      >
        {/* Full Bleed Hero Image */}
        <View style={styles.heroContainer}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&fm=webp&q=80&w=800' }} 
            style={styles.heroImage}
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk"
          />
        </View>

        {/* Floating Stats Card */}
        <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statItem}>
            <View style={[styles.iconPill, { backgroundColor: colors.secondary }]}>
              <Feather name="image" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{memories.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Memories</Text>
          </View>
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <View style={[styles.iconPill, { backgroundColor: colors.muted }]}>
              <Feather name="map-pin" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.statValue, { color: colors.foreground }]}>0</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Places</Text>
          </View>
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <View style={[styles.iconPill, { backgroundColor: colors.muted }]}>
              <Feather name="calendar" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.statValue, { color: colors.foreground }]}>—</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Trip Date</Text>
          </View>
          <View style={styles.statDivider} />

          {/* Active Highlight State */}
          <View style={[styles.statItem, { backgroundColor: colors.secondary, borderRadius: 12, paddingVertical: 8 }]}>
            <Feather name="star" size={16} color={colors.primary} style={{ marginBottom: 4 }} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>0</Text>
            <Text style={[styles.statLabel, { color: colors.primary }]}>Highlights</Text>
          </View>
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity style={[styles.filterPill, { backgroundColor: colors.secondary, borderColor: colors.primary }]}>
            <Feather name="grid" size={14} color={colors.primary} />
            <Text style={[styles.filterText, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>All Memories</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.filterPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="coffee" size={14} color={colors.foreground} />
            <Text style={[styles.filterText, { color: colors.foreground }]}>Food</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.filterPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="camera" size={14} color={colors.foreground} />
            <Text style={[styles.filterText, { color: colors.foreground }]}>Street</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.filterPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="heart" size={14} color={colors.foreground} />
            <Text style={[styles.filterText, { color: colors.foreground }]}>Moment</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* 3-Column Polaroid Grid */}
        <View style={styles.gridContainer}>
          {isEditingMemories && (
            <TouchableOpacity style={[styles.doneEditingBtn, { backgroundColor: '#238310ff' }]} onPress={() => setIsEditingMemories(false)} activeOpacity={0.8}>
              <Feather name="check" size={16} color="#ffffff" />
              <Text style={styles.newPostcardText}>Done</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.polaroidGrid, { height: Math.ceil((memories.length + 1) / 3) * (ITEM_HEIGHT + GAP) }]}>
            {memories.map((img: string, index: number) => (
              <DraggablePolaroid
                key={img}
                img={img}
                id={img}
                index={index}
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
                  top: Math.floor(memories.length / 3) * (ITEM_HEIGHT + GAP),
                  left: (memories.length % 3) * (ITEM_WIDTH + GAP),
                  borderColor: colors.border,
                  backgroundColor: colors.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255, 255, 255, 0.5)',
                  opacity: isUploading ? 0.5 : 1
                }
              ]}
              onPress={pickImage}
              activeOpacity={0.7}
              disabled={isUploading}
            >
              {isUploading ? <ActivityIndicator size="large" color={colors.mutedForeground} /> : <Feather name="plus" size={24} color={colors.mutedForeground} />}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  // Floating Navigation
  floatingNav: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  navButton: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 8, 
    elevation: 4 
  },

  // Hero Image 
  heroContainer: { 
    width: '100%', 
    marginBottom: 16,
  },
  heroImage: { 
    width: '100%', 
    height: 260, 
  },

  // Generic Button Text (retained for the 'Done' editing button)
  newPostcardText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#fff' },

  // Floating Stats Card
  statsCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginTop: -50, borderRadius: 20, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4, zIndex: 2 },
  statItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statDivider: { width: 1, height: 30, backgroundColor: '#E2E8F0' },
  iconPill: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 2 },
  statLabel: { fontFamily: 'Inter_500Medium', fontSize: 11 },

  // Filters
  filterScroll: { paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  filterPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, gap: 6 },
  filterText: { fontFamily: 'Inter_500Medium', fontSize: 13 },

  // Grid
  gridContainer: { paddingHorizontal: PADDING, paddingBottom: 100, paddingTop: 8 },
  doneEditingBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 6, marginBottom: 16 },
  polaroidGrid: { position: 'relative', width: '100%' },
  
  // Polaroid Items
  polaroid: { width: ITEM_WIDTH, backgroundColor: '#ffffff', padding: 6, borderRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3, marginBottom: 8 },
  polaroidImage: { width: '100%', aspectRatio: 1, backgroundColor: '#E5E7EB', marginBottom: 8, borderRadius: 2 },
  polaroidText: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginBottom: 2 },
  deleteBadge: { position: 'absolute', top: -8, right: -8, backgroundColor: '#EF4444', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  polaroidEmpty: { aspectRatio: 0.85, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', backgroundColor: 'rgba(255, 255, 255, 0.5)', shadowOpacity: 0, elevation: 0, transform: [{ rotate: '0deg' }] },
});
