// import * as BackgroundFetch from 'expo-background-fetch';
// import * as TaskManager from 'expo-task-manager';
// import * as Notifications from 'expo-notifications';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// const WEATHER_TASK_NAME = 'background-weather-check';
// const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_WEATHER_KEY;

// // 12 hours in milliseconds
// const NOTIFICATION_COOLDOWN = 12 * 60 * 60 * 1000;

// const getAqiLabel = (aqiIndex: number) => {
//   const labels = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
//   return labels[aqiIndex - 1] || 'Unknown';
// };

// TaskManager.defineTask(WEATHER_TASK_NAME, async () => {
//   try {
//     const savedLocationsRaw = await AsyncStorage.getItem('THINKTRIP_SAVED_LOCATIONS');
//     const units = await AsyncStorage.getItem('THINKTRIP_UNITS') || 'metric';
//     const savedLocations: string[] = savedLocationsRaw ? JSON.parse(savedLocationsRaw) : [];

//     if (savedLocations.length === 0) return BackgroundFetch.BackgroundFetchResult.NoData;

//     let hasNewData = false;

//     for (const city of savedLocations) {
//       // 1. Anti-Spam Check
//       const lastNotifiedKey = `@alert_last_notified_${city.replace(/\s+/g, '_')}`;
//       const lastNotified = await AsyncStorage.getItem(lastNotifiedKey);
//       const now = Date.now();

//       if (lastNotified && (now - parseInt(lastNotified)) < NOTIFICATION_COOLDOWN) {
//         continue;
//       }

//       // 2. Fetch Weather
//       const weatherRes = await fetch(
//         `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=${units}&appid=${OPENWEATHER_API_KEY}`
//       );
//       const weatherData = await weatherRes.json();

//       if (!weatherRes.ok || !weatherData.coord) continue;

//       const { lat, lon } = weatherData.coord;
//       const mainCond = weatherData.weather[0]?.main;

//       // 3. Fetch AQI
//       const aqiRes = await fetch(
//         `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`
//       );
//       const aqiData = await aqiRes.json();
//       const aqiIndex = aqiData.list?.[0]?.main?.aqi || 1;
//       const aqiLabel = getAqiLabel(aqiIndex);

//       // 4. Evaluate Severe Conditions
//       const isThunderstorm = mainCond === 'Thunderstorm';
//       const isSnow = mainCond === 'Snow';
//       const isVeryPoorAQI = aqiLabel === 'Very Poor';

//       if (isThunderstorm || isSnow || isVeryPoorAQI) {
//         let alertBody = '';
//         if (isThunderstorm) alertBody = 'Thunderstorm detected. Core heat loss risk elevated.';
//         else if (isSnow) alertBody = 'Snow detected. Thermal regulation required.';
//         else if (isVeryPoorAQI) alertBody = 'Extreme particulate matter detected. Respiratory protection advised.';

//         await Notifications.scheduleNotificationAsync({
//           content: {
//             title: `ThinkTrip: ${city} 🚨`,
//             body: alertBody,
//             sound: true,
//             priority: Notifications.AndroidNotificationPriority.HIGH,
//           },
//           trigger: null,
//         });

//         // Update last notified timestamp
//         await AsyncStorage.setItem(lastNotifiedKey, now.toString());
//         hasNewData = true;
//       }
//     }

//     return hasNewData ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
//   } catch (error) {
//     console.error('Background weather task failed:', error);
//     return BackgroundFetch.BackgroundFetchResult.Failed;
//   }
// });

// export const registerBackgroundWeatherTask = async () => {
//   return BackgroundFetch.registerTaskAsync(WEATHER_TASK_NAME, {
//     minimumInterval: 60 * 15, // 15 minutes
//     // minimumInterval: 10, // 10 seconds
//     stopOnTerminate: false,
//     startOnBoot: true,
//   });
// };

// export const unregisterBackgroundWeatherTask = async () => {
//   try {
//     const isRegistered = await TaskManager.isTaskRegisteredAsync(WEATHER_TASK_NAME);
//     if (isRegistered) {
//       return await BackgroundFetch.unregisterTaskAsync(WEATHER_TASK_NAME);
//     }
//   } catch (error) {
//     console.warn('Failed to unregister task gracefully:', error);
//   }
// };
