import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, KeyboardAvoidingView, Platform, Alert, Modal, Share, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
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

const AVATAR_COLORS = [
  '#0d3b3a', '#1d4e89', '#a76b18', '#15803d', '#c2410c', '#b91c1c', 
  '#4338ca', '#6b21a8', '#be185d', '#0f766e', '#3f6212', '#1e3a8a', 
  '#581c87', '#9f1239', '#b45309', '#475569'
];

const AVATAR_EMOJIS = [
  '✈️', '🌴', '☕️', '⛰️', '📸', '🌊', '🦊', '🦉', 
  '🌵', '🍣', '🍷', '🏕️', '🌅', '🚲', '🍕', '🏄'
];

type SheetType = 'Account' | 'Skin' | 'Diet' | 'Travel' | 'Units' | 'About' | null;

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, draft, isDirty, setDraft, save, reset } = useProfile();
  const { signOut } = useAuth();

  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [showToast, setShowToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);

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

  const handleToggleLiveAlerts = async (value: boolean) => {
    if (!value) {
      setDraft({ liveAlertsEnabled: false });
      save({ liveAlertsEnabled: false });
      return;
    }

    try {
      const { status: notifStatus } = await Notifications.requestPermissionsAsync();
      if (notifStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable notifications in your device settings to receive live alerts.');
        setDraft({ liveAlertsEnabled: false });
        return;
      }

      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location services in your device settings to receive context-aware live alerts.');
        setDraft({ liveAlertsEnabled: false });
        return;
      }

      let token = '';
      if (Platform.OS !== 'web') {
        try {
          const projectId = Constants.expoConfig?.extra?.eas?.projectId;
          if (projectId) {
            const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
            token = tokenData.data;
          }
        } catch (e) {
          console.warn('Could not fetch Expo Push Token (expected in Expo Go):', e);
        }
      }

      setDraft({
        liveAlertsEnabled: true,
        expoPushToken: token
      });
      await save({
        liveAlertsEnabled: true,
        expoPushToken: token
      });

      if (Platform.OS !== 'web' && profile.hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

    } catch (error) {
      console.error('Error enabling live alerts:', error);
      Alert.alert('Error', 'Failed to enable live alerts.');
      setDraft({ liveAlertsEnabled: false });
      save({ liveAlertsEnabled: false });
    }
  };

  const renderSheetContent = () => {
    if (activeSheet === 'Account') {
      return (
        <View style={{ gap: 24 }}>
          <View>
            <Text style={[styles.inputHint, { color: colors.mutedForeground, marginBottom: 8 }]}>PROFILE COLOR</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
              {AVATAR_COLORS.map(color => (
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
            </ScrollView>
          </View>

          <View>
            <Text style={[styles.inputHint, { color: colors.mutedForeground, marginBottom: 8 }]}>AVATAR ICON</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              <TouchableOpacity
                onPress={() => setDraft({ avatarEmoji: '' })}
                style={{
                  width: 48, height: 48, borderRadius: 24,
                  backgroundColor: !draft.avatarEmoji ? 'rgba(0,0,0,0.05)' : 'transparent',
                  borderWidth: !draft.avatarEmoji ? 2 : 1,
                  borderColor: !draft.avatarEmoji ? colors.primary : colors.border,
                  alignItems: 'center', justifyContent: 'center'
                }}
              >
                <Text style={{ fontSize: 14, color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }}>A B</Text>
              </TouchableOpacity>
              {AVATAR_EMOJIS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => setDraft({ avatarEmoji: emoji })}
                  style={{
                    width: 48, height: 48, borderRadius: 24,
                    backgroundColor: draft.avatarEmoji === emoji ? 'rgba(0,0,0,0.05)' : 'transparent',
                    borderWidth: draft.avatarEmoji === emoji ? 2 : 1,
                    borderColor: draft.avatarEmoji === emoji ? colors.primary : colors.border,
                    alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{emoji}</Text>
                </TouchableOpacity>
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
            <Text style={[styles.hintTop, { color: colors.mutedForeground }]}>Used to detect timezone shifts and jet lag.</Text>
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
      return (
        <View style={{ gap: 18 }}>
          <SegmentedControl
            options={['dry', 'combination', 'oily', 'reactive']}
            value={draft.skinType}
            onChange={(v: any) => setDraft({ skinType: v })}
          />
          <View style={{ marginTop: 8 }}>
            <ToggleRow title="Active retinoid routine" description="Tretinoin, retinal, retinol — paused on humid trips." value={draft.usesRetinoids} onValueChange={(v) => setDraft({ usesRetinoids: v })} />
            <ToggleRow title="Benzoyl peroxide" description="Will warn about staining hotel linens." value={draft.usesBenzoylPeroxide} onValueChange={(v) => setDraft({ usesBenzoylPeroxide: v })} />
            <ToggleRow title="Chemical exfoliants" description="AHA / BHA — paused under high UV." value={draft.usesChemicalExfoliants} onValueChange={(v) => setDraft({ usesChemicalExfoliants: v })} />
            <ToggleRow title="Fragrance-free only" value={draft.fragranceFree} onValueChange={(v) => setDraft({ fragranceFree: v })} />
          </View>
        </View>
      );
    }
    if (activeSheet === 'Diet') {
      return (
        <View style={{ gap: 12 }}>
          <ToggleRow title="Sodium sensitive" description="Flags broths, soy-heavy dishes, and processed meats." value={draft.sodiumSensitive} onValueChange={(v) => setDraft({ sodiumSensitive: v })} />
          <ToggleRow title="Caffeine limit" description="Caps recommendations at ~200mg/day." value={draft.caffeineLimit} onValueChange={(v) => setDraft({ caffeineLimit: v })} />
          <ToggleRow title="Gluten-free" value={draft.glutenFree} onValueChange={(v) => setDraft({ glutenFree: v })} />
          <ToggleRow title="Dairy-free" value={draft.dairyFree} onValueChange={(v) => setDraft({ dairyFree: v })} />
          <ToggleRow title="Shellfish allergy" value={draft.shellfishAllergy} onValueChange={(v) => setDraft({ shellfishAllergy: v })} />
          <ToggleRow title="Peanut allergy" value={draft.peanutAllergy} onValueChange={(v) => setDraft({ peanutAllergy: v })} />
        </View>
      );
    }
    if (activeSheet === 'Travel') {
      return (
        <View style={{ gap: 24 }}>
          <View>
            <Text style={[styles.inputHint, { color: colors.mutedForeground, marginBottom: 8 }]}>ACTIVITY LEVEL</Text>
            <SegmentedControl options={['low', 'moderate', 'high']} value={draft.activityLevel} onChange={(v: any) => setDraft({ activityLevel: v })} />
          </View>
          <View>
            <Text style={[styles.inputHint, { color: colors.mutedForeground, marginBottom: 8 }]}>TRAVEL TYPE</Text>
            <SegmentedControl options={['business', 'vacation', 'adventure', 'wellness']} value={draft.travelType} onChange={(v: any) => setDraft({ travelType: v })} />
          </View>
        </View>
      );
    }
    if (activeSheet === 'Units') {
      return (
        <View style={{ gap: 18 }}>
          <SegmentedControl options={['metric', 'imperial']} value={draft.units} onChange={(v: any) => setDraft({ units: v })} />
        </View>
      );
    }
    if (activeSheet === 'About') {
      return (
        <View style={{ gap: 18 }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.foreground, lineHeight: 20 }}>
            ThinkTrip is a real-time, biometrically-aware travel OS. It tunes climate analysis, packing suggestions, and on-the-ground decoding to your body's baseline.
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.mutedForeground }}>
            Version 1.0.0 (build 1)
          </Text>
        </View>
      );
    }
    return null;
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const skinActiveCount = [profile.usesRetinoids, profile.usesBenzoylPeroxide, profile.usesChemicalExfoliants, profile.fragranceFree].filter(Boolean).length;
  const dietActiveCount = [profile.sodiumSensitive, profile.caffeineLimit, profile.glutenFree, profile.dairyFree, profile.shellfishAllergy, profile.peanutAllergy].filter(Boolean).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: insets.top || 16,
          paddingBottom: insets.bottom + 84 + 16,
          gap: 18
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
            <Text style={[styles.identityName, { color: colors.foreground }]}>{profile.displayName || 'Set up profile'}</Text>
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

        <SettingsGroup title="HEALTH BASELINE">
          <SettingsRow
            icon={<Feather name="droplet" size={16} color="#1d4e89" />}
            iconBackgroundColor="#e9eef3"
            label="Skin & body"
            description={`${capitalize(profile.skinType)}${skinActiveCount > 0 ? ` • ${skinActiveCount} active` : ''}`}
            rightElement={<Feather name="chevron-right" size={20} color={colors.mutedForeground} />}
            onPress={() => setActiveSheet('Skin')}
          />
          <SettingsRow
            icon={<Feather name="coffee" size={16} color="#a76b18" />}
            iconBackgroundColor="#f5e9d6"
            label="Diet & allergies"
            description={dietActiveCount > 0 ? `${dietActiveCount} restriction(s) active` : 'None set'}
            rightElement={<Feather name="chevron-right" size={20} color={colors.mutedForeground} />}
            onPress={() => setActiveSheet('Diet')}
          />
          <SettingsRow
            icon={<Feather name="briefcase" size={16} color="#15803d" />}
            iconBackgroundColor="#e6f0ec"
            label="Travel context"
            description={`${capitalize(profile.travelType)} • ${capitalize(profile.activityLevel)} activity`}
            rightElement={<Feather name="chevron-right" size={20} color={colors.mutedForeground} />}
            onPress={() => setActiveSheet('Travel')}
          />
        </SettingsGroup>

        <SettingsGroup title="APP PREFERENCES">
          <SettingsRow
            icon={<Feather name="globe" size={16} color={colors.foreground} />}
            label="Units"
            rightElement={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.mutedForeground }}>{capitalize(profile.units)}</Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </View>
            }
            onPress={() => setActiveSheet('Units')}
          />
          <SettingsRow
            icon={<Feather name="alert-circle" size={16} color={colors.foreground} />}
            label="Live alerts"
            description="Extreme weather and pollution warnings based on your location."
            // Make the whole row tappable
            onPress={() => handleToggleLiveAlerts(!profile.liveAlertsEnabled)}
            rightElement={
              <Switch
                value={profile.liveAlertsEnabled}
                onValueChange={handleToggleLiveAlerts}
                trackColor={{ true: colors.primary }}
              />
            }
          />
          <SettingsRow
            icon={<Feather name="zap" size={16} color={colors.foreground} />}
            label="Haptic feedback"
            // Make the whole row tappable
            onPress={() => {
              const newValue = !profile.hapticsEnabled;
              setDraft({ hapticsEnabled: newValue });
              save({ hapticsEnabled: newValue });
            }}
            rightElement={
              <Switch
                value={profile.hapticsEnabled}
                onValueChange={(v) => { setDraft({ hapticsEnabled: v }); save({ hapticsEnabled: v }); }}
                trackColor={{ true: colors.primary }}
              />
            }
          />
        </SettingsGroup>

        <SettingsGroup title="PRIVACY & DATA">
          <SettingsRow icon={<Feather name="shield" size={16} color={colors.foreground} />} label="Privacy" rightElement={<Feather name="chevron-right" size={20} color={colors.mutedForeground} />} onPress={() => handleOpenLink('https://thinktrip.app/privacy')} />
          <SettingsRow icon={<Feather name="download" size={16} color={colors.foreground} />} label="Export my data" rightElement={<Feather name="chevron-right" size={20} color={colors.mutedForeground} />} onPress={handleExportData} />
          {/* <SettingsRow 
            icon={<Feather name="trash-2" size={16} color={colors.destructive} />} 
            iconBackgroundColor="#fbe7da"
            label="Clear all trip history" 
            rightElement={<Feather name="chevron-right" size={20} color={colors.mutedForeground} />} 
          /> */}
        </SettingsGroup>

        <SettingsGroup footnote="ThinkTrip • v1.0.0 (build 1)">
          <SettingsRow icon={<Feather name="help-circle" size={16} color={colors.foreground} />} label="Help center" rightElement={<Feather name="chevron-right" size={20} color={colors.mutedForeground} />} onPress={() => handleOpenLink('https://thinktrip.app/help')} />
          <SettingsRow icon={<Feather name="message-square" size={16} color={colors.foreground} />} label="Send feedback" rightElement={<Feather name="chevron-right" size={20} color={colors.mutedForeground} />} onPress={() => handleOpenLink('mailto:support@thinktrip.app?subject=ThinkTrip%20Feedback')} />
          <SettingsRow icon={<Feather name="info" size={16} color={colors.foreground} />} label="About" rightElement={<Feather name="chevron-right" size={20} color={colors.mutedForeground} />} onPress={() => setActiveSheet('About')} />
        </SettingsGroup>

        <TouchableOpacity style={[styles.signOutBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={handleSignOut}>
          <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>

      {showToast && (
        <View style={[styles.toast, { backgroundColor: colors.primary, bottom: insets.bottom + 100 }]}>
          <Feather name="check" size={14} color={colors.accent} />
          <Text style={[styles.toastText, { color: colors.accent }]}>Saved</Text>
        </View>
      )}

      {/* Edit Sheet Modal */}
      <Modal visible={activeSheet !== null} transparent animationType="fade">
        <View style={styles.sheetBackdrop}>
          <View style={{ flex: 1 }} onTouchEnd={handleCancel} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={handleCancel} style={{ flex: 1 }}><Text style={[styles.sheetActionText, { color: colors.mutedForeground }]}>Cancel</Text></TouchableOpacity>
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{activeSheet}</Text>
                <TouchableOpacity onPress={handleSave} disabled={!isDirty || activeSheet === 'About' || isSaving} style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[styles.sheetActionText, { color: (!isDirty || activeSheet === 'About' || isSaving) ? colors.muted : colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
                    {isSaving ? 'Validating...' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 540 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
                {renderSheetContent()}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
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
  identityCity: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  editBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  signOutBtn: { width: '100%', paddingVertical: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center', marginBottom: 20 },
  signOutText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },

  toast: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  toastText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 },
  sheetHandle: { width: 38, height: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.1)' },
  sheetActionText: { fontFamily: 'Inter_500Medium', fontSize: 15 },
  sheetTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },

  inputHint: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.4, marginTop: 8 },
  hintTop: { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_500Medium', fontSize: 15 },
  errorText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 6,
  },
});
