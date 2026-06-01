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
  // NEW: Replace boolean allergies with dynamic arrays
  allergies: string[]; 
  customAllergies: string[];
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
  scanSourceLanguage?: string;
  scanTargetLanguage?: string;
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
  icon: string;
  detailedDescription?: string;
  productSamples?: ProductSample[];
  warning?: string;
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
    icon: string,
    detailedDescription?: string,
    productSamples?: ProductSample[],
    warning?: string
  ) => {
    items.push({
      id: `item_${idCounter++}`,
      priority,
      category,
      title,
      reason,
      icon,
      detailedDescription,
      productSamples,
      warning,
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

  const DRUG_WARNING = "Consult a healthcare professional before using new medications or supplements.";

  // Note that we can use brand names here for when we do sponsorships.
  // ─── RESPIRATORY & CLIMATE HEALTH ───

  if (aqi === 'Poor' || aqi === 'Very Poor') {
    add('essential', 'Climate & Respiratory', 'N95 / KN95 Respirator Masks', `Air quality is ${aqi}. A mask is recommended for outdoor activities.`, 'shield',
      "High concentrations of particulate matter (PM2.5) can cause immediate respiratory inflammation and long-term health issues. An N95 or KN95 respirator filters out 95% of these airborne particles.",
      [
        { brand: '3M', name: 'Aura N95 Particulate Respirator', price: '$15.00', query: '3M Aura N95 Particulate Respirator' },
        { brand: 'Powecom', name: 'KN95 Protective Mask', price: '$12.00', query: 'Powecom KN95 Protective Mask' }
      ]
    );
    add('recommended', 'Climate & Respiratory', 'Saline nasal flush', 'Helps clear particulate matter from sinus passages after outdoor exposure.', 'droplet',
      "Smog and dust settle in your nasal passages, leading to congestion and sinus headaches. A daily saline flush safely washes away these irritants.",
      [
        { brand: 'NeilMed', name: 'Sinus Rinse Kit', price: '$14.00', query: 'NeilMed Sinus Rinse Kit' },
        { brand: 'Arm & Hammer', name: 'Simply Saline Nasal Mist', price: '$8.00', query: 'Simply Saline Nasal Mist' }
      ]
    );
  }

  if (humidity <= 30) {
    add('essential', 'Climate & Respiratory', 'Hydrating eye drops & nasal spray', `Low humidity (${humidity}%) can cause dehydration. Keep eyes and sinuses lubricated.`, 'droplet',
      "Air travel and extremely dry climates rapidly evaporate the natural moisture barrier in your eyes and sinuses, causing irritation and micro-abrasions.",
      [
        { brand: 'Systane', name: 'Ultra Lubricant Eye Drops', price: '$12.00', query: 'Systane Ultra Lubricant Eye Drops' },
        { brand: 'Rhinase', name: 'Lubricating Nasal Gel', price: '$10.00', query: 'Rhinase Lubricating Nasal Gel' }
      ]
    );
    add('recommended', 'Climate & Respiratory', 'Barrier repair moisturizer', 'Protects the skin barrier and prevents moisture loss in dry conditions.', 'shield',
      "When humidity drops, transepidermal water loss accelerates. You need an occlusive moisturizer (containing ceramides or petrolatum) to seal in hydration.",
      [
        { brand: 'CeraVe', name: 'Moisturizing Cream', price: '$16.00', query: 'CeraVe Moisturizing Cream' },
        { brand: 'La Roche-Posay', name: 'Cicaplast Baume B5', price: '$18.00', query: 'La Roche-Posay Cicaplast Baume B5' }
      ]
    );
  }

  if (tempLow <= coldThreshold) {
    add('essential', 'Climate & Respiratory', 'Thermal base layers', `Recommended for core temperature regulation in ${tempLow}${tempUnit} weather.`, 'layers',
      "Proper thermal regulation starts close to the body. Merino wool or synthetic thermal blends trap body heat and wick away moisture, preventing rapid core temperature drops.",
      [
        { brand: 'Smartwool', name: 'Classic Thermal Merino Base Layer', price: '$115.00', query: 'Smartwool Classic Thermal Merino Base Layer' },
        { brand: 'Uniqlo', name: 'HEATTECH Extra Warm', price: '$25.00', query: 'Uniqlo HEATTECH Extra Warm' }
      ]
    );
  }

  if (tempHigh >= hotThreshold) {
    add('recommended', 'Climate & Respiratory', 'Daily electrolyte packets', `Recommended to replenish electrolytes during high temperatures (${tempHigh}${tempUnit}).`, 'zap',
      "Sweating depletes crucial minerals like sodium, potassium, and magnesium. Drinking plain water isn't enough to prevent heat exhaustion and muscle cramping in high temperatures.",
      [
        { brand: 'Liquid I.V.', name: 'Hydration Multiplier', price: '$24.00', query: 'Liquid I.V. Hydration Multiplier' },
        { brand: 'LMNT', name: 'Zero-Sugar Electrolytes', price: '$45.00', query: 'LMNT Zero-Sugar Electrolytes' }
      ]
    );
  }

  if (iconPrefix === '01' && !isNight) {
    add('essential', 'Climate & Respiratory', 'Broad-spectrum SPF 50+', 'Essential daily protection against high UV exposure.', 'sun',
      "UV radiation damages cellular DNA and accelerates photoaging. Broad-spectrum protection is required daily, especially when spending extended hours navigating a new city outdoors.",
      [
        { brand: 'Supergoop!', name: 'Unseen Sunscreen SPF 40', price: '$38.00', query: 'Supergoop Unseen Sunscreen' },
        { brand: 'EltaMD', name: 'UV Clear Broad-Spectrum SPF 46', price: '$41.00', query: 'EltaMD UV Clear Broad-Spectrum' }
      ]
    );
  }

  if (['09', '10', '11'].includes(iconPrefix)) {
    add('essential', 'Climate & Respiratory', 'Compact travel umbrella', 'Precipitation expected. Recommended to maintain core temperature and remain dry.', 'umbrella',
      "Staying dry is essential to maintaining body temperature and comfort. A highly wind-resistant, compact umbrella is the most efficient defense against sudden downpours.",
      [
        { brand: 'Repel', name: 'Windproof Travel Umbrella', price: '$29.00', query: 'Repel Windproof Travel Umbrella' },
        { brand: 'Davek', name: 'The Davek Mini', price: '$59.00', query: 'Davek Mini Travel Umbrella' }
      ]
    );
  }

  // ─── SYSTEMIC & DIETARY HEALTH ───

  // 1. Severe Anaphylaxis Risks (Triggers EpiPen)
  const severeRisks = ['Peanuts', 'Tree Nuts', 'Shellfish', 'Fish', 'Bee Stings', 'Latex', 'Penicillin'];
  const hasSevereAllergy = profile.allergies?.some(a => severeRisks.includes(a));

  if (hasSevereAllergy) {
    add('essential', 'Systemic & Dietary', 'EpiPen (2x) & Antihistamines', 'Critical allergy protocol. Keep accessible in your personal carry-on.', 'alert-triangle',
      "Language barriers and unfamiliar ingredients dramatically increase the risk of accidental allergen exposure. You must carry immediate anaphylaxis treatments on your person at all times.",
      [
        { brand: 'Benadryl', name: 'Allergy Ultratabs', price: '$9.00', query: 'Benadryl Allergy Ultratabs' }
      ],
      DRUG_WARNING
    );
    add('essential', 'Systemic & Dietary', 'Translated allergy cards', 'Ensures clear communication of severe dietary restrictions when dining.', 'credit-card',
      "Restaurant kitchens need explicit instructions to prevent cross-contamination. Professionally translated cards leave no room for misinterpretation by local chefs.",
      [
        { brand: 'Equal Eats', name: 'Custom Plastic Allergy Translation Card', price: '$15.00', query: 'Equal Eats Translation Card' }
      ]
    );
  }

  // 2. Environmental Allergies (Triggers Antihistamines)
  const hasEnvironmentalAllergy = profile.allergies?.some(a => ['Pollen', 'Dust Mites'].includes(a));
  if (hasEnvironmentalAllergy) {
    add('recommended', 'Systemic & Dietary', 'Non-drowsy Antihistamines', 'Recommended for environmental allergen exposure in new climates.', 'wind',
      "Different regions harbor completely different pollen and dust profiles. A daily non-drowsy antihistamine prevents sudden flare-ups from local flora.",
      [
        { brand: 'Zyrtec', name: '24 Hour Allergy Relief', price: '$18.00', query: 'Zyrtec 24 Hour Allergy Relief' },
        { brand: 'Claritin', name: 'Non-Drowsy Allergy Tablets', price: '$15.00', query: 'Claritin Allergy Tablets' }
      ]
    );
  }

  // 3. Custom Free-Text Allergies (Catch-all reminder)
  if (profile.customAllergies && profile.customAllergies.length > 0) {
    add('essential', 'Systemic & Dietary', 'Personalized allergy medication', 'Bring specific medications for your custom logged allergies.', 'crosshair',
      `You noted specific allergies (${profile.customAllergies.join(', ')}). Ensure you pack all necessary personalized prescriptions and over-the-counter remedies.`,
      [],
      DRUG_WARNING
    );
  }

  if (profile.glutenFree || profile.dairyFree) {
    add('recommended', 'Systemic & Dietary', 'Digestive enzymes', 'Provides digestive support against potential dietary cross-contamination.', 'activity',
      "Trace amounts of gluten or dairy can trigger severe inflammatory responses. Broad-spectrum enzymes can help mitigate symptoms from minor, accidental cross-contamination.",
      [
        { brand: 'Zenwise', name: 'Digestive Enzymes Plus Prebiotics', price: '$26.00', query: 'Zenwise Digestive Enzymes' },
        { brand: 'Enzymedica', name: 'Digest Gold', price: '$30.00', query: 'Enzymedica Digest Gold' }
      ],
      DRUG_WARNING
    );
  }

  if (profile.sodiumSensitive) {
    add('recommended', 'Systemic & Dietary', 'Potassium-rich snacks', 'Helps maintain hydration balance to offset high-sodium travel meals.', 'coffee',
      "Restaurant and airport food is notoriously high in sodium, leading to cellular dehydration and bloating. Potassium helps flush out excess sodium and restore balance.",
      [
        { brand: 'Bare', name: 'Baked Banana Chips', price: '$18.00', query: 'Bare Baked Banana Chips' },
        { brand: 'Pistachio Chewy Bites', name: 'Snack Bars', price: '$22.00', query: 'Pistachio Chewy Bites' }
      ]
    );
  }

  if (profile.caffeineLimit) {
    add('optional', 'Systemic & Dietary', 'Magnesium / Melatonin', 'Supports sleep regulation and circadian adjustment during travel.', 'moon',
      "Crossing time zones disrupts your circadian rhythm. Magnesium glycinate relaxes the nervous system, while low-dose melatonin signals your brain that it's time to sleep.",
      [
        { brand: 'OLLY', name: 'Sleep Blackberry Zen Gummies', price: '$14.00', query: 'OLLY Sleep Gummies' },
        { brand: 'Doctor\'s Best', name: 'High Absorption Magnesium', price: '$16.00', query: 'Doctor\'s Best Magnesium Glycinate' }
      ],
      DRUG_WARNING
    );
  }

  // ─── PHYSICAL CONDITIONING ───

  if (profile.activityLevel === 'high' || profile.travelType === 'adventure') {
    add('essential', 'Physical & Transit', 'Blister dressings', 'Prevents blistering during periods of elevated physical activity.', 'plus',
      "Travel often doubles or triples your daily step count. Hydrocolloid dressings act as a second skin to prevent friction damage and heal existing blisters fast.",
      [
        { brand: 'Compeed', name: 'Advanced Blister Care Cushions', price: '$10.00', query: 'Compeed Blister Cushions' },
        { brand: 'Band-Aid', name: 'Hydro Seal Blister Heels', price: '$6.00', query: 'Band-Aid Hydro Seal Blister' }
      ]
    );
    add('recommended', 'Physical & Transit', 'Compression socks', 'Supports circulation and reduces swelling during prolonged transit.', 'layers',
      "Prolonged sitting in transit causes blood to pool in your lower extremities, leading to edema (swelling) and increasing the risk of deep vein thrombosis (DVT).",
      [
        { brand: 'Sockwell', name: 'Circulator Compression Socks', price: '$30.00', query: 'Sockwell Compression Socks' },
        { brand: 'Bombas', name: 'Everyday Compression Socks', price: '$28.00', query: 'Bombas Compression Socks' }
      ]
    );
  }

  return items;
};