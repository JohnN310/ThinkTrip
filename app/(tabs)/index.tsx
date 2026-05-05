import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Platform, ActivityIndicator, Modal, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';

import { useColors } from '../../hooks/useColors';
import { useProfile } from '../../contexts/ProfileContext';
import { Destination } from '../../lib/destinations';
import { buildPackingList, Category } from '../../lib/packingList';
import { Card } from '../../components/Card';
import { SectionHeader } from '../../components/SectionHeader';
import { SegmentedControl } from '../../components/SegmentedControl';


const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const parseSlot = (item: any, dayMin?: number, dayMax?: number) => {
  if (!item) return { temp: 0, tempLow: 0, tempHigh: 0, humidity: 0, condition: 'Sunny' };

  if (item.condition && item.temp !== undefined) {
    return {
      ...item,
      tempLow: Math.round(dayMin !== undefined ? dayMin : item.tempLow),
      tempHigh: Math.round(dayMax !== undefined ? dayMax : item.tempHigh)
    };
  }

  const mainCond = item.weather[0].main;
  const iconCode = item.weather[0].icon;

  return {
    temp: Math.round(item.main.temp),
    tempLow: Math.round(dayMin !== undefined ? dayMin : item.main.temp_min),
    tempHigh: Math.round(dayMax !== undefined ? dayMax : item.main.temp_max),
    humidity: item.main.humidity,
    condition: mainCond === 'Clear'
      ? (iconCode.includes('n') ? 'Clear Night' : 'Sunny')
      : mainCond
  };
};

const getAqiLabel = (aqiIndex: number) => {
  if (!aqiIndex) return 'Unknown';
  const labels = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
  return labels[aqiIndex - 1] || 'Unknown';
};

const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};


const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_WEATHER_KEY;
const POPULAR_CITIES = ['Tokyo', 'London', 'New York', 'Paris', 'Bangkok', 'Dubai', 'Seoul', 'Marrakech'];

const alertedCities = new Set<string>();


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function PlanScreen() {

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, toggleSavedLocation, hydrated } = useProfile();

  const [forecast, setForecast] = useState<any[]>([]);
  const [showForecastSheet, setShowForecastSheet] = useState(false);
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<'morning' | 'afternoon' | 'evening'>('afternoon');
  const [selectedDayIndex, setSelectedDayIndex] = useState(-1);
  // 1. Get saved locations from profile (fallback to empty array if undefined)
  const savedLocations: string[] = profile.savedLocations || [];

  const [hasSetInitialCity, setHasSetInitialCity] = useState(false);

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

    let condition = 'Sunny';
    if (weatherData.weather && weatherData.weather.length > 0) {
      const hasStorm = weatherData.weather.some((w: any) => w.main === 'Thunderstorm');
      const hasSnow = weatherData.weather.some((w: any) => w.main === 'Snow');
      const hasRain = weatherData.weather.some((w: any) => w.main === 'Rain' || w.main === 'Drizzle');
      const mainCond = weatherData.weather[0].main;
      const iconCode = weatherData.weather[0].icon;

      if (hasStorm) condition = 'Thunderstorm';
      else if (hasSnow) condition = 'Snow';
      else if (hasRain) condition = 'Rain';
      else if (mainCond === 'Clear') condition = iconCode.includes('n') ? 'Clear Night' : 'Sunny';
      else condition = mainCond;
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
        condition: condition
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

      // 3. Helper to summarize a block's arrays into a single clean object
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
            condition: fallbackData.condition,
            aqiLabel: getAqiLabel(fallbackAqi)
          };
        }

        // Calculate True Block Averages
        const avgTemp = Math.round(block.items.reduce((acc: number, i: any) => acc + i.main.temp, 0) / block.items.length);
        const avgHumidity = Math.round(block.items.reduce((acc: number, i: any) => acc + i.main.humidity, 0) / block.items.length);

        // Pick a representative weather condition from the middle of the block
        const repItem = block.items[Math.floor(block.items.length / 2)];
        const mainCond = repItem.weather[0].main;
        const iconCode = repItem.weather[0].icon;
        const condition = mainCond === 'Clear' ? (iconCode.includes('n') ? 'Clear Night' : 'Sunny') : mainCond;

        return {
          temp: avgTemp,
          blockMin: Math.round(block.min),
          blockMax: Math.round(block.max),
          tempLow: Math.round(dayMin), // Still pass the full day variance to the AI packing list
          tempHigh: Math.round(dayMax),
          humidity: avgHumidity,
          condition: condition,
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
      condition,
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

    // Handle Alerts
    if (profile.liveAlertsEnabled) {
      const generatedAlerts: any[] = [];
      if (condition === 'Sunny') generatedAlerts.push({ level: 'info', title: 'High UV Exposure' });
      if (currentAqiLabel === 'Poor' || currentAqiLabel === 'Very Poor') generatedAlerts.push({ level: 'critical', title: `Air Quality is ${currentAqiLabel}` });
      if (['Rain', 'Thunderstorm', 'Snow'].includes(condition)) generatedAlerts.push({ level: 'warn', title: 'Precipitation Expected' });

      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted' && generatedAlerts.length > 0) {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

          // Calculate true geographic distance
          const distanceKm = getDistanceKm(loc.coords.latitude, loc.coords.longitude, lat, lon);

          // Trigger alert if the user is within a 40km radius of the searched city
          if (distanceKm <= 40 && !alertedCities.has(weatherData.name)) {
            const extremeAlerts = generatedAlerts.filter(a => a.level === 'critical' || a.level === 'warn');
            if (extremeAlerts.length > 0) {
              alertedCities.add(weatherData.name);
              await Notifications.scheduleNotificationAsync({
                content: { title: `ThinkTrip: ${weatherData.name} 🚨`, body: 'Critical weather or air quality alert in your area.', sound: true },
                trigger: null,
              });
            }
          }
        }
      } catch (err) {
        console.warn('Failed to check location for live alerts:', err);
      }
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

  const [liveWeather, setLiveWeather] = useState<{
    temp: number;
    tempLow: number;
    tempHigh: number;
    blockMin?: number;
    blockMax?: number;
    humidity: number;
    aqiLabel: string;
    condition: string;
  } | null>(null);

  const [trueLiveWeather, setTrueLiveWeather] = useState<any>(null);

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
        condition: weather.condition,
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
    const { condition, aqiLabel } = liveWeather;

    if (condition === 'Sunny') {
      alerts.push({
        level: 'info',
        title: 'High UV Exposure',
        body: 'Clear skies detected. Ensure your biometric baseline is protected with SPF 50+.'
      });
    }

    if (aqiLabel === 'Poor' || aqiLabel === 'Very Poor') {
      alerts.push({
        level: 'critical',
        title: `Air Quality is ${aqiLabel}`,
        body: 'High particulate matter detected. Respiratory protection is strongly advised outdoors.'
      });
    }

    if (['Rain', 'Thunderstorm', 'Snow'].includes(condition)) {
      alerts.push({
        level: 'warn',
        title: 'Precipitation Expected',
        body: `Expect ${condition.toLowerCase()} during this window. Prepare accordingly.`
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
                  style={styles.greetingText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  Where to next{firstName ? `, ${firstName}` : ''}?
                </Text>

                <Text style={[styles.dateText, { color: colors.mutedForeground }]}>{getDateString()}</Text>
              </View>
            </View>
            <View style={[styles.headerAvatar, { backgroundColor: profile.avatarColor || colors.primary }]}>
              {profile.avatarEmoji ? (
                <Text style={{ fontSize: 22 }}>{profile.avatarEmoji}</Text>
              ) : (
                <Text style={[styles.headerAvatarText, { color: colors.accent }]}>{initials}</Text>
              )}
            </View>
          </View>
        </View>

        {/* ─── Hero Destination Card ─── */}
        <View style={styles.heroWrapper}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={openSheet}
            style={[styles.heroCard, { backgroundColor: colors.primary }]}
          >
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
                    <View style={[styles.weatherBadge, { backgroundColor: 'rgba(245,185,98,0.15)' }]}>
                      <Feather name="loader" size={11} color={colors.accent} />
                      <Text style={[styles.weatherBadgeText, { color: colors.accent }]}>Loading...</Text>
                    </View>
                  );
                }

                const condition = liveWeather.condition;
                const isClear = condition === 'Sunny' || condition === 'Clear Night';

                let iconName: any = 'sun';
                if (condition === 'Clear Night') iconName = 'moon';
                else if (condition === 'Clouds') iconName = 'cloud';
                else if (condition === 'Rain' || condition === 'Drizzle') iconName = 'cloud-rain';
                else if (condition === 'Snow') iconName = 'cloud-snow';
                else if (condition === 'Thunderstorm') iconName = 'cloud-lightning';
                else if (condition === 'Mist' || condition === 'Fog' || condition === 'Haze') iconName = 'cloud';

                return (
                  <View style={[styles.weatherBadge, { backgroundColor: isClear ? colors.accent : 'rgba(245,185,98,0.15)' }]}>
                    <Feather name={iconName} size={11} color={isClear ? '#0a1f1e' : colors.accent} />
                    <Text style={[styles.weatherBadgeText, { color: isClear ? '#0a1f1e' : colors.accent }]}>
                      {condition}
                    </Text>
                  </View>
                );
              })()}
            </View>

            {/* Destination Name + Heart Button */}
            <View style={styles.heroDestinationRow}>
              <Text style={[styles.heroDestination, { color: colors.accent }]} numberOfLines={1} adjustsFontSizeToFit>
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
                  color={isSaved ? '#ef4444' : colors.accent}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                <View style={styles.statIconRow}>
                  <Feather name="thermometer" size={13} color="#a8c2c0" />
                  <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>Temperature</Text>
                </View>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                  {liveWeather
                    ? (liveWeather.blockMin && liveWeather.blockMin !== liveWeather.blockMax
                      ? `${liveWeather.blockMin}°–${liveWeather.blockMax}°`
                      : `${liveWeather.temp}°`)
                    : '—'}
                </Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                <View style={styles.statIconRow}>
                  <Feather name="droplet" size={13} color="#a8c2c0" />
                  <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>Humidity</Text>
                </View>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                  {liveWeather ? `${liveWeather.humidity}%` : '—'}
                </Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                <View style={styles.statIconRow}>
                  <Feather name="wind" size={13} color="#a8c2c0" />
                  <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>Air Quality</Text>
                </View>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
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
              style={[styles.searchButton, { backgroundColor: isSearching ? colors.muted : colors.primary }]}
              onPress={handleSearch}
              activeOpacity={0.8}
              disabled={isSearching}
            >
              <Feather name="arrow-right" size={18} color={isSearching ? colors.mutedForeground : colors.accent} />
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
                      backgroundColor: isActive ? colors.primary : colors.card,
                      borderColor: isActive ? colors.primary : colors.border,
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
                  <Text style={[styles.chipText, { color: isActive ? colors.accent : colors.foreground }]}>
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
                  bg = '#fdf2dc';
                  accent = '#a76b18';
                  icon = 'alert-triangle';
                } else if (alert.level === 'critical') {
                  bg = '#fbe7da';
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
                          <View style={styles.packingRow}>
                            <View style={[styles.priorityDot, { backgroundColor: dotColor }]} />
                            <View style={styles.packingContent}>
                              <Text style={[styles.packingTitle, { color: colors.foreground }]}>{item.title}</Text>
                              <Text style={[styles.packingReason, { color: colors.mutedForeground }]}>{item.reason}</Text>
                            </View>
                          </View>
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
            <View style={styles.sheetHandle} />

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
                      <Text style={styles.forecastDayName}>{dayName}</Text>
                      <Text style={[styles.forecastCondition, { color: colors.mutedForeground }]}>{weather.condition}</Text>
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
  statLabel: { flex: 1, color: '#a8c2c0', fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', },
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
  sheetHandle: { width: 38, height: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
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