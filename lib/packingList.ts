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
  savedLocations?: string[];
  expoPushToken?: string;
  avatarEmoji?: string;
  avatarColor?: string;
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
  condition: string;
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
  const condition = liveWeather ? liveWeather.condition : 'Unknown';
  const aqi = liveWeather ? liveWeather.aqiLabel : 'Unknown';

  // 2. Safely handle Metric vs Imperial thresholds
  const isMetric = profile.units === 'metric';
  const tempUnit = isMetric ? '°C' : '°F';
  const coldThreshold = isMetric ? 10 : 50;
  const hotThreshold = isMetric ? 28 : 82;

  // ─── RESPIRATORY & CLIMATE HEALTH ───

  if (aqi === 'Poor' || aqi === 'Very Poor') {
    add('essential', 'Climate & Respiratory', 'N95 / KN95 Respirator Masks', `Current air quality is ${aqi}. Protect your respiratory baseline.`, '😷');
    add('recommended', 'Climate & Respiratory', 'Sterile saline nasal flush', 'Clears airborne particulate matter from sinus passages after exposure.', '👃');
  }

  if (humidity <= 30) {
    add('essential', 'Climate & Respiratory', 'Hydrating eye drops & nasal spray', `Humidity ${humidity}% will rapidly dehydrate mucous membranes.`, '💧');
    add('recommended', 'Climate & Respiratory', 'Occlusive skin barrier repair', 'Prevents extreme transepidermal water loss in dry climates.', '🧴');
  } else if (humidity >= 70) {
    if (profile.usesChemicalExfoliants || profile.usesRetinoids) {
      add('recommended', 'Climate & Respiratory', 'Pause topical actives', `High humidity (${humidity}%) increases absorption and risks chemical burns.`, '⚠️');
    }
  }

  if (tempLow <= coldThreshold) {
    add('essential', 'Climate & Respiratory', 'Thermal base layers', `Core temperature regulation for lows around ${tempLow}${tempUnit}.`, '🧥');
  }

  if (tempHigh >= hotThreshold) {
    add('recommended', 'Climate & Respiratory', 'Daily electrolyte packets', `Highs around ${tempHigh}${tempUnit} will accelerate sodium depletion through sweat.`, '⚡');
  }

  if (condition === 'Sunny' || condition === 'Clear') {
    add('essential', 'Climate & Respiratory', 'Broad-spectrum SPF 50+', 'Essential daily cellular protection against UV radiation.', '🧴');
  }

  if (condition === 'Rain' || condition === 'Drizzle' || condition === 'Thunderstorm') {
    add('essential', 'Climate & Respiratory', 'Compact travel umbrella', 'Active precipitation detected. Maintain external dryness to prevent rapid core heat loss.', '☂️');
  }

  // ─── SYSTEMIC & DIETARY HEALTH ───

  if (profile.shellfishAllergy || profile.peanutAllergy) {
    add('essential', 'Systemic & Dietary', 'EpiPen (2x) & Antihistamines', 'Critical anaphylaxis protocol. Keep in your personal carry-on item at all times.', '💉');
    add('essential', 'Systemic & Dietary', 'Translated allergy medical cards', 'Ensure exact communication of severe allergies in local dining environments.', '📇');
  }

  if (profile.glutenFree || profile.dairyFree) {
    add('recommended', 'Systemic & Dietary', 'Broad-spectrum digestive enzymes', 'Mitigates inflammatory response from cross-contamination in restaurant kitchens.', '💊');
  }

  if (profile.sodiumSensitive) {
    add('recommended', 'Systemic & Dietary', 'Potassium-rich snacks', 'Balances cellular hydration, as travel dining heavily exceeds daily sodium baselines.', '🍌');
  }

  if (profile.caffeineLimit) {
    add('optional', 'Systemic & Dietary', 'Magnesium glycinate / Melatonin', 'Supports circadian rhythm adjustment without relying on morning caffeine spikes.', '💤');
  }

  // ─── PHYSICAL CONDITIONING ───

  if (profile.activityLevel === 'high' || profile.travelType === 'adventure') {
    add('essential', 'Physical & Transit', 'Hydrocolloid blister dressings', 'Pre-empts structural foot damage from elevated daily step counts.', '🩹');
    add('recommended', 'Physical & Transit', 'Graduated compression socks', 'Aids vascular return and reduces lower-extremity edema during transit.', '🧦');
  }

  return items;
};