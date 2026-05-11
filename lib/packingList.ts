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

export interface ProductSample {
  brand: string;
  name: string;
  price: string;
  query: string;
}

export interface PackingItem {
  id: string;
  title: string;
  reason: string;
  priority: Priority;
  category: Category;
  emoji: string;
  detailedDescription?: string;
  productSamples?: ProductSample[];
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

  const add = (
    priority: Priority,
    category: Category,
    title: string,
    reason: string,
    emoji: string,
    detailedDescription?: string,
    productSamples?: ProductSample[]
  ) => {
    items.push({
      id: `item_${idCounter++}`,
      priority,
      category,
      title,
      reason,
      emoji,
      detailedDescription,
      productSamples,
    });
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

  // Note that we can use brand names here for when we do sponsorships.
  // ─── RESPIRATORY & CLIMATE HEALTH ───

  if (aqi === 'Poor' || aqi === 'Very Poor') {
    add('essential', 'Climate & Respiratory', 'N95 / KN95 Respirator Masks', `Air quality is ${aqi}. A mask is recommended for outdoor activities.`, '😷',
      "High concentrations of particulate matter (PM2.5) can cause immediate respiratory inflammation and long-term health issues. An N95 or KN95 respirator filters out 95% of these airborne particles.",
      [
        { brand: '3M', name: 'Aura N95 Particulate Respirator', price: '$15.00', query: '3M Aura N95 Particulate Respirator' },
        { brand: 'Powecom', name: 'KN95 Protective Mask', price: '$12.00', query: 'Powecom KN95 Protective Mask' }
      ]
    );
    add('recommended', 'Climate & Respiratory', 'Saline nasal flush', 'Helps clear particulate matter from sinus passages after outdoor exposure.', '👃',
      "Smog and dust settle in your nasal passages, leading to congestion and sinus headaches. A daily saline flush safely washes away these irritants.",
      [
        { brand: 'NeilMed', name: 'Sinus Rinse Kit', price: '$14.00', query: 'NeilMed Sinus Rinse Kit' },
        { brand: 'Arm & Hammer', name: 'Simply Saline Nasal Mist', price: '$8.00', query: 'Simply Saline Nasal Mist' }
      ]
    );
  }

  if (humidity <= 30) {
    add('essential', 'Climate & Respiratory', 'Hydrating eye drops & nasal spray', `Low humidity (${humidity}%) can cause dehydration. Keep eyes and sinuses lubricated.`, '💧',
      "Air travel and extremely dry climates rapidly evaporate the natural moisture barrier in your eyes and sinuses, causing irritation and micro-abrasions.",
      [
        { brand: 'Systane', name: 'Ultra Lubricant Eye Drops', price: '$12.00', query: 'Systane Ultra Lubricant Eye Drops' },
        { brand: 'Rhinase', name: 'Lubricating Nasal Gel', price: '$10.00', query: 'Rhinase Lubricating Nasal Gel' }
      ]
    );
    add('recommended', 'Climate & Respiratory', 'Barrier repair moisturizer', 'Protects the skin barrier and prevents moisture loss in dry conditions.', '🧴',
      "When humidity drops, transepidermal water loss accelerates. You need an occlusive moisturizer (containing ceramides or petrolatum) to seal in hydration.",
      [
        { brand: 'CeraVe', name: 'Moisturizing Cream', price: '$16.00', query: 'CeraVe Moisturizing Cream' },
        { brand: 'La Roche-Posay', name: 'Cicaplast Baume B5', price: '$18.00', query: 'La Roche-Posay Cicaplast Baume B5' }
      ]
    );
  } else if (humidity >= 70) {
    if (profile.usesChemicalExfoliants || profile.usesRetinoids) {
      add('recommended', 'Climate & Respiratory', 'Pause topical actives', `High humidity (${humidity}%) increases skin sensitivity to strong active ingredients.`, '⚠️',
        "High humidity drastically increases the skin's permeability. Using strong acids or retinoids in these conditions can lead to unexpected chemical burns and severe irritation.",
        []
      );
    }
  }

  if (tempLow <= coldThreshold) {
    add('essential', 'Climate & Respiratory', 'Thermal base layers', `Recommended for core temperature regulation in ${tempLow}${tempUnit} weather.`, '🧥',
      "Proper thermal regulation starts close to the body. Merino wool or synthetic thermal blends trap body heat and wick away moisture, preventing rapid core temperature drops.",
      [
        { brand: 'Smartwool', name: 'Classic Thermal Merino Base Layer', price: '$115.00', query: 'Smartwool Classic Thermal Merino Base Layer' },
        { brand: 'Uniqlo', name: 'HEATTECH Extra Warm', price: '$25.00', query: 'Uniqlo HEATTECH Extra Warm' }
      ]
    );
  }

  if (tempHigh >= hotThreshold) {
    add('recommended', 'Climate & Respiratory', 'Daily electrolyte packets', `Recommended to replenish electrolytes during high temperatures (${tempHigh}${tempUnit}).`, '⚡',
      "Sweating depletes crucial minerals like sodium, potassium, and magnesium. Drinking plain water isn't enough to prevent heat exhaustion and muscle cramping in high temperatures.",
      [
        { brand: 'Liquid I.V.', name: 'Hydration Multiplier', price: '$24.00', query: 'Liquid I.V. Hydration Multiplier' },
        { brand: 'LMNT', name: 'Zero-Sugar Electrolytes', price: '$45.00', query: 'LMNT Zero-Sugar Electrolytes' }
      ]
    );
  }

  if (iconPrefix === '01' && !isNight) {
    add('essential', 'Climate & Respiratory', 'Broad-spectrum SPF 50+', 'Essential daily protection against high UV exposure.', '🧴',
      "UV radiation damages cellular DNA and accelerates photoaging. Broad-spectrum protection is required daily, especially when spending extended hours navigating a new city outdoors.",
      [
        { brand: 'Supergoop!', name: 'Unseen Sunscreen SPF 40', price: '$38.00', query: 'Supergoop Unseen Sunscreen' },
        { brand: 'EltaMD', name: 'UV Clear Broad-Spectrum SPF 46', price: '$41.00', query: 'EltaMD UV Clear Broad-Spectrum' }
      ]
    );
  }

  if (['09', '10', '11'].includes(iconPrefix)) {
    add('essential', 'Climate & Respiratory', 'Compact travel umbrella', 'Precipitation expected. Recommended to maintain core temperature and remain dry.', '☂️',
      "Staying dry is essential to maintaining body temperature and comfort. A highly wind-resistant, compact umbrella is the most efficient defense against sudden downpours.",
      [
        { brand: 'Repel', name: 'Windproof Travel Umbrella', price: '$29.00', query: 'Repel Windproof Travel Umbrella' },
        { brand: 'Davek', name: 'The Davek Mini', price: '$59.00', query: 'Davek Mini Travel Umbrella' }
      ]
    );
  }

  // ─── SYSTEMIC & DIETARY HEALTH ───

  if (profile.shellfishAllergy || profile.peanutAllergy) {
    add('essential', 'Systemic & Dietary', 'EpiPen (2x) & Antihistamines', 'Critical allergy protocol. Keep accessible in your personal carry-on.', '💉',
      "Language barriers and unfamiliar ingredients dramatically increase the risk of accidental allergen exposure. You must carry immediate anaphylaxis treatments on your person at all times.",
      [
        { brand: 'Benadryl', name: 'Allergy Ultratabs', price: '$9.00', query: 'Benadryl Allergy Ultratabs' }
      ]
    );
    add('essential', 'Systemic & Dietary', 'Translated allergy cards', 'Ensures clear communication of severe dietary restrictions when dining.', '📇',
      "Restaurant kitchens need explicit instructions to prevent cross-contamination. Professionally translated cards leave no room for misinterpretation by local chefs.",
      [
        { brand: 'Equal Eats', name: 'Custom Plastic Allergy Translation Card', price: '$15.00', query: 'Equal Eats Translation Card' }
      ]
    );
  }

  if (profile.glutenFree || profile.dairyFree) {
    add('recommended', 'Systemic & Dietary', 'Digestive enzymes', 'Provides digestive support against potential dietary cross-contamination.', '💊',
      "Trace amounts of gluten or dairy can trigger severe inflammatory responses. Broad-spectrum enzymes can help mitigate symptoms from minor, accidental cross-contamination.",
      [
        { brand: 'Zenwise', name: 'Digestive Enzymes Plus Prebiotics', price: '$26.00', query: 'Zenwise Digestive Enzymes' },
        { brand: 'Enzymedica', name: 'Digest Gold', price: '$30.00', query: 'Enzymedica Digest Gold' }
      ]
    );
  }

  if (profile.sodiumSensitive) {
    add('recommended', 'Systemic & Dietary', 'Potassium-rich snacks', 'Helps maintain hydration balance to offset high-sodium travel meals.', '🍌',
      "Restaurant and airport food is notoriously high in sodium, leading to cellular dehydration and bloating. Potassium helps flush out excess sodium and restore balance.",
      [
        { brand: 'Bare', name: 'Baked Banana Chips', price: '$18.00', query: 'Bare Baked Banana Chips' },
        { brand: 'Pistachio Chewy Bites', name: 'Snack Bars', price: '$22.00', query: 'Pistachio Chewy Bites' }
      ]
    );
  }

  if (profile.caffeineLimit) {
    add('optional', 'Systemic & Dietary', 'Magnesium / Melatonin', 'Supports sleep regulation and circadian adjustment during travel.', '💤',
      "Crossing time zones disrupts your circadian rhythm. Magnesium glycinate relaxes the nervous system, while low-dose melatonin signals your brain that it's time to sleep.",
      [
        { brand: 'OLLY', name: 'Sleep Blackberry Zen Gummies', price: '$14.00', query: 'OLLY Sleep Gummies' },
        { brand: 'Doctor\'s Best', name: 'High Absorption Magnesium', price: '$16.00', query: 'Doctor\'s Best Magnesium Glycinate' }
      ]
    );
  }

  // ─── PHYSICAL CONDITIONING ───

  if (profile.activityLevel === 'high' || profile.travelType === 'adventure') {
    add('essential', 'Physical & Transit', 'Blister dressings', 'Prevents blistering during periods of elevated physical activity.', '🩹',
      "Travel often doubles or triples your daily step count. Hydrocolloid dressings act as a second skin to prevent friction damage and heal existing blisters fast.",
      [
        { brand: 'Compeed', name: 'Advanced Blister Care Cushions', price: '$10.00', query: 'Compeed Blister Cushions' },
        { brand: 'Band-Aid', name: 'Hydro Seal Blister Heels', price: '$6.00', query: 'Band-Aid Hydro Seal Blister' }
      ]
    );
    add('recommended', 'Physical & Transit', 'Compression socks', 'Supports circulation and reduces swelling during prolonged transit.', '🧦',
      "Prolonged sitting in transit causes blood to pool in your lower extremities, leading to edema (swelling) and increasing the risk of deep vein thrombosis (DVT).",
      [
        { brand: 'Sockwell', name: 'Circulator Compression Socks', price: '$30.00', query: 'Sockwell Compression Socks' },
        { brand: 'Bombas', name: 'Everyday Compression Socks', price: '$28.00', query: 'Bombas Compression Socks' }
      ]
    );
  }

  return items;
};