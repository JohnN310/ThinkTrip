import { Destination } from './destinations';

export interface ProfileContextState {
  displayName: string;
  email: string;
  homeCity: string;
  skinType: "dry" | "oily" | "combination" | "reactive";
  usesRetinoids: boolean;
  usesBenzoylPeroxide: boolean;
  usesChemicalExfoliants: boolean;
  fragranceFree: boolean;
  sodiumSensitive: boolean;
  caffeineLimit: boolean;
  glutenFree: boolean;
  dairyFree: boolean;
  shellfishAllergy: boolean;
  peanutAllergy: boolean;
  activityLevel: "low" | "moderate" | "high";
  travelType: "business" | "vacation" | "adventure" | "wellness";
  units: "metric" | "imperial";
  hapticsEnabled: boolean;
  liveAlertsEnabled: boolean;
  locationRoutingEnabled: boolean;
  savedLocations?: string[];
  expoPushToken?: string;
  avatarEmoji?: string;
  avatarColor?: string;
  themePreference?: "system" | "light" | "dark";
}

export type Priority = 'essential' | 'recommended' | 'optional';
export type Category = 'Climate & Respiratory' | 'Systemic & Dietary' | 'Physical & Transit';

export interface PackingItem {
  id: string;
  title: string;
  reason: string;
  priority: Priority;
  category: Category;
  emoji: string;
}

export interface LiveWeatherContext {
  tempLow: number;
  tempHigh: number;
  humidity: number;
  aqiLabel: string;
  iconCode: string;
}

export const buildPackingList = (
  profile: ProfileContextState,
  destination: Destination,
  liveWeather?: LiveWeatherContext | null
): PackingItem[] => {
  const items: PackingItem[] = [];
  let idCounter = 0;

  const add = (priority: Priority, category: Category, title: string, reason: string, emoji: string) => {
    items.push({ id: `item_${idCounter++}`, priority, category, title, reason, emoji });
  };

  // 1. Determine which data source to use
  const humidity = liveWeather ? liveWeather.humidity : destination.climate.humidity;
  const tempLow = liveWeather ? liveWeather.tempLow : destination.climate.tempLow;
  const tempHigh = liveWeather ? liveWeather.tempHigh : destination.climate.tempHigh;
  const iconCode = liveWeather ? liveWeather.iconCode : '01d';
  const iconPrefix = iconCode.substring(0, 2);
  const isNight = iconCode.includes('n');
  const aqi = liveWeather ? liveWeather.aqiLabel : 'Unknown';

  // 2. Safely handle Metric vs Imperial thresholds
  const isMetric = profile.units === 'metric';
  const tempUnit = isMetric ? '°C' : '°F';
  const coldThreshold = isMetric ? 10 : 50;
  const hotThreshold = isMetric ? 28 : 82;

  // ─── RESPIRATORY & CLIMATE HEALTH ───

  if (aqi === 'Poor' || aqi === 'Very Poor') {
    add('essential', 'Climate & Respiratory', 'N95 / KN95 Respirator Masks', `Air quality is ${aqi}. A mask is recommended for outdoor activities.`, '😷');
    add('recommended', 'Climate & Respiratory', 'Saline nasal flush', 'Helps clear particulate matter from sinus passages after outdoor exposure.', '👃');
  }

  if (humidity <= 30) {
    add('essential', 'Climate & Respiratory', 'Hydrating eye drops & nasal spray', `Low humidity (${humidity}%) can cause dehydration. Keep eyes and sinuses lubricated.`, '💧');
    add('recommended', 'Climate & Respiratory', 'Barrier repair moisturizer', 'Protects the skin barrier and prevents moisture loss in dry conditions.', '🧴');
  } else if (humidity >= 70) {
    if (profile.usesChemicalExfoliants || profile.usesRetinoids) {
      add('recommended', 'Climate & Respiratory', 'Pause topical actives', `High humidity (${humidity}%) increases skin sensitivity to strong active ingredients.`, '⚠️');
    }
  }

  if (tempLow <= coldThreshold) {
    add('essential', 'Climate & Respiratory', 'Thermal base layers', `Recommended for core temperature regulation in ${tempLow}${tempUnit} weather.`, '🧥');
  }

  if (tempHigh >= hotThreshold) {
    add('recommended', 'Climate & Respiratory', 'Daily electrolyte packets', `Recommended to replenish electrolytes during high temperatures (${tempHigh}${tempUnit}).`, '⚡');
  }

  if (iconPrefix === '01' && !isNight) {
    add('essential', 'Climate & Respiratory', 'Broad-spectrum SPF 50+', 'Essential daily protection against high UV exposure.', '🧴');
  }

  if (['09', '10', '11'].includes(iconPrefix)) {
    add('essential', 'Climate & Respiratory', 'Compact travel umbrella', 'Precipitation expected. Recommended to maintain core temperature and remain dry.', '☂️');
  }

  // ─── SYSTEMIC & DIETARY HEALTH ───

  if (profile.shellfishAllergy || profile.peanutAllergy) {
    add('essential', 'Systemic & Dietary', 'EpiPen (2x) & Antihistamines', 'Critical allergy protocol. Keep accessible in your personal carry-on.', '💉');
    add('essential', 'Systemic & Dietary', 'Translated allergy cards', 'Ensures clear communication of severe dietary restrictions when dining.', '📇');
  }

  if (profile.glutenFree || profile.dairyFree) {
    add('recommended', 'Systemic & Dietary', 'Digestive enzymes', 'Provides digestive support against potential dietary cross-contamination.', '💊');
  }

  if (profile.sodiumSensitive) {
    add('recommended', 'Systemic & Dietary', 'Potassium-rich snacks', 'Helps maintain hydration balance to offset high-sodium travel meals.', '🍌');
  }

  if (profile.caffeineLimit) {
    add('optional', 'Systemic & Dietary', 'Magnesium / Melatonin', 'Supports sleep regulation and circadian adjustment during travel.', '💤');
  }

  // ─── PHYSICAL CONDITIONING ───

  if (profile.activityLevel === 'high' || profile.travelType === 'adventure') {
    add('essential', 'Physical & Transit', 'Blister dressings', 'Prevents blistering during periods of elevated physical activity.', '🩹');
    add('recommended', 'Physical & Transit', 'Compression socks', 'Supports circulation and reduces swelling during prolonged transit.', '🧦');
  }

  return items;
};