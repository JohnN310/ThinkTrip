import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, ActivityIndicator, Platform, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { useColors } from '../hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CountryData {
  name: string;
  iso_a2: string;
}

interface CountryInfo {
  cca3: string;
  subregion: string;
  capital: string;
  language: string;
  currency: string;
  currencySymbol: string;
  timezone: string;
  flagUrl: string;
  description: string;
  imageUrl: string;
}

interface CountrySelectModalProps {
  visible: boolean;
  country: CountryData | null;
  onClose: () => void;
  onSelect: (cityName: string) => void;
}

export default function CountrySelectModal({ visible, country, onClose, onSelect }: CountrySelectModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<CountryInfo | null>(null);
  const slideAnim = useRef(new Animated.Value(600)).current;

  // Dynamic design tokens based on system/app theme
  const isDark = colors.isDark;
  const theme = {
    background: isDark ? '#09090B' : '#FFFFFF',
    card: isDark ? '#18181B' : '#F8FAFC',
    border: isDark ? '#27272A' : '#E5E7EB',
    primary: isDark ? '#A855F7' : '#8B5CF6',
    primaryLight: isDark ? 'rgba(168, 85, 247, 0.15)' : 'rgba(139, 92, 246, 0.15)',
    textPrimary: isDark ? '#FAFAFA' : '#111827',
    textSecondary: isDark ? '#A1A1AA' : '#6B7280',
  };

  useEffect(() => {
    if (visible && country) {
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 22,
        stiffness: 180,
        useNativeDriver: true,
      }).start();

      fetchCountryInfo(country.iso_a2);
    } else {
      Animated.timing(slideAnim, {
        toValue: 800,
        duration: 250,
        useNativeDriver: true,
      }).start();
      setTimeout(() => setInfo(null), 250);
    }
  }, [visible, country]);

  const fetchCountryInfo = async (isoCode: string) => {
    setLoading(true);
    try {
      const response = await fetch(`https://restcountries.com/v3.1/alpha/${isoCode}`);
      const data = await response.json();
      if (data && data[0]) {
        const c = data[0];
        const currencyKey = c.currencies ? Object.keys(c.currencies)[0] : null;

        setInfo({
          cca3: c.cca3 || 'N/A',
          subregion: c.subregion || 'Unknown Region',
          capital: c.capital ? c.capital[0] : 'Unknown',
          language: c.languages ? Object.values(c.languages)[0] as string : 'Unknown',
          currency: currencyKey ? (c.currencies[currencyKey].name) : 'Unknown',
          currencySymbol: currencyKey ? (c.currencies[currencyKey].symbol || currencyKey) : '',
          timezone: c.timezones ? c.timezones[0] : 'GMT',
          flagUrl: c.flags?.png || '',
          description: `${c.name.common} is renowned for its art, fashion, cuisine, and rich history. From romantic streets to sunny coastlines, it offers a blend of culture and charm.`,
          imageUrl: `https://picsum.photos/seed/${c.name.common}/400/400`,
        });
      }
    } catch (e) {
      console.warn("Failed to fetch country info", e);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 800,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  const Backdrop = Platform.OS === 'ios' ? BlurView : View;
  const backdropProps = Platform.OS === 'ios' ? { intensity: 60, tint: isDark ? 'dark' : 'light' } : { style: { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)', flex: 1 } };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={handleClose}>
          <Backdrop {...backdropProps as any} style={StyleSheet.absoluteFillObject} />
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.background,
              transform: [{ translateY: slideAnim }],
              paddingBottom: Math.max(insets.bottom, 24)
            }
          ]}
        >
          <View style={[styles.handle, { backgroundColor: isDark ? '#333344' : '#D1D5DB' }]} />

          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.card }]} onPress={handleClose}>
            <Feather name="x" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          {country && (
            <View style={styles.heroSection}>
              {info?.flagUrl ? (
                <View style={[styles.flagWrapper, { borderColor: theme.primary }]}>
                  <Image source={{ uri: info.flagUrl }} style={styles.flagImage} />
                </View>
              ) : (
                <View style={[styles.flagWrapper, { borderColor: theme.primary, backgroundColor: theme.card }]} />
              )}
              <Text style={[styles.title, { color: theme.textPrimary }]}>{country.name}</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {info ? info.subregion : 'Loading...'}
              </Text>
            </View>
          )}

          {loading ? (
            <View style={styles.loaderArea}>
              <ActivityIndicator color={theme.primary} size="large" />
            </View>
          ) : info ? (
            <View style={styles.content}>

              {/* 2x2 Stats Grid Architecture */}
              <View style={[styles.statsGrid, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={[styles.statsRow, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                  <View style={[styles.statCell, { borderRightWidth: 1, borderRightColor: theme.border }]}>
                    <Text style={[styles.statValue, { color: theme.textPrimary }]} numberOfLines={1}>{info.capital}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Capital</Text>
                  </View>
                  <View style={styles.statCell}>
                    <Text style={[styles.statValue, { color: theme.textPrimary }]} numberOfLines={1}>{info.language}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Language</Text>
                  </View>
                </View>
                <View style={styles.statsRow}>
                  <View style={[styles.statCell, { borderRightWidth: 1, borderRightColor: theme.border }]}>
                    <Text style={[styles.statValue, { color: theme.textPrimary }]} numberOfLines={1}>{info.currency.split(' ')[0]}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Currency</Text>
                  </View>
                  <View style={styles.statCell}>
                    <Text style={[styles.statValue, { color: theme.textPrimary }]} numberOfLines={1}>{info.timezone}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Timezone</Text>
                  </View>
                </View>
              </View>

              {/* About Card */}
              <View style={[styles.aboutCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Image source={{ uri: info.imageUrl }} style={styles.aboutImage} />
                <View style={styles.aboutContent}>
                  <Text style={[styles.aboutTitle, { color: theme.textPrimary }]}>About {country?.name}</Text>
                  <Text style={[styles.aboutDesc, { color: theme.textSecondary }]} numberOfLines={5}>
                    {info.description}
                  </Text>
                </View>
              </View>

              {/* Action Button */}
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary }]}
                onPress={() => onSelect(country?.name || '')}
              >
                <Feather name="map-pin" size={18} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Add {country?.name} to album</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.loaderArea}>
              <Text style={{ color: theme.textSecondary }}>Unable to load data.</Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 24,
  },
  closeBtn: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  flagWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  flagImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    textAlign: 'center',
  },
  loaderArea: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    gap: 16,
  },
  statsGrid: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
  },
  statCell: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
  },
  statValue: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  aboutCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  aboutImage: {
    width: 100,
    height: 120,
    borderRadius: 12,
    marginRight: 16,
  },
  aboutContent: {
    flex: 1,
    justifyContent: 'center',
  },
  aboutTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    marginBottom: 8,
  },
  aboutDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#ffffff',
  },
});
