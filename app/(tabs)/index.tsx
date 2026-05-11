import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Platform, ActivityIndicator, Modal, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useColors } from '../../hooks/useColors';
import { useProfile } from '../../contexts/ProfileContext';
import { Destination } from '../../lib/destinations';
import { buildPackingList, Category } from '../../lib/packingList';
import { Card } from '../../components/Card';
import { SectionHeader } from '../../components/SectionHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { LinearGradient } from 'expo-linear-gradient';
import { WeatherBackground } from '../../components/WeatherEffects';


const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const getAqiLabel = (aqiIndex: number) => {
  if (!aqiIndex) return 'Unknown';
  const labels = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
  return labels[aqiIndex - 1] || 'Unknown';
};




const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_WEATHER_KEY;
const POPULAR_CITIES = ['Tokyo', 'London', 'New York', 'Paris', 'Bangkok', 'Dubai', 'Seoul', 'Marrakech'];

export default function PlanScreen() {

  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, toggleSavedLocation, hydrated } = useProfile();

  const [liveWeather, setLiveWeather] = useState<{
    temp: number;
    tempLow: number;
    tempHigh: number;
    blockMin?: number;
    blockMax?: number;
    humidity: number;
    aqiLabel: string;
    iconCode: string;          // NEW: Replaces 'condition'
    displayCondition: string;  // NEW: The highly accurate description
  } | null>(null);

  const [trueLiveWeather, setTrueLiveWeather] = useState<any>(null);

  const heroTheme = useMemo(() => {
    if (!liveWeather) return { bg: colors.muted, accent: colors.mutedForeground, muted: colors.mutedForeground };

    const prefix = liveWeather.iconCode.substring(0, 2);
    const isNight = liveWeather.iconCode.includes('n');

    if (prefix === '01' && !isNight) return { bg: '#075985', accent: '#FDE047', muted: '#bae6fd' }; // Deep Sky
    if (isNight && ['01', '02', '03'].includes(prefix)) return { bg: '#1e1b4b', accent: '#E2E8F0', muted: '#94a3b8' }; // Midnight Indigo
    if (['09', '10', '11'].includes(prefix)) return { bg: '#334155', accent: '#F1F5F9', muted: '#94a3b8' }; // Storm Slate
    if (prefix === '13') return { bg: '#475569', accent: '#FFFFFF', muted: '#cbd5e1' }; // Frost Gray
    if (['02', '03', '04', '50'].includes(prefix)) return { bg: '#475569', accent: '#E2E8F0', muted: '#cbd5e1' }; // Muted Overcast

    return { bg: colors.primary, accent: colors.accent, muted: '#a8c2c0' };
  }, [liveWeather, colors]);

  const [forecast, setForecast] = useState<any[]>([]);
  const [showForecastSheet, setShowForecastSheet] = useState(false);
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<'morning' | 'afternoon' | 'evening'>('afternoon');
  const [selectedDayIndex, setSelectedDayIndex] = useState(-1);
  // 1. Get saved locations from profile (fallback to empty array if undefined)
  const savedLocations: string[] = profile.savedLocations || [];

  const [hasSetInitialCity, setHasSetInitialCity] = useState(false);

  const [selectedPackingItem, setSelectedPackingItem] = useState<any>(null);
  const [showPackingSheet, setShowPackingSheet] = useState(false);
  const packingFadeAnim = useRef(new Animated.Value(0)).current;
  const packingSlideAnim = useRef(new Animated.Value(800)).current;

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
  const slideAnim = useRef(new Animated.Value(800)).current; // Starts 800px off-screen

  const openSheet = () => {
    setShowForecastSheet(true);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 24,
        stiffness: 200,
        useNativeDriver: true,
      })
    ]).start();
  };

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 800,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start(() => {
      setShowForecastSheet(false);
    });
  };

  const [destination, setDestination] = useState<Destination>({
    key: 'new-york',
    name: 'New York',
    region: '—', // Will be overwritten by API
    climate: { tempLow: 0, tempHigh: 0, humidity: 0 },
    alerts: [],
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedChip, setSelectedChip] = useState('New York');
  const [initialLoadFailed, setInitialLoadFailed] = useState(false);

  // 1. Centralize all fetching logic into a single reusable function
  const loadDestinationData = async (cityName: string) => {
    try {
      const unitQuery = profile.units === 'imperial' ? 'imperial' : 'metric';

      // Fetch Current Weather (This also acts as our validation check)
      const weatherRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&units=${unitQuery}&appid=${OPENWEATHER_API_KEY}`
      );
      const weatherData = await weatherRes.json();

      if (!weatherRes.ok || !weatherData.coord) {
        throw new Error('City not found');
      }

      setInitialLoadFailed(false);
      const lat = weatherData.coord.lat;
      const lon = weatherData.coord.lon;

      // Helper to title-case OpenWeather descriptions (e.g., "light rain" -> "Light Rain")
      const formatDescription = (desc: string) => desc.replace(/\b\w/g, c => c.toUpperCase());

      let currentIcon = '01d';
      let currentDesc = 'Clear Sky';

      if (weatherData.weather && weatherData.weather.length > 0) {
        currentIcon = weatherData.weather[0].icon;
        currentDesc = formatDescription(weatherData.weather[0].description);
      }

      // Fetch AQI
      const aqiRes = await fetch(
        `https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`
      );
      const aqiData = await aqiRes.json();

      let currentAqiIndex = 1;
      if (aqiRes.ok && aqiData.list && aqiData.list.length > 0) {
        currentAqiIndex = aqiData.list[0].main.aqi;
      }
      const currentAqiLabel = getAqiLabel(currentAqiIndex);

      // Fetch Forecast
      const forecastRes = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(cityName)}&units=${unitQuery}&appid=${OPENWEATHER_API_KEY}`
      );
      const forecastData = await forecastRes.json();

      if (forecastRes.ok && forecastData.list) {
        const dailyGroups: Record<string, any> = {};
        const timezoneOffset = weatherData.timezone;

        const nowData = {
          temp: Math.round(weatherData.main.temp),
          tempLow: Math.round(weatherData.main.temp_min),
          tempHigh: Math.round(weatherData.main.temp_max),
          humidity: weatherData.main.humidity,
          iconCode: currentIcon,
          displayCondition: currentDesc
        };

        // 1. Group Data into Time Blocks (Morning: 0-11, Afternoon: 12-17, Evening: 18-23)
        forecastData.list.forEach((item: any) => {
          const localDate = new Date((item.dt + timezoneOffset) * 1000);
          const localHour = localDate.getUTCHours();
          const localDateKey = localDate.toISOString().split('T')[0];

          if (!dailyGroups[localDateKey]) {
            dailyGroups[localDateKey] = {
              date: localDate,
              dayMinTemp: Infinity,
              dayMaxTemp: -Infinity,
              blocks: {
                morning: { items: [], min: Infinity, max: -Infinity, aqi: 0 },
                afternoon: { items: [], min: Infinity, max: -Infinity, aqi: 0 },
                evening: { items: [], min: Infinity, max: -Infinity, aqi: 0 }
              }
            };
          }

          const currentMin = item.main.temp_min;
          const currentMax = item.main.temp_max;

          // Keep track of the absolute daily minimum/maximum for the AI packing list
          if (currentMin < dailyGroups[localDateKey].dayMinTemp) dailyGroups[localDateKey].dayMinTemp = currentMin;
          if (currentMax > dailyGroups[localDateKey].dayMaxTemp) dailyGroups[localDateKey].dayMaxTemp = currentMax;

          let blockKey: 'morning' | 'afternoon' | 'evening' = 'morning';
          if (localHour >= 12 && localHour < 18) blockKey = 'afternoon';
          else if (localHour >= 18) blockKey = 'evening';

          const block = dailyGroups[localDateKey].blocks[blockKey];
          block.items.push(item);
          if (currentMin < block.min) block.min = currentMin;
          if (currentMax > block.max) block.max = currentMax;
        });

        // 2. Safely Process AQI for the specific blocks
        if (aqiRes.ok && aqiData.list) {
          aqiData.list.forEach((item: any) => {
            const localDate = new Date((item.dt + timezoneOffset) * 1000);
            const localHour = localDate.getUTCHours();
            const localDateKey = localDate.toISOString().split('T')[0];
            const newAqi = item.main.aqi;

            if (dailyGroups[localDateKey]) {
              let blockKey: 'morning' | 'afternoon' | 'evening' = 'morning';
              if (localHour >= 12 && localHour < 18) blockKey = 'afternoon';
              else if (localHour >= 18) blockKey = 'evening';

              // Keep the worst air quality reading for this block
              const block = dailyGroups[localDateKey].blocks[blockKey];
              block.aqi = Math.max(block.aqi || 0, newAqi);
            }
          });
        }

        // Sync the true live weather
        const summarizeBlock = (block: any, fallbackData: any, fallbackAqi: number, dayMin: number, dayMax: number) => {
          if (block.items.length === 0) {
            // If the block has passed (e.g. morning is over today), fallback safely
            return {
              temp: fallbackData.temp,
              blockMin: fallbackData.temp,
              blockMax: fallbackData.temp,
              tempLow: Math.round(dayMin !== Infinity ? dayMin : fallbackData.tempLow),
              tempHigh: Math.round(dayMax !== -Infinity ? dayMax : fallbackData.tempHigh),
              humidity: fallbackData.humidity,
              iconCode: fallbackData.iconCode,
              displayCondition: fallbackData.displayCondition,
              aqiLabel: getAqiLabel(fallbackAqi)
            };
          }

          // Calculate True Block Averages
          const avgTemp = Math.round(block.items.reduce((acc: number, i: any) => acc + i.main.temp, 0) / block.items.length);
          const avgHumidity = Math.round(block.items.reduce((acc: number, i: any) => acc + i.main.humidity, 0) / block.items.length);

          // 1. Extract conditions in strict CHRONOLOGICAL order
          const chronologicalConditions: string[] = [];
          let worstIcon = block.items[0]?.weather[0]?.icon || '01d';
          let highestSeverity = 0;

          block.items.forEach((item: any) => {
            if (item.weather && item.weather.length > 0) {
              const desc = formatDescription(item.weather[0].description);
              const icon = item.weather[0].icon;

              // Only add to list if it's a new weather shift (prevents "Light Rain → Light Rain")
              if (chronologicalConditions[chronologicalConditions.length - 1] !== desc) {
                chronologicalConditions.push(desc);
              }

              // Determine the worst weather in this block to drive the background animation
              // Severity scale based on icon prefix: 11 (Storm) > 13 (Snow) > 09/10 (Rain) > 50 (Atmosphere) > etc.
              const severityMap: Record<string, number> = { '11': 6, '13': 5, '09': 4, '10': 3, '50': 2, '04': 1, '03': 1, '02': 1, '01': 0 };
              const currentSeverity = severityMap[icon.substring(0, 2)] || 0;
              if (currentSeverity >= highestSeverity) {
                highestSeverity = currentSeverity;
                worstIcon = icon;
              }
            }
          });

          // 3. Format the chronological text string with a progression arrow
          let displayCondition = chronologicalConditions[0] || 'Clear Sky';
          if (chronologicalConditions.length > 1) {
            const startCond = chronologicalConditions[0];
            const endCond = chronologicalConditions[chronologicalConditions.length - 1];
            if (startCond !== endCond) displayCondition = `${startCond} → ${endCond}`;
          }

          return {
            temp: avgTemp,
            blockMin: Math.round(block.min),
            blockMax: Math.round(block.max),
            tempLow: Math.round(dayMin),
            tempHigh: Math.round(dayMax),
            humidity: avgHumidity,
            iconCode: worstIcon,             // Drives Background & Theme
            displayCondition: displayCondition, // Drives Text UI
            aqiLabel: getAqiLabel(block.aqi || fallbackAqi)
          };
        };

        // 4. Map the newly formatted data into the state
        const formattedForecast = Object.values(dailyGroups)
          .sort((a: any, b: any) => a.date.getTime() - b.date.getTime())
          .slice(0, 5)
          .map((day: any) => {
            return {
              date: day.date,
              slots: {
                'morning': summarizeBlock(day.blocks.morning, nowData, currentAqiIndex, day.dayMinTemp, day.dayMaxTemp),
                'afternoon': summarizeBlock(day.blocks.afternoon, nowData, currentAqiIndex, day.dayMinTemp, day.dayMaxTemp),
                'evening': summarizeBlock(day.blocks.evening, nowData, currentAqiIndex, day.dayMinTemp, day.dayMaxTemp)
              }
            };
          });

        setForecast(formattedForecast);
      }

      // Set Live Weather Data
      const liveWeatherData = {
        temp: Math.round(weatherData.main.temp),
        tempLow: Math.round(weatherData.main.temp_min),
        tempHigh: Math.round(weatherData.main.temp_max),
        humidity: weatherData.main.humidity,
        aqiLabel: currentAqiLabel,
        iconCode: currentIcon,
        displayCondition: currentDesc,
      };

      setLiveWeather(liveWeatherData);
      setTrueLiveWeather(liveWeatherData);

      // Update Destination context at the very end
      setDestination({
        key: weatherData.name.toLowerCase().replace(/\s+/g, '-'),
        name: weatherData.name,
        region: weatherData.sys.country,
        climate: {
          tempLow: liveWeatherData.tempLow,
          tempHigh: liveWeatherData.tempHigh,
          humidity: liveWeatherData.humidity,
        },
        alerts: [],
      });
    } catch (err) {
      console.warn('Load destination data failed:', err);
    }
  };


  // Set the default city ONCE after the profile hydrates from Firestore
  useEffect(() => {
    if (!hydrated) {
      setHasSetInitialCity(false);
      setSelectedDayIndex(-1);
      return;
    }
    if (hydrated && !hasSetInitialCity) {
      setHasSetInitialCity(true);
      const defaultCity = savedLocations.length > 0 ? savedLocations[0] : 'New York';

      setSelectedChip(defaultCity);
      setDestination(prev => ({
        ...prev,
        key: defaultCity.toLowerCase().replace(/\s+/g, '-'),
        name: defaultCity
      }));

      // Fire the initial load immediately with the correct city name
      loadDestinationData(defaultCity).catch(err => {
        console.error("Failed to load initial city:", err);
        setInitialLoadFailed(true);
      });
    }
  }, [hydrated, hasSetInitialCity, savedLocations]);



  useEffect(() => {
    if (selectedDayIndex === -1) return;
    if (forecast.length > 0 && forecast[selectedDayIndex]) {
      const weather = forecast[selectedDayIndex].slots[selectedTimeFrame];
      setLiveWeather({
        temp: weather.temp,
        tempLow: weather.tempLow,
        tempHigh: weather.tempHigh,
        blockMin: weather.blockMin,
        blockMax: weather.blockMax,
        humidity: weather.humidity,
        iconCode: weather.iconCode,
        displayCondition: weather.displayCondition,
        aqiLabel: weather.aqiLabel || 'Good'
      });
    }
  }, [selectedDayIndex, selectedTimeFrame, forecast]);

  const packingList = useMemo(
    () => buildPackingList(profile, destination, liveWeather),
    [profile, destination, liveWeather]
  );

  const activeAlerts = useMemo(() => {
    if (!liveWeather) return [];
    const alerts: any[] = [];
    const { iconCode, aqiLabel } = liveWeather;
    const prefix = iconCode.substring(0, 2);
    const isNight = iconCode.includes('n');

    if (prefix === '01' && !isNight) {
      alerts.push({
        level: 'info',
        title: 'High UV Exposure',
        body: 'Clear skies ahead. Sunscreen application is advised.'
      });
    }

    if (aqiLabel === 'Poor' || aqiLabel === 'Very Poor') {
      alerts.push({
        level: 'critical',
        title: `Air Quality is ${aqiLabel}`,
        body: 'Poor air quality today. Respiratory protection advised.'
      });
    }

    if (['09', '10', '11', '13'].includes(prefix)) {
      let condName = 'Precipitation';
      if (prefix === '11') condName = 'Thunderstorm';
      else if (prefix === '13') condName = 'Snow';
      else if (['09', '10'].includes(prefix)) condName = 'Rain';

      alerts.push({
        level: 'warn',
        title: `${condName} Expected`,
        body: `Looks like ${condName.toLowerCase()} is on the way. Plan accordingly.`
      });
    }

    return alerts;
  }, [liveWeather]);

  const CATEGORY_ORDER: Category[] = ['Climate & Respiratory', 'Systemic & Dietary', 'Physical & Transit'];
  const CATEGORY_ICONS: Record<Category, string> = {
    'Climate & Respiratory': 'cloud',
    'Systemic & Dietary': 'heart',
    'Physical & Transit': 'activity',
  };

  const groupedPacking = useMemo(() => {
    const groups: { category: Category; items: typeof packingList }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const items = packingList.filter(i => i.category === cat);
      if (items.length > 0) groups.push({ category: cat, items });
    }
    return groups;
  }, [packingList]);

  // Merge saved locations with popular cities, removing duplicates
  const displayCities = useMemo(() => {
    return Array.from(new Set([...savedLocations, ...POPULAR_CITIES]));
  }, [savedLocations]);

  // Check if the currently viewed destination is in the user's watchlist
  const isSaved = savedLocations.includes(destination.name);

  const handleToggleSave = () => {
    if (Platform.OS !== 'web' && profile.hapticsEnabled) {
      Haptics.selectionAsync();
    }
    toggleSavedLocation(destination.name);
  };

  const getDateString = () => {
    if (selectedDayIndex === -1) {
      if (forecast.length > 0 && forecast[0]) {
        const destNow = forecast[0].date;
        return `Today, ${MONTHS[destNow.getUTCMonth()]} ${destNow.getUTCDate()}`;
      }
      // Ultimate fallback if data hasn't loaded yet
      const now = new Date();
      return `Today, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
    }

    if (forecast.length > 0 && forecast[selectedDayIndex]) {
      const targetDate = forecast[selectedDayIndex].date;
      const dayName = selectedDayIndex === 0 ? 'Today' : DAYS[targetDate.getUTCDay()];
      return `${dayName}, ${MONTHS[targetDate.getUTCMonth()]} ${targetDate.getUTCDate()}`;
    }

    const now = new Date();
    return `Today, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
  };

  const firstName = profile.displayName ? profile.displayName.split(' ')[0] : '';
  const initials = profile.displayName
    ? profile.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'TT';


  // 2. Refactor searchCity to strictly handle UI state and call the centralized load function
  const searchCity = async (cityName: string, fromChip = false) => {
    if (!cityName.trim()) return;
    setIsSearching(true);

    if (fromChip) setSelectedChip(cityName);
    else setSelectedChip('');

    if (Platform.OS !== 'web' && profile.hapticsEnabled) {
      Haptics.selectionAsync();
    }

    try {
      setLiveWeather(null); // Optional: triggers the loading state visually
      await loadDestinationData(cityName); // Perform ONE combined fetch
      setSearchQuery('');
      setSelectedDayIndex(-1);
      setSelectedTimeFrame('afternoon');
    } catch (error) {
      console.warn('Search failed:', error);
      if (fromChip) setSelectedChip('');
      if (Platform.OS !== 'web' && profile.hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      setInitialLoadFailed(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = () => searchCity(searchQuery, false);

  // 3. The useEffect now reacts ONLY to unit changes to maintain accuracy
  useEffect(() => {
    if (!hasSetInitialCity) return;

    loadDestinationData(destination.name).catch((error) => {
      console.error("Failed to refresh destination data:", error);
    });
  }, [profile.units]);

  if (!hydrated || !hasSetInitialCity) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 84 + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Header Area ─── */}
        <View style={[styles.headerArea, { paddingTop: (insets.top || 20) + 8 }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextCol}>
              <View>
                {/* <Text style={[styles.greetingText, { color: colors.foreground }]}>
                  Where to next{firstName ? `, ${firstName}` : ''}?
                </Text> */}

                <Text
                  style={[styles.greetingText, { color: colors.foreground }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  Where to next{firstName ? `, ${firstName}` : ''}?
                </Text>

                <Text style={[styles.dateText, { color: colors.mutedForeground }]}>{getDateString()}</Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                if (Platform.OS !== 'web' && profile.hapticsEnabled) Haptics.selectionAsync();
                router.push('/profile');
              }}
              style={[styles.headerAvatar, { backgroundColor: profile.avatarColor || colors.primary }]}
            >
              {profile.avatarEmoji ? (
                <Text style={{ fontSize: 22 }}>{profile.avatarEmoji}</Text>
              ) : (
                <Text style={[styles.headerAvatarText, { color: colors.accent }]}>{initials}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Hero Destination Card ─── */}
        <View style={styles.heroWrapper}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={openSheet}
            style={[styles.heroCard, { backgroundColor: heroTheme.bg }]}
          >
            <WeatherBackground iconCode={liveWeather?.iconCode} />
            <LinearGradient
              colors={['rgba(0,0,0,0.3)', 'transparent']}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            <View style={styles.heroDecoOuter}>
              <View style={[styles.heroDecoCircle, { borderColor: 'rgba(245,185,98,0.06)' }]} />
              <View style={[styles.heroDecoCircleSm, { borderColor: 'rgba(245,185,98,0.04)' }]} />
            </View>

            <View style={styles.heroTopRow}>
              <View style={[styles.regionTag, { backgroundColor: 'rgba(207,225,223,0.12)' }]}>
                <Feather name="map-pin" size={10} color="#a8c2c0" />
                <Text style={styles.regionTagText}>{destination.region}</Text>
              </View>

              {(() => {
                if (initialLoadFailed) {
                  return (
                    <View style={[styles.weatherBadge, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                      <Feather name="cloud-off" size={11} color="rgba(255,255,255,0.6)" />
                      <Text style={[styles.weatherBadgeText, { color: 'rgba(255,255,255,0.6)' }]}>Location Unavailable</Text>
                    </View>
                  );
                }
                if (!liveWeather) {
                  return (
                    <View style={[styles.weatherBadge, { backgroundColor: 'rgba(0,0,0,0.05)' }]}>
                      <Feather name="loader" size={11} color={heroTheme.accent} />
                      <Text style={[styles.weatherBadgeText, { color: heroTheme.accent }]}>Loading...</Text>
                    </View>
                  );
                }

                const iconPrefix = liveWeather.iconCode.substring(0, 2);
                const isClear = iconPrefix === '01';

                let iconName: any = 'sun';
                if (liveWeather.iconCode.includes('n') && isClear) iconName = 'moon';
                else if (['02', '03', '04', '50'].includes(iconPrefix)) iconName = 'cloud';
                else if (['09', '10'].includes(iconPrefix)) iconName = 'cloud-rain';
                else if (iconPrefix === '13') iconName = 'cloud-snow';
                else if (iconPrefix === '11') iconName = 'cloud-lightning';

                return (
                  <View style={[styles.weatherBadge, { backgroundColor: isClear ? heroTheme.accent : 'rgba(255,255,255,0.15)' }]}>
                    <Feather name={iconName} size={11} color={isClear ? heroTheme.bg : heroTheme.accent} />
                    <Text style={[styles.weatherBadgeText, { color: isClear ? heroTheme.bg : heroTheme.accent }]}>
                      {liveWeather.displayCondition}
                    </Text>
                  </View>
                );
              })()}
            </View>

            {/* Destination Name + Heart Button */}
            <View style={styles.heroDestinationRow}>
              <Text style={[styles.heroDestination, { color: heroTheme.accent }]} numberOfLines={1} adjustsFontSizeToFit>
                {destination.name}
              </Text>
              <TouchableOpacity
                style={styles.heartButton}
                onPress={handleToggleSave}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isSaved ? "heart" : "heart-outline"}
                  size={24}
                  color={isSaved ? '#ef4444' : heroTheme.accent}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <View style={styles.statIconRow}>
                  <Feather name="thermometer" size={13} color={heroTheme.muted} />
                  <Text style={[styles.statLabel, { color: heroTheme.muted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>Temperature</Text>
                </View>
                <Text style={[styles.statValue, { color: heroTheme.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                  {liveWeather
                    ? (liveWeather.blockMin && liveWeather.blockMin !== liveWeather.blockMax
                      ? `${liveWeather.blockMin}°–${liveWeather.blockMax}°`
                      : `${liveWeather.temp}°`)
                    : '—'}
                </Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <View style={styles.statIconRow}>
                  <Feather name="droplet" size={13} color={heroTheme.muted} />
                  <Text style={[styles.statLabel, { color: heroTheme.muted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>Humidity</Text>
                </View>
                <Text style={[styles.statValue, { color: heroTheme.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                  {liveWeather ? `${liveWeather.humidity}%` : '—'}
                </Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <View style={styles.statIconRow}>
                  <Feather name="wind" size={13} color={heroTheme.muted} />
                  <Text style={[styles.statLabel, { color: heroTheme.muted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>Air Quality</Text>
                </View>
                <Text style={[styles.statValue, { color: heroTheme.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                  {liveWeather ? liveWeather.aqiLabel : '—'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ─── Search + Chips ─── */}
        <View style={styles.searchSection}>
          <View style={[styles.searchPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search for a city..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              editable={!isSearching}
            />
            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: isSearching ? colors.muted : heroTheme.bg }]}
              onPress={handleSearch}
              activeOpacity={0.8}
              disabled={isSearching}
            >
              <Feather name="arrow-right" size={18} color={isSearching ? colors.mutedForeground : heroTheme.accent} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScrollContent}>
            {displayCities.map((city) => {
              const isActive = selectedChip === city;
              const isCitySaved = savedLocations.includes(city);

              return (
                <TouchableOpacity
                  key={city}
                  activeOpacity={0.8}
                  onPress={() => searchCity(city, true)}
                  disabled={isSearching}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isActive ? heroTheme.bg : colors.card,
                      borderColor: isActive ? heroTheme.bg : colors.border,
                    }
                  ]}
                >
                  {isCitySaved && (
                    <Ionicons
                      name="heart"
                      size={12}
                      color="#ef4444"
                      style={{ marginRight: 6 }}
                    />
                  )}
                  <Text style={[styles.chipText, { color: isActive ? heroTheme.accent : colors.foreground }]}>
                    {city}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ─── Heads Up ─── */}
        {activeAlerts.length > 0 && (
          <View style={[styles.section, { paddingHorizontal: 20 }]}>
            <SectionHeader
              title="Heads up"
              rightElement={
                <Text style={[styles.alertCount, { color: colors.mutedForeground }]}>
                  {activeAlerts.length} alert{activeAlerts.length !== 1 ? 's' : ''}
                </Text>
              }
            />
            <View style={{ gap: 12 }}>
              {activeAlerts.map((alert, i) => {
                let bg = colors.muted;
                let accent = colors.primary;
                let icon: any = 'info';

                if (alert.level === 'warn') {
                  bg = colors.isDark ? 'rgba(245, 185, 98, 0.12)' : '#fdf2dc';
                  accent = '#a76b18';
                  icon = 'alert-triangle';
                } else if (alert.level === 'critical') {
                  bg = colors.isDark ? 'rgba(224, 90, 40, 0.15)' : '#fbe7da';
                  accent = colors.destructive;
                  icon = 'alert-octagon';
                }

                return (
                  <View key={i} style={[styles.alertBanner, { backgroundColor: bg, borderColor: accent + '33' }]}>
                    <Feather name={icon} size={18} color={accent} style={{ marginTop: 2 }} />
                    <View style={styles.alertContent}>
                      <Text style={[styles.alertTitle, { color: accent }]}>{alert.title}</Text>
                      <Text style={[styles.alertBody, { color: colors.foreground }]}>{alert.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Packing List ─── */}
        <View style={[styles.section, { paddingHorizontal: 20 }]}>
          <SectionHeader
            title="Packing list"
            rightElement={
              !liveWeather ? (
                <Text style={[styles.essentialCountText, { color: colors.mutedForeground }]}>Analyzing...</Text>
              ) : (
                <View style={styles.essentialCountRow}>
                  <View style={[styles.dot, { backgroundColor: colors.destructive }]} />
                  <Text style={[styles.essentialCountText, { color: colors.mutedForeground }]}>
                    {packingList.filter(i => i.priority === 'essential').length} essential
                  </Text>
                </View>
              )
            }
          />
          {!liveWeather ? (
            <Card padded={false}>
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                  Fetching live conditions...
                </Text>
              </View>
            </Card>
          ) : packingList.length === 0 ? (
            <Card padded={false}>
              <View style={styles.emptyState}>
                <Feather name="check-circle" size={22} color={colors.muted} />
                <Text style={[styles.emptyStateText, { color: colors.mutedForeground }]}>Your packing list is optimized for current conditions.</Text>
              </View>
            </Card>
          ) : (
            <View style={{ gap: 14 }}>
              {groupedPacking.map((group) => (
                <View key={group.category}>
                  <View style={styles.categoryHeader}>
                    <Feather name={CATEGORY_ICONS[group.category] as any} size={13} color={colors.mutedForeground} />
                    <Text style={[styles.categoryLabel, { color: colors.mutedForeground }]}>{group.category}</Text>
                  </View>
                  <Card padded={false}>
                    {group.items.map((item, index) => {
                      let dotColor = colors.mutedForeground;
                      if (item.priority === 'essential') dotColor = colors.destructive;
                      else if (item.priority === 'recommended') dotColor = colors.accent;

                      return (
                        <View key={item.id}>
                          {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                          <TouchableOpacity
                            style={styles.packingRow}
                            activeOpacity={0.7}
                            onPress={() => {
                              if (Platform.OS !== 'web' && profile.hapticsEnabled) Haptics.selectionAsync();
                              openPackingSheet(item);
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                              <View style={[styles.dot, { backgroundColor: dotColor, width: 6, height: 6 }]} />
                              {item.emoji && <Text style={{ fontSize: 16 }}>{item.emoji}</Text>}
                              <Text style={[styles.packingTitle, { color: colors.foreground, flex: 1, fontSize: 15 }]} numberOfLines={1}>
                                {item.title}
                              </Text>
                            </View>
                            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </Card>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── Forecast Bottom Sheet Modal ─── */}

      {/* ─── Premium Forecast Bottom Sheet Modal ─── */}
      <Modal visible={showForecastSheet} transparent animationType="none" onRequestClose={closeSheet}>
        {/* Animated Backdrop */}
        <Animated.View style={[styles.sheetBackdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeSheet} />

          {/* Animated Sheet */}
          <Animated.View style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + 20,
              transform: [{ translateY: slideAnim }] // Drives the spring upward
            }
          ]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]} />

            <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: colors.foreground }}>
                  5-Day Outlook
                </Text>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    if (Platform.OS !== 'web' && profile.hapticsEnabled) Haptics.selectionAsync();
                    setSelectedDayIndex(-1); // Switch into "Now Mode"
                    setLiveWeather(trueLiveWeather); // Restore exact real-time data
                    closeSheet();
                  }}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999 }}
                >
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.foreground }}>
                    Reset to Now
                  </Text>
                </TouchableOpacity>
              </View>

              <SegmentedControl
                options={['Morning', 'Afternoon', 'Evening']}
                value={selectedTimeFrame.charAt(0).toUpperCase() + selectedTimeFrame.slice(1)}
                onChange={(v: string) => setSelectedTimeFrame(v.toLowerCase() as any)}
              />
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
              {forecast.map((day, index) => {
                const weather = day.slots[selectedTimeFrame];
                const dayName = index === 0 ? 'Today' : DAYS[day.date.getUTCDay()];
                return (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (Platform.OS !== 'web' && profile.hapticsEnabled) Haptics.selectionAsync();
                      setSelectedDayIndex(index);
                      closeSheet();
                    }}
                    style={[styles.forecastItem, { borderColor: index === selectedDayIndex ? colors.accent : colors.border }]}
                  >
                    <View style={{ gap: 4 }}>
                      <Text style={[styles.forecastDayName, { color: colors.foreground }]}>{dayName}</Text>
                      <Text style={[styles.forecastCondition, { color: colors.mutedForeground }]}>{weather.displayCondition}</Text>
                    </View>
                    <Text style={[styles.forecastTemp, { color: colors.foreground }]}>
                      {weather.blockMin === weather.blockMax ? `${weather.blockMin}°` : `${weather.blockMin}°–${weather.blockMax}°`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* ─── Packing Item Bottom Sheet Modal ─── */}
      <Modal visible={showPackingSheet} transparent animationType="none" onRequestClose={closePackingSheet}>
        {/* Animated Backdrop */}
        <Animated.View style={[styles.sheetBackdrop, { opacity: packingFadeAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closePackingSheet} />

          {/* Animated Sheet */}
          <Animated.View style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + 20,
              transform: [{ translateY: packingSlideAnim }] // Drives the spring upward
            }
          ]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]} />

            {selectedPackingItem && (
              <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 20, paddingBottom: 20 }}>
                {/* Header */}
                <View style={{ gap: 4, alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ fontSize: 32 }}>{selectedPackingItem.emoji}</Text>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: colors.foreground, textAlign: 'center' }}>
                    {selectedPackingItem.title}
                  </Text>
                </View>

                {/* Why you need this */}
                <View style={{ gap: 8 }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.mutedForeground, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                    WHY YOU NEED THIS
                  </Text>
                  <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 15, color: colors.foreground, lineHeight: 22 }}>
                    {selectedPackingItem.detailedDescription || selectedPackingItem.reason}
                  </Text>
                </View>

                {/* Recommended Options */}
                {selectedPackingItem.productSamples && selectedPackingItem.productSamples.length > 0 && (
                  <View style={{ gap: 12 }}>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.mutedForeground, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                      RECOMMENDED OPTIONS
                    </Text>
                    {selectedPackingItem.productSamples.map((product: any, idx: number) => (
                      <Card key={idx} padded={true} style={{ padding: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flex: 1, paddingRight: 10 }}>
                            {/* Brand name ommited, only show when doing advertisments. Use product.query to search for the product brand specifically.*/}
                            {/* <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.mutedForeground }}>{product.brand}</Text> */}
                            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.foreground, marginTop: 2 }}>{product.name}</Text>
                            {/* <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.foreground, marginTop: 4 }}>{product.price}</Text> */}
                          </View>
                          <TouchableOpacity
                            style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 }}
                            onPress={() => {
                              if (Platform.OS !== 'web' && profile.hapticsEnabled) Haptics.selectionAsync();
                              WebBrowser.openBrowserAsync(`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(product.name)}`);
                            }}
                          >
                            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.primaryForeground }}>See more</Text>
                          </TouchableOpacity>
                        </View>
                      </Card>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerArea: { paddingHorizontal: 20, paddingBottom: 0 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTextCol: { flex: 1, paddingRight: 16, height: 60, justifyContent: 'space-between', paddingVertical: 2 },
  greetingText: { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -0.2, opacity: 0.6 },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  headerAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.3 },
  dateText: { fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 2, letterSpacing: 0.2 },
  heroWrapper: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4 },
  heroCard: { borderRadius: 24, padding: 24, overflow: 'hidden' },
  heroDecoOuter: { position: 'absolute', top: -60, right: -40 },
  heroDecoCircle: { width: 200, height: 200, borderRadius: 100, borderWidth: 40, position: 'absolute' },
  heroDecoCircleSm: { width: 120, height: 120, borderRadius: 60, borderWidth: 24, position: 'absolute', top: 40, left: 40 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  regionTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  regionTagText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#cfe1df', letterSpacing: 0.4 },
  weatherBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, gap: 5 },
  weatherBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.4 },

  heroDestinationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  heroDestination: { fontFamily: 'Inter_700Bold', fontSize: 38, letterSpacing: -1, flex: 1 },
  heartButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, marginLeft: 12 },

  statsGrid: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, gap: 8, justifyContent: 'center', alignItems: 'center', },
  statIconRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statLabel: { color: '#a8c2c0', fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', },
  statValue: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 16, textTransform: 'capitalize' },
  searchSection: { paddingHorizontal: 20, paddingTop: 14, gap: 12 },
  searchPill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 12 },
  searchInput: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 15 },
  searchButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chipScrollContent: { gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  categoryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  section: { marginTop: 22 },
  alertCount: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  alertBanner: { flexDirection: 'row', padding: 14, borderRadius: 14, borderWidth: 1, gap: 12 },
  alertContent: { flex: 1 },
  alertTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  alertBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 2 },
  essentialCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  essentialCountText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12 },
  emptyStateText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  loadingState: { alignItems: 'center', justifyContent: 'center', padding: 36, gap: 14 },
  loadingText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  packingRow: { flexDirection: 'row', padding: 16, gap: 12 },
  priorityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  packingContent: { flex: 1 },
  packingTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  packingReason: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 2 },
  divider: { height: 1 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 14 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  forecastItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  forecastDayName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  forecastCondition: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  forecastTemp: { fontFamily: 'Inter_700Bold', fontSize: 16 },

});