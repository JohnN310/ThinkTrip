import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Platform, ActivityIndicator, Modal, Animated, Keyboard, Dimensions } from 'react-native';
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
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DolphinMascot } from '../../components/DolphinMascot';

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

  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);
  // Use state (not a ref) so that when the timer fires a re-render occurs,
  // which lets the useEffect below react even if the tab is already focused.
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
  const [selectedPointIndex, setSelectedPointIndex] = useState(0);
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

    // Auto-select Today and snap to current time block
    if (forecast.length > 0) {
      setSelectedDayIndex(0);
      const activeIdx = forecast[0].points.findIndex((p: any) => !p.isPast);
      setSelectedPointIndex(activeIdx !== -1 ? activeIdx : 0);
    }

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 24, stiffness: 200, useNativeDriver: true })
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

  // Autocomplete State
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQueryRef = useRef('');

  // 1. Centralize all fetching logic into a single reusable function
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

              // Attempt exact matching if the query has 3 parts (City, State, Country)
              const queryParts = locationQuery.split(',').map(p => p.trim().toLowerCase());
              if (queryParts.length === 3) {
                const exactMatch = geoData.find((g: any) =>
                  g.name?.toLowerCase() === queryParts[0] &&
                  g.state?.toLowerCase() === queryParts[1] &&
                  g.country?.toLowerCase() === queryParts[2]
                );
                if (exactMatch) {
                  lookupLat = exactMatch.lat;
                  lookupLon = exactMatch.lon;
                  foundGeoData = exactMatch;
                }
              }
            }
          }
        } catch (e) {
          console.warn("Geocode pre-lookup failed, falling back to basic search:", e);
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

      // Fetch Current Weather (This also acts as our validation check)
      const weatherRes = await fetch(weatherUrl);
      const weatherData = await weatherRes.json();

      if (!weatherRes.ok || !weatherData.coord) {
        throw new Error('City not found');
      }

      setInitialLoadFailed(false);

      let finalName = targetName;
      if (typeof locationQuery === 'string') {
        const matchedSaved = savedLocations.find(loc => loc.toLowerCase() === locationQuery.toLowerCase());
        const matchedPopular = POPULAR_CITIES.find(loc => loc.toLowerCase() === locationQuery.toLowerCase());

        if (matchedSaved) {
          finalName = matchedSaved;
        } else if (matchedPopular) {
          finalName = matchedPopular;
        } else if (foundGeoData) {
          const statePart = foundGeoData.state && foundGeoData.state !== foundGeoData.name ? `, ${foundGeoData.state}` : '';
          finalName = `${foundGeoData.name}${statePart}, ${foundGeoData.country}`;
        } else {
          finalName = `${weatherData.name}, ${weatherData.sys.country}`;
        }
      }

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
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${unitQuery}&appid=${OPENWEATHER_API_KEY}`
      );
      const forecastData = await forecastRes.json();

      if (forecastRes.ok && forecastData.list) {
        const dailyGroups: Record<string, any> = {};
        const timezoneOffset = weatherData.timezone;

        // 1. Group Data STRICTLY by Calendar Day
        forecastData.list.forEach((item: any) => {
          const localDate = new Date((item.dt + timezoneOffset) * 1000);
          const localDateKey = localDate.toISOString().split('T')[0];

          if (!dailyGroups[localDateKey]) {
            dailyGroups[localDateKey] = {
              date: localDate,
              dayMinTemp: Infinity,
              dayMaxTemp: -Infinity,
              points: []
            };
          }

          const currentMin = item.main.temp_min;
          const currentMax = item.main.temp_max;
          if (currentMin < dailyGroups[localDateKey].dayMinTemp) dailyGroups[localDateKey].dayMinTemp = currentMin;
          if (currentMax > dailyGroups[localDateKey].dayMaxTemp) dailyGroups[localDateKey].dayMaxTemp = currentMax;

          const timeLabel = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: true }).format(localDate);
          const pop = Math.round((item.pop || 0) * 100);
          const localHour = localDate.getUTCHours();

          dailyGroups[localDateKey].points.push({
            temp: Math.round(item.main.temp),
            humidity: item.main.humidity,
            iconCode: item.weather[0].icon,
            displayCondition: formatDescription(item.weather[0].description),
            timeLabel: timeLabel,
            pop: pop,
            hour: localHour,
            isPast: false,
          });
        });

        // 2. Safely apply daily max AQI
        if (aqiRes.ok && aqiData.list) {
          aqiData.list.forEach((item: any) => {
            const localDate = new Date((item.dt + timezoneOffset) * 1000);
            const localDateKey = localDate.toISOString().split('T')[0];
            const newAqi = item.main.aqi;
            if (dailyGroups[localDateKey]) {
              dailyGroups[localDateKey].maxAqi = Math.max(dailyGroups[localDateKey].maxAqi || 0, newAqi);
            }
          });
        }

        // 3. Build Fixed 8-Slot Charts (1AM → 10PM local time)
        const TARGET_HOURS = [1, 4, 7, 10, 13, 16, 19, 22];

        // Current local time at the destination (using the API's timezone offset)
        const nowLocalMs = Date.now() + timezoneOffset * 1000;
        const nowLocalDate = new Date(nowLocalMs);
        const nowLocalHour = nowLocalDate.getUTCHours();
        const nowLocalDateKey = nowLocalDate.toISOString().split('T')[0];

        const formattedForecast = Object.values(dailyGroups)
          .sort((a: any, b: any) => a.date.getTime() - b.date.getTime())
          .slice(0, 5)
          .map((day: any) => {
            const dayKey = day.date.toISOString().split('T')[0];
            const isToday = dayKey === nowLocalDateKey;

            // For each fixed target hour, find the closest available API point
            const slots = TARGET_HOURS.map((targetHour: number) => {
              let closest = day.points[0];
              let closestDiff = Infinity;
              for (const p of day.points) {
                const diff = Math.abs(p.hour - targetHour);
                if (diff < closestDiff) { closestDiff = diff; closest = p; }
              }

              // Build a proper time label for this exact slot hour
              const slotDate = new Date(day.date);
              slotDate.setUTCHours(targetHour, 0, 0, 0);
              const timeLabel = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: true, timeZone: 'UTC' }).format(slotDate);

              return {
                ...closest,
                hour: targetHour,
                timeLabel,
                isPast: isToday && targetHour < nowLocalHour,
                tempLow: Math.round(day.dayMinTemp),
                tempHigh: Math.round(day.dayMaxTemp),
                aqiLabel: getAqiLabel(day.maxAqi || currentAqiIndex),
              };
            });

            day.points = slots;
            return day;
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


  // Set the default city ONCE after the profile hydrates from Firestore
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
      const points = forecast[selectedDayIndex].points;
      const currentPoint = points[selectedPointIndex] || points[0];
      setLiveWeather({
        temp: currentPoint.temp,
        tempLow: currentPoint.tempLow,
        tempHigh: currentPoint.tempHigh,
        blockMin: currentPoint.tempLow,
        blockMax: currentPoint.tempHigh,
        humidity: currentPoint.humidity,
        iconCode: currentPoint.iconCode,
        displayCondition: currentPoint.displayCondition,
        aqiLabel: currentPoint.aqiLabel || 'Good'
      });
    }
  }, [selectedDayIndex, selectedPointIndex, forecast]);

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
  const searchCity = async (locationQuery: string | GeocodeSuggestion, fromChip = false) => {
    const queryStr = typeof locationQuery === 'string'
      ? locationQuery
      : `${locationQuery.name}${locationQuery.state && locationQuery.state !== locationQuery.name ? `, ${locationQuery.state}` : ''}, ${locationQuery.country}`;

    if (!queryStr.trim()) return;
    latestQueryRef.current = '';
    setIsFetchingSuggestions(false);
    setIsSearching(true);
    setSelectedChip(queryStr);

    if (Platform.OS !== 'web' && profile.hapticsEnabled) {
      Haptics.selectionAsync();
    }

    try {
      setLiveWeather(null); // Optional: triggers the loading state visually
      const resolvedName = await loadDestinationData(locationQuery); // Perform ONE combined fetch
      setSelectedChip(resolvedName);
      setSearchQuery('');
      setSuggestions([]);
      setSelectedDayIndex(-1);
      setSelectedPointIndex(0);
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

  const handleSearch = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    latestQueryRef.current = '';

    if (suggestions.length > 0) {
      searchCity(suggestions[0], false);
      Keyboard.dismiss();
    } else {
      searchCity(searchQuery, false);
      Keyboard.dismiss();
    }
  };

  const fetchSuggestions = (query: string) => {
    setSearchQuery(query);
    latestQueryRef.current = query;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (query.trim().length > 2) {
      setIsFetchingSuggestions(true);
      typingTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${OPENWEATHER_API_KEY}`);
          if (res.ok) {
            const data = await res.json();
            if (latestQueryRef.current === query) {
              setSuggestions(data);
            }
          }
        } catch (error) {
          console.warn("Failed to fetch suggestions:", error);
        } finally {
          if (latestQueryRef.current === query) setIsFetchingSuggestions(false);
        }
      }, 500);
    } else {
      setSuggestions([]);
      setIsFetchingSuggestions(false);
    }
  };

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
                {destination.name.split(', ').length > 1
                  ? destination.name.split(', ').slice(0, -1).join(', ')
                  : destination.name}
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
                  {liveWeather ? `${liveWeather.temp}°` : '—'}
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
              onChangeText={fetchSuggestions}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              editable={!isSearching}
            />
            {isFetchingSuggestions && (
              <ActivityIndicator size="small" color={heroTheme.accent} style={{ marginRight: 6 }} />
            )}
            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: isSearching ? colors.muted : heroTheme.bg }]}
              onPress={handleSearch}
              activeOpacity={0.8}
              disabled={isSearching}
            >
              <Feather name="arrow-right" size={18} color={isSearching ? colors.mutedForeground : heroTheme.accent} />
            </TouchableOpacity>
          </View>

          {suggestions.length > 0 && (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              style={[styles.suggestionsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {suggestions.map((item, index) => (
                <TouchableOpacity
                  key={`${item.lat}-${item.lon}-${index}`}
                  style={[styles.suggestionItem, index < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  onPress={() => {
                    Keyboard.dismiss();
                    searchCity(item, false);
                  }}
                  activeOpacity={0.7}
                >
                  <Feather name="map-pin" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.suggestionText, { color: colors.foreground }]} numberOfLines={1}>
                    {item.name}{item.state && item.state !== item.name ? `, ${item.state}` : ''}, {item.country}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="briefcase" size={18} color={colors.foreground} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Packing list</Text>
            </View>
            {!liveWeather ? (
              initialLoadFailed ? (
                <Text style={[styles.essentialCountText, { color: colors.mutedForeground }]}>Unavailable</Text>
              ) : (
                <Text style={[styles.essentialCountText, { color: colors.mutedForeground }]}>Analyzing...</Text>
              )
            ) : (
              <View style={styles.essentialCountRow}>
                <View style={[styles.dot, { backgroundColor: colors.destructive }]} />
                <Text style={[styles.essentialCountText, { color: colors.mutedForeground }]}>
                  {packingList.filter(i => i.priority === 'essential').length} essential
                </Text>
              </View>
            )}
          </View>
          {!liveWeather ? (
            initialLoadFailed ? (
              <Card padded={false}>
                <View style={styles.emptyState}>
                  <Feather name="map-pin" size={24} color={colors.mutedForeground} />
                  <Text style={[styles.emptyStateText, { color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: 20 }]}>
                    We couldn't find that city. Try searching for a different location.
                  </Text>
                </View>
              </Card>
            ) : (
              <Card padded={false}>
                <View style={styles.loadingState}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                    Fetching live conditions...
                  </Text>
                </View>
              </Card>
            )
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

      {/* ─── Premium Interactive Forecast Modal ─── */}
      <Modal visible={showForecastSheet} transparent animationType="none" onRequestClose={closeSheet}>
        <Animated.View style={[styles.sheetBackdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeSheet} />

          <Animated.View style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + 20,
              transform: [{ translateY: slideAnim }]
            }
          ]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]} />

            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: colors.foreground }}>
                  5-Day Outlook
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    if (Platform.OS !== 'web' && profile.hapticsEnabled) Haptics.selectionAsync();
                    setSelectedDayIndex(-1);
                    setLiveWeather(trueLiveWeather);
                    closeSheet();
                  }}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999 }}
                >
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.foreground }}>
                    Reset to Now
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Day Selector Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {forecast.map((day, index) => {
                  const dayName = index === 0 ? 'Today' : DAYS[day.date.getUTCDay()];
                  const isActive = index === selectedDayIndex;
                  return (
                    <TouchableOpacity
                      key={index}
                      onPress={() => {
                        if (Platform.OS !== 'web' && profile.hapticsEnabled) Haptics.selectionAsync();
                        setSelectedDayIndex(index);
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 999,
                        backgroundColor: isActive ? colors.foreground : 'transparent',
                        borderWidth: isActive ? 0 : 1,
                        borderColor: colors.border
                      }}
                    >
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: isActive ? colors.background : colors.foreground }}>
                        {dayName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Interactive Chart & Scrubber */}
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
              {selectedDayIndex !== -1 && forecast[selectedDayIndex] && (() => {
                const activePoints = forecast[selectedDayIndex].points;
                const currentPoint = activePoints[selectedPointIndex] || activePoints[0];
                const maxTemp = Math.max(...activePoints.map((p: any) => p.temp)) + 2;
                const minTemp = Math.min(...activePoints.map((p: any) => p.temp)) - 2;
                const tempRange = maxTemp - minTemp || 1;

                // ─── Detailed Icon Mapping ───
                const iconPrefix = currentPoint.iconCode.substring(0, 2);
                const isNight = currentPoint.iconCode.includes('n');

                let dynamicIcon = 'sun';
                if (iconPrefix === '01') dynamicIcon = isNight ? 'moon' : 'sun';
                else if (['02', '03', '04'].includes(iconPrefix)) dynamicIcon = 'cloud';
                else if (iconPrefix === '09') dynamicIcon = 'cloud-drizzle';
                else if (iconPrefix === '10') dynamicIcon = 'cloud-rain';
                else if (iconPrefix === '11') dynamicIcon = 'cloud-lightning';
                else if (iconPrefix === '13') dynamicIcon = 'cloud-snow';
                else if (iconPrefix === '50') dynamicIcon = 'wind';

                return (
                  <View style={{ gap: 20 }}>
                    {/* Detailed Readout Card */}
                    <View style={{ backgroundColor: colors.muted, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name={dynamicIcon as any} size={20} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.foreground }}>
                          {currentPoint.timeLabel} • {currentPoint.displayCondition}
                        </Text>
                        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.mutedForeground, marginTop: 4 }}>
                          {currentPoint.temp}° • {currentPoint.pop}% Precip • {currentPoint.humidity}% Humidity
                        </Text>
                      </View>
                    </View>

                    {/* View-Based Bar Chart */}
                    <View style={{ marginTop: 10 }}>
                      {/* Temperature labels row */}
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, marginBottom: 4 }}>
                        {activePoints.map((p: any, i: number) => {
                          const isActivePoint = i === selectedPointIndex;
                          const pct = (p.temp - minTemp) / tempRange;
                          const barHeight = p.isPast ? 2 : Math.max(pct * 80, 6);
                          return (
                            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4, opacity: p.isPast ? 0.3 : 1 }}>
                              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: isActivePoint ? colors.foreground : colors.mutedForeground }}>
                                {p.isPast ? '' : `${p.temp}°`}
                              </Text>
                              <View style={{
                                width: isActivePoint ? 10 : 6,
                                height: barHeight,
                                borderRadius: 4,
                                backgroundColor: isActivePoint ? colors.accent : colors.accent + '55',
                              }} />
                            </View>
                          );
                        })}
                      </View>
                      {/* Time labels row */}
                      <View style={{ flexDirection: 'row' }}>
                        {activePoints.map((p: any, i: number) => {
                          const isActivePoint = i === selectedPointIndex;
                          return (
                            <View key={i} style={{ flex: 1, alignItems: 'center', opacity: p.isPast ? 0.3 : 1 }}>
                              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9, color: isActivePoint ? colors.accent : colors.mutedForeground }} numberOfLines={1}>
                                {p.timeLabel}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>

                    {/* Native Scrubber Slider */}
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.foreground, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                        Time Scrubber
                      </Text>
                      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.mutedForeground, marginBottom: 12 }}>
                        Slide to preview specific hours. The main screen and packing list will update in real-time.
                      </Text>
                      <Slider
                        style={{ width: '100%', height: 40 }}
                        minimumValue={0}
                        maximumValue={activePoints.length - 1}
                        step={1}
                        value={selectedPointIndex}
                        onValueChange={(val: number) => {
                          setSelectedPointIndex(val);
                          if (Platform.OS !== 'web' && profile.hapticsEnabled) Haptics.selectionAsync();
                        }}
                        minimumTrackTintColor={colors.accent}
                        maximumTrackTintColor={colors.muted}
                        thumbTintColor={colors.accent}
                      />
                    </View>
                  </View>
                );
              })()}
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

      {/* ─── FIRST-TIME WELCOME GUIDE (with mascot) ─── */}
      <Modal visible={showWelcomeGuide} transparent animationType="fade">
        <View style={[styles.modalBackdrop, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <View style={[styles.welcomeCard, { backgroundColor: colors.card, borderColor: colors.border, maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>

              <View style={[styles.welcomeHero, { backgroundColor: colors.muted }]}>
                <View style={styles.welcomeHeroOrb} />
                <View style={styles.welcomeHeroOrb2} />
                <DolphinMascot size={150} />
              </View>

              <View style={styles.welcomeGreetRow}>
                <View style={[styles.welcomeGreetDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.welcomeGreetText, { color: colors.mutedForeground }]}>PLAN & PREPARE</Text>
              </View>

              <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
                Hi, let's plan your journey.
              </Text>
              <Text style={[styles.welcomeBody, { color: colors.mutedForeground }]}>
                Search for any destination worldwide. I'll analyze the climate, air quality, and local conditions to help you prepare.
              </Text>

              <View style={styles.welcomeModesList}>
                <View style={styles.welcomeModeRow}>
                  <View style={[styles.welcomeModeIcon, { backgroundColor: colors.muted }]}>
                    <Feather name="cloud" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.welcomeModeTitle, { color: colors.foreground }]}>LIVE FORECASTS</Text>
                    <Text style={[styles.welcomeModeDesc, { color: colors.mutedForeground }]}>
                      Get dynamic weather forecasts and AQI alerts so you're never caught off guard.
                    </Text>
                  </View>
                </View>

                <View style={styles.welcomeModeRow}>
                  <View style={[styles.welcomeModeIcon, { backgroundColor: colors.muted }]}>
                    <Feather name="briefcase" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.welcomeModeTitle, { color: colors.foreground }]}>SMART PACKING</Text>
                    <Text style={[styles.welcomeModeDesc, { color: colors.mutedForeground }]}>
                      Automatically generates a health-conscious packing list tailored to your profile and the local climate.
                    </Text>
                  </View>
                </View>

                <View style={styles.welcomeModeRow}>
                  <View style={[styles.welcomeModeIcon, { backgroundColor: colors.muted }]}>
                    <Feather name="heart" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.welcomeModeTitle, { color: colors.foreground }]}>WATCHLIST</Text>
                    <Text style={[styles.welcomeModeDesc, { color: colors.mutedForeground }]}>
                      Save your favorite destinations to quickly check up on them later.
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.welcomeBtn, { backgroundColor: colors.primary }]}
                onPress={dismissWelcomeGuide}
                activeOpacity={0.85}
              >
                <Text style={[styles.welcomeBtnText, { color: colors.primaryForeground }]}>Let's go</Text>
                <Feather name="arrow-right" size={18} color={colors.primaryForeground} style={{ marginLeft: 8 }} />
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
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
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.3 },
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
  suggestionsContainer: { maxHeight: 200, borderWidth: 1, borderRadius: 16, marginTop: -4 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  suggestionText: { fontFamily: 'Inter_500Medium', fontSize: 14, flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  welcomeCard: { width: '100%', borderRadius: 24, padding: 24, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  welcomeHero: { width: '100%', height: 160, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 24, overflow: 'hidden' },
  welcomeHeroOrb: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)', top: -40, left: -40 },
  welcomeHeroOrb2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.03)', bottom: -20, right: -20 },
  welcomeGreetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  welcomeGreetDot: { width: 8, height: 8, borderRadius: 4 },
  welcomeGreetText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.5 },
  welcomeTitle: { fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -0.5, marginBottom: 10 },
  welcomeBody: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22, marginBottom: 28 },
  welcomeModesList: { gap: 20, marginBottom: 32 },
  welcomeModeRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  welcomeModeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  welcomeModeTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, letterSpacing: 0.5, marginBottom: 4 },
  welcomeModeDesc: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 },
  welcomeBtn: { width: '100%', paddingVertical: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  welcomeBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
});