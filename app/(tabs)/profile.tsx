import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, KeyboardAvoidingView, Platform, Alert, Modal, Share, Linking, Dimensions } from 'react-native';
// import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useColors } from '../../hooks/useColors';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/Card';
import { SettingsGroup, SettingsRow } from '../../components/SettingsRow';
import { ToggleRow } from '../../components/ToggleRow';
import { SegmentedControl } from '../../components/SegmentedControl';
// import { registerBackgroundWeatherTask, unregisterBackgroundWeatherTask } from '../../lib/backgroundWeather';

const AVATAR_COLORS = [
  // Signature Blues & Indigos
  '#5c7ce5', '#3b82f6', '#2563eb', '#1d4e89', '#1e3a8a', '#312e81',
  // Rich Plums & Berries
  '#8b5cf6', '#6d28d9', '#4c1d95', '#be185d', '#9f1239', '#800020',
  // Earthy Terracottas & Rusts
  '#ea580c', '#c2410c', '#9a3412', '#b45309', '#a76b18', '#78350f',
  // Muted Botanicals & Slates
  '#0d9488', '#0f766e', '#15803d', '#3f6212', '#475569', '#334155',
  // Deep & Grounded (New)
  '#083344', '#064e3b', '#451a03', '#4a044e'
];

const AVATAR_EMOJIS = [
  '✈️', '🌴', '☕️', '⛰️', '📸', '🌊', '🦊', '🦉',
  '🌵', '🍣', '🍷', '🏕️', '🌅', '🚲', '🍕', '🏄',
  '🧭', '🌿', '🧳', '🌙', '❄️', '⛵', '🗺️', '🏰', '🏛️'
];

const PREDEFINED_ALLERGIES = [
  'Peanuts', 'Shellfish', 'Fish', 'Eggs',
  'Soy', 'Sesame', 'Pollen', 'Dust Mites'
];

const ALLERGY_METADATA: Record<string, { emoji: string; lightBg: string; darkBg: string; lightText: string; darkText: string }> = {
  'Peanuts': { emoji: '🥜', lightBg: '#fef3c7', darkBg: '#451a03', lightText: '#92400e', darkText: '#fde68a' },
  'Tree Nuts': { emoji: '🌰', lightBg: '#ffedd5', darkBg: '#431407', lightText: '#9a3412', darkText: '#fed7aa' },
  'Shellfish': { emoji: '🦐', lightBg: '#ffe4e6', darkBg: '#4c0519', lightText: '#e11d48', darkText: '#fecdd3' },
  'Fish': { emoji: '🐟', lightBg: '#3b82f6', darkBg: '#1d4ed8', lightText: '#ffffff', darkText: '#ffffff' }, // Vibrant blue
  'Eggs': { emoji: '🥚', lightBg: '#fef9c3', darkBg: '#422006', lightText: '#a16207', darkText: '#fef08a' },
  'Soy': { emoji: '🫘', lightBg: '#dcfce7', darkBg: '#052e16', lightText: '#15803d', darkText: '#bbf7d0' },
  'Sesame': { emoji: '🧆', lightBg: '#a1bdf5ff', darkBg: '#28497eff', lightText: '#1f2937', darkText: '#f3f4f6' },
  'Latex': { emoji: '🧤', lightBg: '#f3e8ff', darkBg: '#3b0764', lightText: '#7e22ce', darkText: '#e9d5ff' },
  'Penicillin': { emoji: '💊', lightBg: '#fce7f3', darkBg: '#500724', lightText: '#be185d', darkText: '#fbcfe8' },
  'Bee Stings': { emoji: '🐝', lightBg: '#fef3c7', darkBg: '#451a03', lightText: '#92400e', darkText: '#fde68a' },
  'Pollen': { emoji: '🌸', lightBg: '#fce7f3', darkBg: '#500724', lightText: '#be185d', darkText: '#fbcfe8' },
  'Dust Mites': { emoji: '🦠', lightBg: '#e0f2fe', darkBg: '#082f49', lightText: '#0369a1', darkText: '#bae6fd' },
};

type SheetType = 'Account' | 'Skin' | 'Diet' | 'Travel' | 'Units' | 'Languages' | 'About' | 'Theme' | null;

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, draft, isDirty, setDraft, save, reset } = useProfile();
  const { signOut } = useAuth();

  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [showToast, setShowToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);
  const [customAllergyInput, setCustomAllergyInput] = useState('');

  const validateCity = async (cityName: string): Promise<{ name: string; exists: boolean }> => {
    if (!cityName.trim()) return { name: '', exists: true };
    try {
      const apiKey = process.env.EXPO_PUBLIC_WEATHER_KEY;
      const response = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${apiKey}`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        return { name: data[0].name, exists: true };
      }
      return { name: cityName, exists: false };
    } catch (error) {
      console.error("City validation failed", error);
      return { name: cityName, exists: true };
    }
  };

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setCityError(null);

    let finalHomeCity = draft.homeCity;

    // Validate Home City if changed
    if (draft.homeCity !== profile.homeCity && draft.homeCity.trim() !== '') {
      setIsSaving(true);
      const validation = await validateCity(draft.homeCity);
      if (!validation.exists) {
        setCityError("City not found. Please check the spelling.");
        if (Platform.OS !== 'web' && profile.hapticsEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setIsSaving(false);
        return;
      }
      // Capture the correct OpenWeather name
      finalHomeCity = validation.name;
      // Update the UI draft state
      setDraft({ homeCity: finalHomeCity });
    }

    setIsSaving(true);
    try {
      // Pass the corrected city directly to bypass the React state delay
      await save({ homeCity: finalHomeCity });

      if (Platform.OS !== 'web' && profile.hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setActiveSheet(null);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 1400);
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    reset();
    setCityError(null);
    setActiveSheet(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert("Error", "Failed to sign out.");
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'TT';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleExportData = async () => {
    try {
      await Share.share({
        message: JSON.stringify(profile, null, 2),
        title: 'ThinkTrip Profile Data'
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleOpenLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
  };

  // const handleToggleLiveAlerts = async (value: boolean) => {
  //   if (!value) {
  //     setDraft({ liveAlertsEnabled: false });
  //     await save({ liveAlertsEnabled: false });
  //     if (Platform.OS !== 'web') {
  //       // await unregisterBackgroundWeatherTask();
  //     }
  //     return;
  //   }

  //   try {
  //     const { status: notifStatus } = await Notifications.requestPermissionsAsync();
  //     if (notifStatus !== 'granted') {
  //       Alert.alert('Permission Denied', 'Please enable notifications in your device settings to receive live alerts.');
  //       setDraft({ liveAlertsEnabled: false });
  //       return;
  //     }

  //     setDraft({
  //       liveAlertsEnabled: true,
  //     });
  //     await save({
  //       liveAlertsEnabled: true,
  //     });

  //     if (Platform.OS !== 'web' && profile.hapticsEnabled) {
  //       Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  //     }

  //     // Register the background task
  //     if (Platform.OS !== 'web') {
  //       // await registerBackgroundWeatherTask();
  //     }

  //   } catch (error) {
  //     console.error('Error enabling live alerts:', error);
  //     setDraft({ liveAlertsEnabled: false });
  //     save({ liveAlertsEnabled: false });
  //   }
  // };

  const handleToggleLocationRouting = async (value: boolean) => {
    if (!value) {
      setDraft({ locationRoutingEnabled: false });
      save({ locationRoutingEnabled: false });
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Denied',
        'Please enable location services in your device settings to use this feature.',
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() }
        ]
      );
      return;
    }

    setDraft({ locationRoutingEnabled: true });
    save({ locationRoutingEnabled: true });

    if (Platform.OS !== 'web' && profile.hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const renderSheetContent = () => {
    if (activeSheet === 'Account') {
      // Chunk the colors into arrays of 2 for the vertical columns
      const colorColumns = [];
      for (let i = 0; i < AVATAR_COLORS.length; i += 2) {
        colorColumns.push(AVATAR_COLORS.slice(i, i + 2));
      }

      // Combine the "Initials" option (represented by '') with the emojis, then chunk into 2s
      const allEmojiOptions = ['', ...AVATAR_EMOJIS];
      const emojiColumns = [];
      for (let i = 0; i < allEmojiOptions.length; i += 2) {
        emojiColumns.push(allEmojiOptions.slice(i, i + 2));
      }

      return (
        <View style={{ gap: 24 }}>
          <View>
            <Text style={[styles.inputHint, { color: colors.mutedForeground, marginBottom: 8 }]}>PROFILE COLOR</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
              {colorColumns.map((column, colIndex) => (
                <View key={colIndex} style={{ gap: 12 }}>
                  {column.map(color => (
                    <TouchableOpacity
                      key={color}
                      onPress={() => setDraft({ avatarColor: color })}
                      style={{
                        width: 44, height: 44, borderRadius: 22, backgroundColor: color,
                        borderWidth: draft.avatarColor === color ? 3 : 0,
                        borderColor: draft.avatarColor === color ? colors.accent : 'transparent',
                      }}
                    />
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>

          <View>
            <Text style={[styles.inputHint, { color: colors.mutedForeground, marginBottom: 8 }]}>AVATAR ICON</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {emojiColumns.map((column, colIndex) => (
                <View key={`emoji-col-${colIndex}`} style={{ gap: 12 }}>
                  {column.map((item) => {
                    const isInitials = item === '';
                    const isSelected = draft.avatarEmoji === item;

                    return (
                      <TouchableOpacity
                        key={isInitials ? 'initials' : item}
                        onPress={() => setDraft({ avatarEmoji: item })}
                        style={{
                          width: 48, height: 48, borderRadius: 24,
                          backgroundColor: isSelected ? 'rgba(0,0,0,0.05)' : 'transparent',
                          borderWidth: isSelected ? 2 : 1,
                          borderColor: isSelected ? colors.primary : colors.border,
                          alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        {isInitials ? (
                          <Text style={{ fontSize: 14, color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }}>A B</Text>
                        ) : (
                          <Text style={{ fontSize: 24 }}>{item}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={{ gap: 18 }}>
            <View>
              <Text style={[styles.inputHint, { color: colors.mutedForeground }]}>FULL NAME</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                value={draft.displayName}
                onChangeText={(t) => setDraft({ displayName: t })}
                placeholder="Your name"
              />
            </View>
            <View>
              <Text style={[styles.inputHint, { color: colors.mutedForeground }]}>EMAIL</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.mutedForeground }]}
                value={profile.email}
                editable={false}
              />
            </View>
            <View>
              <Text style={[styles.inputHint, { color: colors.mutedForeground }]}>HOME CITY</Text>

              <TextInput
                style={[
                  styles.input,
                  { borderColor: colors.border, color: colors.foreground },
                  cityError ? { borderColor: colors.destructive } : null
                ]}
                value={draft.homeCity}
                onChangeText={(t) => {
                  setDraft({ homeCity: t });
                  if (cityError) setCityError(null);
                }}
                placeholder="e.g. San Francisco"
                autoCorrect={false}
              />
              {cityError && (
                <Text style={[styles.errorText, { color: colors.destructive }]}>{cityError}</Text>
              )}
            </View>
          </View>
        </View>
      );
    }
    if (activeSheet === 'Skin') {
      const SKIN_TYPES = [
        { id: 'Dry', label: 'Dry', emoji: '🏜️' },
        { id: 'Combination', label: 'Combination', emoji: '🌗' },
        { id: 'Oily', label: 'Oily', emoji: '💧' },
        { id: 'Sensitive', label: 'Sensitive', emoji: '⚡' },
      ];

      return (
        <View style={{ gap: 24 }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
              <Text style={[styles.inputHint, { color: colors.mutedForeground, marginBottom: 0 }]}>SKIN TYPE</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {SKIN_TYPES.map(type => {
                const isSelected = draft.skinType === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    activeOpacity={0.7}
                    onPress={() => setDraft({ skinType: type.id as any })}
                    style={{
                      flexBasis: '48%',
                      flexGrow: 1,
                      backgroundColor: isSelected ? (colors.isDark ? '#374151' : '#e2e8f0') : colors.card,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.foreground : colors.border,
                      borderRadius: 12,
                      paddingVertical: 16,
                      alignItems: 'center',
                      position: 'relative'
                    }}
                  >
                    <Text style={{ fontSize: 20, marginBottom: 4 }}>{type.emoji}</Text>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.foreground }}>{type.label}</Text>
                    {isSelected && (
                      <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: colors.foreground, borderRadius: 10, padding: 2 }}>
                        <Feather name="check" size={10} color={colors.background} />
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
              <Text style={[styles.inputHint, { color: colors.mutedForeground, marginBottom: 0 }]}>ACTIVE ROUTINES</Text>
            </View>
            <View style={{}}>
              <ToggleRow title="🌙 Active retinoid routine" description="Tretinoin, retinal, retinol — paused when humid." value={draft.usesRetinoids} onValueChange={(v) => setDraft({ usesRetinoids: v })} />
              <ToggleRow title="🧴 Benzoyl peroxide" description="Can stain hotel linens." value={draft.usesBenzoylPeroxide} onValueChange={(v) => setDraft({ usesBenzoylPeroxide: v })} />
              <ToggleRow title="✨ Chemical exfoliants" description="AHA / BHA — paused on sunny days." value={draft.usesChemicalExfoliants} onValueChange={(v) => setDraft({ usesChemicalExfoliants: v })} />
              <ToggleRow title="🌸 Fragrance-free only" value={draft.fragranceFree} onValueChange={(v) => setDraft({ fragranceFree: v })} />
            </View>
          </View>
        </View>
      );
    }
    if (activeSheet === 'Diet') {
      // Safely ensure arrays exist in draft
      const draftAllergies = draft.allergies || [];
      const draftCustom = draft.customAllergies || [];

      const togglePredefined = (allergy: string) => {
        if (draftAllergies.includes(allergy)) {
          setDraft({ allergies: draftAllergies.filter((a: string) => a !== allergy) });
        } else {
          setDraft({ allergies: [...draftAllergies, allergy] });
        }
      };

      const addCustomAllergy = () => {
        const trimmed = customAllergyInput.trim();
        if (trimmed && !draftCustom.includes(trimmed)) {
          setDraft({ customAllergies: [...draftCustom, trimmed] });
          setCustomAllergyInput('');
        }
      };

      const removeCustomAllergy = (allergy: string) => {
        setDraft({ customAllergies: draftCustom.filter((a: string) => a !== allergy) });
      };

      return (
        <View style={{ gap: 24 }}>
          {/* Dietary Sensitivities (Toggles) */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
              <Text style={[styles.inputHint, { color: colors.mutedForeground, marginBottom: 0 }]}>SENSITIVITIES & DIET</Text>
            </View>
            <View style={{}}>
              <ToggleRow title="🧂 Sodium sensitive" description="Watch out for salty dishes." value={draft.sodiumSensitive} onValueChange={(v) => setDraft({ sodiumSensitive: v })} />
              <ToggleRow title="☕ Caffeine limit" description="Keep caffeine under ~200mg/day." value={draft.caffeineLimit} onValueChange={(v) => setDraft({ caffeineLimit: v })} />
              <ToggleRow title="🌾 Gluten-free" value={draft.glutenFree} onValueChange={(v) => setDraft({ glutenFree: v })} />
              <ToggleRow title="🥛 Dairy-free" value={draft.dairyFree} onValueChange={(v) => setDraft({ dairyFree: v })} />
            </View>
          </View>

          {/* Medical Allergies (Pill Grid) */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' }} />
              <Text style={[styles.inputHint, { color: colors.mutedForeground, marginBottom: 0 }]}>CLINICAL ALLERGIES</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PREDEFINED_ALLERGIES.map(allergy => {
                const isActive = draftAllergies.includes(allergy);
                const meta = ALLERGY_METADATA[allergy];
                const activeBg = colors.isDark ? meta.darkBg : meta.lightBg;
                const activeText = colors.isDark ? meta.darkText : meta.lightText;

                return (
                  <TouchableOpacity
                    key={allergy}
                    activeOpacity={0.7}
                    onPress={() => togglePredefined(allergy)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: isActive ? activeBg : colors.muted,
                      borderWidth: 1,
                      borderColor: isActive ? activeBg : colors.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Text style={{
                      fontFamily: 'Inter_500Medium',
                      fontSize: 13,
                      color: isActive ? activeText : colors.foreground
                    }}>
                      {meta.emoji} {allergy}
                    </Text>
                    {isActive && (
                      <Feather name="x" size={12} color={activeText} />
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Render Custom Added Allergies */}
              {draftCustom.map(allergy => (
                <TouchableOpacity
                  key={`custom-${allergy}`}
                  activeOpacity={0.7}
                  onPress={() => removeCustomAllergy(allergy)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: colors.isDark ? '#4c1d95' : '#ede9fe', // A subtle purple to indicate "custom"
                    borderWidth: 1,
                    borderColor: colors.isDark ? '#6d28d9' : '#c4b5fd',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.isDark ? '#ddd6fe' : '#5b21b6' }}>
                    {allergy}
                  </Text>
                  <Feather name="x" size={12} color={colors.isDark ? '#ddd6fe' : '#5b21b6'} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Input Field */}
            <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.foreground, paddingVertical: 10 }]}
                placeholder="Add other allergy..."
                placeholderTextColor={colors.mutedForeground}
                value={customAllergyInput}
                onChangeText={setCustomAllergyInput}
                onSubmitEditing={addCustomAllergy}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, width: 44, alignItems: 'center', justifyContent: 'center' }}
                onPress={addCustomAllergy}
              >
                <Feather name="plus" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }
    if (activeSheet === 'Travel') {
      const ACTIVITY_LEVELS = [
        { id: 'Low', label: 'Low', emoji: '🧘‍♂️' },
        { id: 'Moderate', label: 'Moderate', emoji: '🚶' },
        { id: 'High', label: 'High', emoji: '⛰️' },
      ];

      const TRAVEL_TYPES = [
        { id: 'Business', label: 'Business', emoji: '💼' },
        { id: 'Vacation', label: 'Vacation', emoji: '🌴' },
        { id: 'Adventure', label: 'Adventure', emoji: '🧭' },
        { id: 'Wellness', label: 'Wellness', emoji: '🌿' },
      ];

      return (
        <View style={{ gap: 24 }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
              <Text style={[styles.inputHint, { color: colors.mutedForeground, marginBottom: 0 }]}>ACTIVITY LEVEL</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {ACTIVITY_LEVELS.map(level => {
                const isSelected = draft.activityLevel === level.id;
                return (
                  <TouchableOpacity
                    key={level.id}
                    activeOpacity={0.7}
                    onPress={() => setDraft({ activityLevel: level.id as any })}
                    style={{
                      flexBasis: '30%',
                      flexGrow: 1,
                      backgroundColor: isSelected ? (colors.isDark ? '#374151' : '#e2e8f0') : colors.card,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.foreground : colors.border,
                      borderRadius: 12,
                      paddingVertical: 16,
                      alignItems: 'center',
                      position: 'relative'
                    }}
                  >
                    <Text style={{ fontSize: 20, marginBottom: 4 }}>{level.emoji}</Text>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.foreground }}>{level.label}</Text>
                    {isSelected && (
                      <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: colors.foreground, borderRadius: 10, padding: 2 }}>
                        <Feather name="check" size={10} color={colors.background} />
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
              <Text style={[styles.inputHint, { color: colors.mutedForeground, marginBottom: 0 }]}>TRAVEL TYPE</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {TRAVEL_TYPES.map(type => {
                const isSelected = draft.travelType === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    activeOpacity={0.7}
                    onPress={() => setDraft({ travelType: type.id as any })}
                    style={{
                      flexBasis: '48%',
                      flexGrow: 1,
                      backgroundColor: isSelected ? (colors.isDark ? '#374151' : '#e2e8f0') : colors.card,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.foreground : colors.border,
                      borderRadius: 12,
                      paddingVertical: 16,
                      alignItems: 'center',
                      position: 'relative'
                    }}
                  >
                    <Text style={{ fontSize: 20, marginBottom: 4 }}>{type.emoji}</Text>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.foreground }}>{type.label}</Text>
                    {isSelected && (
                      <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: colors.foreground, borderRadius: 10, padding: 2 }}>
                        <Feather name="check" size={10} color={colors.background} />
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        </View>
      );
    }
    if (activeSheet === 'Units') {
      const UNIT_TYPES = [
        { id: 'metric', label: 'metric', emoji: '📏' },
        { id: 'imperial', label: 'imperial', emoji: '📐' },
      ];

      return (
        <View style={{ gap: 24 }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.foreground }} />
              <Text style={[styles.inputHint, { color: colors.mutedForeground, marginBottom: 0 }]}>MEASUREMENT SYSTEM</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {UNIT_TYPES.map(type => {
                const isSelected = draft.units === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    activeOpacity={0.7}
                    onPress={() => setDraft({ units: type.id as any })}
                    style={{
                      flexBasis: '48%',
                      flexGrow: 1,
                      backgroundColor: isSelected ? (colors.isDark ? '#374151' : '#e2e8f0') : colors.card,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.foreground : colors.border,
                      borderRadius: 12,
                      paddingVertical: 16,
                      alignItems: 'center',
                      position: 'relative'
                    }}
                  >
                    <Text style={{ fontSize: 20, marginBottom: 4 }}>{type.emoji}</Text>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.foreground }}>{type.label}</Text>
                    {isSelected && (
                      <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: colors.foreground, borderRadius: 10, padding: 2 }}>
                        <Feather name="check" size={10} color={colors.background} />
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        </View>
      );
    }
    if (activeSheet === 'Languages') {
      const LANGUAGE_OPTIONS = [
        { id: 'en', label: 'English', emoji: '🇬🇧' },
        { id: 'ja', label: 'Japanese', emoji: '🇯🇵' },
        { id: 'es', label: 'Spanish', emoji: '🇪🇸' },
        { id: 'fr', label: 'French', emoji: '🇫🇷' },
        { id: 'it', label: 'Italian', emoji: '🇮🇹' },
        { id: 'de', label: 'German', emoji: '🇩🇪' },
        { id: 'ko', label: 'Korean', emoji: '🇰🇷' },
        { id: 'zh', label: 'Chinese', emoji: '🇨🇳' },
        { id: 'vi', label: 'Vietnamese', emoji: '🇻🇳' },
        { id: 'ru', label: 'Russian', emoji: '🇷🇺' },
        { id: 'pt', label: 'Portuguese', emoji: '🇵🇹' },
      ];

      const languageColumns = [];
      for (let i = 0; i < LANGUAGE_OPTIONS.length; i += 2) {
        languageColumns.push(LANGUAGE_OPTIONS.slice(i, i + 2));
      }

      return (
        <View style={{ gap: 24 }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
              <Text style={[styles.inputHint, { color: colors.mutedForeground, marginBottom: 0 }]}>TRANSLATE FROM</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
              {languageColumns.map((column, colIndex) => (
                <View key={`source-col-${colIndex}`} style={{ gap: 10, width: 105 }}>
                  {column.map(lang => {
                    const isSelected = draft.scanSourceLanguage === lang.id;
                    return (
                      <TouchableOpacity
                        key={`source-${lang.id}`}
                        activeOpacity={0.7}
                        onPress={() => setDraft({ scanSourceLanguage: lang.id })}
                        style={{
                          flexGrow: 1,
                          backgroundColor: isSelected ? (colors.isDark ? '#374151' : '#e2e8f0') : colors.card,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.foreground : colors.border,
                          borderRadius: 12,
                          paddingVertical: 12,
                          alignItems: 'center',
                          position: 'relative'
                        }}
                      >
                        <Text style={{ fontSize: 20, marginBottom: 4 }}>{lang.emoji}</Text>
                        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: colors.foreground }}>{lang.label}</Text>
                        {isSelected && (
                          <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: colors.foreground, borderRadius: 10, padding: 2 }}>
                            <Feather name="check" size={10} color={colors.background} />
                          </View>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ))}
            </ScrollView>
          </View>

          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.foreground }} />
              <Text style={[styles.inputHint, { color: colors.mutedForeground, marginBottom: 0 }]}>TRANSLATE TO</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
              {languageColumns.map((column, colIndex) => (
                <View key={`target-col-${colIndex}`} style={{ gap: 10, width: 105 }}>
                  {column.map(lang => {
                    const isSelected = draft.scanTargetLanguage === lang.id;
                    return (
                      <TouchableOpacity
                        key={`target-${lang.id}`}
                        activeOpacity={0.7}
                        onPress={() => setDraft({ scanTargetLanguage: lang.id })}
                        style={{
                          flexGrow: 1,
                          backgroundColor: isSelected ? (colors.isDark ? '#374151' : '#e2e8f0') : colors.card,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.foreground : colors.border,
                          borderRadius: 12,
                          paddingVertical: 12,
                          alignItems: 'center',
                          position: 'relative'
                        }}
                      >
                        <Text style={{ fontSize: 20, marginBottom: 4 }}>{lang.emoji}</Text>
                        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: colors.foreground }}>{lang.label}</Text>
                        {isSelected && (
                          <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: colors.foreground, borderRadius: 10, padding: 2 }}>
                            <Feather name="check" size={10} color={colors.background} />
                          </View>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      );
    }
    if (activeSheet === 'About') {
      return (
        <View style={{ gap: 18 }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.foreground, lineHeight: 20 }}>
            ThinkTrip bridges the gap between arriving and belonging. Before departure, the planning engine synthesizes environmental conditions with your health baseline to generate a calibrated packing protocol. During your trip, the app provides real-time, context-aware intelligence on local dining etiquette, payment norms, and transit systems, equipping you to navigate the world with precision and confidence.
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.mutedForeground }}>
            Version 1.0.0
          </Text>
        </View>
      );
    }
    if (activeSheet === 'Theme') {
      const THEME_TYPES = [
        { id: 'system', label: 'system', emoji: '⚙️' },
        { id: 'light', label: 'light', emoji: '☀️' },
        { id: 'dark', label: 'dark', emoji: '🌙' },
      ];

      return (
        <View style={{ gap: 24 }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.foreground }} />
              <Text style={[styles.inputHint, { color: colors.mutedForeground, marginBottom: 0 }]}>APP THEME</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {THEME_TYPES.map(type => {
                const isSelected = (draft.themePreference || 'system') === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    activeOpacity={0.7}
                    onPress={() => setDraft({ themePreference: type.id as any })}
                    style={{
                      flexBasis: '30%',
                      flexGrow: 1,
                      backgroundColor: isSelected ? (colors.isDark ? '#374151' : '#e2e8f0') : colors.card,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.foreground : colors.border,
                      borderRadius: 12,
                      paddingVertical: 16,
                      alignItems: 'center',
                      position: 'relative'
                    }}
                  >
                    <Text style={{ fontSize: 20, marginBottom: 4 }}>{type.emoji}</Text>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.foreground }}>{type.label}</Text>
                    {isSelected && (
                      <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: colors.foreground, borderRadius: 10, padding: 2 }}>
                        <Feather name="check" size={10} color={colors.background} />
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.mutedForeground, textAlign: 'center', marginTop: 12 }}>
              System mode matches your device settings.
            </Text>
          </View>
        </View>
      );
    }
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const skinActiveCount = [profile.usesRetinoids, profile.usesBenzoylPeroxide, profile.usesChemicalExfoliants, profile.fragranceFree].filter(Boolean).length;
  const dietActiveCount = [profile.sodiumSensitive, profile.caffeineLimit, profile.glutenFree, profile.dairyFree].filter(Boolean).length + (profile.allergies?.length || 0) + (profile.customAllergies?.length || 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: insets.top || 16,
          paddingBottom: insets.bottom + 84 + 16,
          gap: 6
        }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={[styles.identityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: profile.avatarColor || colors.primary }]}>
            {profile.avatarEmoji ? (
              <Text style={{ fontSize: 28 }}>{profile.avatarEmoji}</Text>
            ) : (
              <Text style={[styles.avatarText, { color: colors.accent }]}>{getInitials(profile.displayName)}</Text>
            )}
          </View>
          <View style={styles.identityTextCol}>
            <Text
              style={[styles.identityName, { color: colors.foreground }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >
              {profile.displayName || 'Set up profile'}
            </Text>
            {profile.email ? <Text style={[styles.identityEmail, { color: colors.mutedForeground }]}>{profile.email}</Text> : null}
            <View style={styles.identityMeta}>
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={[styles.identityCity, { color: colors.mutedForeground }]}>{profile.homeCity || 'Add home city'}</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.editBtn, { borderColor: colors.border }]} onPress={() => setActiveSheet('Account')}>
            <Feather name="edit-2" size={14} color={colors.foreground} />
          </TouchableOpacity>
        </Card>

        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, marginLeft: 4 }}>
            {/* <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mutedForeground }} /> */}
            <Text style={[styles.groupTitle, { color: colors.mutedForeground, marginBottom: 0, marginLeft: 0 }]}>HEALTH BASELINE</Text>
          </View>
          <View style={{ gap: 6 }}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveSheet('Skin')}
              style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.healthIconBox, { backgroundColor: colors.muted }]}>
                <Feather name="droplet" size={20} color={colors.foreground} />
              </View>
              <View style={styles.healthTextCol}>
                <Text style={[styles.healthLabel, { color: colors.foreground }]}>Skin & body</Text>
                <Text style={[styles.healthDesc, { color: colors.mutedForeground }]}>{`${capitalize(profile.skinType)}${skinActiveCount > 0 ? ` • ${skinActiveCount} active` : ''}`}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveSheet('Diet')}
              style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.healthIconBox, { backgroundColor: colors.muted }]}>
                <Feather name="shield" size={20} color={colors.foreground} />
              </View>
              <View style={styles.healthTextCol}>
                <Text style={[styles.healthLabel, { color: colors.foreground }]}>Diet & allergies</Text>
                <Text style={[styles.healthDesc, { color: colors.mutedForeground }]}>{dietActiveCount > 0 ? `${dietActiveCount} restriction(s) active` : 'None set'}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveSheet('Travel')}
              style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.healthIconBox, { backgroundColor: colors.muted }]}>
                <Feather name="compass" size={20} color={colors.foreground} />
              </View>
              <View style={styles.healthTextCol}>
                <Text style={[styles.healthLabel, { color: colors.foreground }]}>Travel context</Text>
                <Text style={[styles.healthDesc, { color: colors.mutedForeground }]}>{`${capitalize(profile.travelType)} • ${capitalize(profile.activityLevel)} activity`}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, marginLeft: 4 }}>
            {/* <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mutedForeground }} /> */}
            <Text style={[styles.groupTitle, { color: colors.mutedForeground, marginBottom: 0, marginLeft: 0 }]}>APP PREFERENCES</Text>
          </View>
          <View style={{ gap: 6 }}>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveSheet('Units')}
              style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.healthIconBox, { backgroundColor: colors.muted }]}>
                <Feather name="globe" size={20} color={colors.foreground} />
              </View>
              <View style={styles.healthTextCol}>
                <Text style={[styles.healthLabel, { color: colors.foreground }]}>Units</Text>
                <Text style={[styles.healthDesc, { color: colors.mutedForeground }]}>{capitalize(profile.units)}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveSheet('Languages')}
              style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.healthIconBox, { backgroundColor: colors.muted }]}>
                <Feather name="type" size={20} color={colors.foreground} />
              </View>
              <View style={styles.healthTextCol}>
                <Text style={[styles.healthLabel, { color: colors.foreground }]}>Scan Languages</Text>
                <Text style={[styles.healthDesc, { color: colors.mutedForeground }]}>{profile.scanSourceLanguage?.toUpperCase()} → {profile.scanTargetLanguage?.toUpperCase()}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleToggleLocationRouting(!profile.locationRoutingEnabled)}
              style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.healthIconBox, { backgroundColor: colors.muted }]}>
                <Feather name="navigation" size={20} color={colors.foreground} />
              </View>
              <View style={styles.healthTextCol}>
                <Text style={[styles.healthLabel, { color: colors.foreground }]}>Location Services</Text>
                <Text style={[styles.healthDesc, { color: colors.mutedForeground }]}>{profile.locationRoutingEnabled ? 'Enabled' : 'Disabled'}</Text>
              </View>
              <View pointerEvents="none">
                <Switch
                  value={draft.locationRoutingEnabled ?? profile.locationRoutingEnabled}
                  trackColor={{ true: colors.primary }}
                  thumbColor="#ffffff"
                  ios_backgroundColor={colors.border}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                const newValue = !profile.hapticsEnabled;
                setDraft({ hapticsEnabled: newValue });
                save({ hapticsEnabled: newValue });
              }}
              style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.healthIconBox, { backgroundColor: colors.muted }]}>
                <Feather name="zap" size={20} color={colors.foreground} />
              </View>
              <View style={styles.healthTextCol}>
                <Text style={[styles.healthLabel, { color: colors.foreground }]}>Haptic feedback</Text>
                <Text style={[styles.healthDesc, { color: colors.mutedForeground }]}>{profile.hapticsEnabled ? 'On' : 'Off'}</Text>
              </View>
              <View pointerEvents="none">
                <Switch
                  value={draft.hapticsEnabled ?? profile.hapticsEnabled}
                  trackColor={{ true: colors.primary }}
                  thumbColor="#ffffff"
                  ios_backgroundColor={colors.border}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveSheet('Theme')}
              style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.healthIconBox, { backgroundColor: colors.muted }]}>
                <Feather name="moon" size={20} color={colors.foreground} />
              </View>
              <View style={styles.healthTextCol}>
                <Text style={[styles.healthLabel, { color: colors.foreground }]}>Appearance</Text>
                <Text style={[styles.healthDesc, { color: colors.mutedForeground }]}>{capitalize(profile.themePreference || 'system')}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>

          </View>
        </View>

        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, marginLeft: 4 }}>
            {/* <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mutedForeground }} /> */}
            <Text style={[styles.groupTitle, { color: colors.mutedForeground, marginBottom: 0, marginLeft: 0 }]}>SUPPORT & DATA</Text>
          </View>
          <View style={{ gap: 6 }}>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleOpenLink('https://thinktrip.app/privacy')}
              style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.healthIconBox, { backgroundColor: colors.muted }]}>
                <Feather name="shield" size={20} color={colors.foreground} />
              </View>
              <View style={styles.healthTextCol}>
                <Text style={[styles.healthLabel, { color: colors.foreground }]}>Privacy Policy</Text>
                <Text style={[styles.healthDesc, { color: colors.mutedForeground }]}>How we protect your data</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleExportData}
              style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.healthIconBox, { backgroundColor: colors.muted }]}>
                <Feather name="download" size={20} color={colors.foreground} />
              </View>
              <View style={styles.healthTextCol}>
                <Text style={[styles.healthLabel, { color: colors.foreground }]}>Export my data</Text>
                <Text style={[styles.healthDesc, { color: colors.mutedForeground }]}>Download a copy of everything</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleOpenLink('https://thinktrip.app/help')}
              style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.healthIconBox, { backgroundColor: colors.muted }]}>
                <Feather name="help-circle" size={20} color={colors.foreground} />
              </View>
              <View style={styles.healthTextCol}>
                <Text style={[styles.healthLabel, { color: colors.foreground }]}>Help center</Text>
                <Text style={[styles.healthDesc, { color: colors.mutedForeground }]}>FAQs and support articles</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleOpenLink('https://forms.gle/tCYfmomQQv6Wzm7Y8')}
              style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.healthIconBox, { backgroundColor: colors.muted }]}>
                <Feather name="message-square" size={20} color={colors.foreground} />
              </View>
              <View style={styles.healthTextCol}>
                <Text style={[styles.healthLabel, { color: colors.foreground }]}>Send feedback</Text>
                <Text style={[styles.healthDesc, { color: colors.mutedForeground }]}>Report bugs or request features</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveSheet('About')}
              style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.healthIconBox, { backgroundColor: colors.muted }]}>
                <Feather name="info" size={20} color={colors.foreground} />
              </View>
              <View style={styles.healthTextCol}>
                <Text style={[styles.healthLabel, { color: colors.foreground }]}>About</Text>
                <Text style={[styles.healthDesc, { color: colors.mutedForeground }]}>ThinkTrip • v1.0.0</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>

          </View>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.mutedForeground, textAlign: 'center', marginTop: 24 }}>
            ThinkTrip • v1.0.0 (build 1)
          </Text>
        </View>

        <TouchableOpacity style={[styles.signOutBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={handleSignOut}>
          <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>

      {showToast && (
        <View style={[
          styles.toast,
          {
            backgroundColor: colors.primary,
            bottom: Platform.OS === 'ios' ? insets.bottom + 100 : insets.bottom
          }
        ]}>
          <Feather name="check" size={14} color={colors.primaryForeground} />
          <Text style={[styles.toastText, { color: colors.primaryForeground }]}>Saved</Text>
        </View>
      )}

      {/* Edit Sheet Modal */}
      <Modal visible={activeSheet !== null} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.sheetBackdrop}>
            <View style={{ flex: 1 }} onTouchEnd={handleCancel} />

            <View style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                paddingBottom: insets.bottom + 20,
                maxHeight: '90%' // Caps the sheet height on massive phones
              }
            ]}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]} />

              <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={handleCancel} style={{ flex: 1 }}>
                  <Text style={[styles.sheetActionText, { color: colors.mutedForeground }]}>Cancel</Text>
                </TouchableOpacity>

                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{activeSheet}</Text>

                <TouchableOpacity onPress={handleSave} disabled={!isDirty || activeSheet === 'About' || isSaving} style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[styles.sheetActionText, { color: (!isDirty || activeSheet === 'About' || isSaving) ? colors.muted : colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
                    {isSaving ? 'Validating...' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* UPDATE: Replaced fixed Dimensions maxHeight with flexShrink */}
              <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
                {renderSheetContent()}
              </ScrollView>

            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  identityCard: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16, marginBottom: 18 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.5 },
  identityTextCol: { flex: 1, gap: 2 },
  identityName: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.3 },
  identityEmail: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  identityMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  identityCity: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  editBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  signOutBtn: { width: '100%', paddingVertical: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center', marginBottom: 20 },
  signOutText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },

  healthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  healthIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  healthTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  healthLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  healthDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
  },

  toast: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  toastText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetActionText: { fontFamily: 'Inter_500Medium', fontSize: 15 },
  sheetTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },

  inputHint: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  groupTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  hintTop: { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_500Medium', fontSize: 15 },
  errorText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 6,
  },
});
