import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Platform, Alert, Dimensions, Animated, Easing, TextInput, Keyboard, LayoutAnimation, UIManager, Linking, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Path, Ellipse, Circle, G, Line, Rect } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../hooks/useColors';
import { useProfile } from '../../contexts/ProfileContext';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import OceanLoader from '../../components/OceanLoader';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
const { width, height } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}


type Mode = 'Menu' | 'Payment' | 'Transit';

const PROMPT_SUGGESTIONS: Record<Mode, string[]> = {
  Menu: [
    "What is the most traditional dish on this page?",
    "Which of these takes the longest to prepare?",
    "Are any of these dishes meant to be shared?",
    "What is a standard drink pairing for the top item?"
  ],
  Payment: [
    "Do they accept international Visa/Mastercard?",
    "Are there any hidden service charges or seating fees on this bill?",
    "Is it polite to split the bill (go Dutch) here?",
    "Do I pay at the table or at the register?"
  ],
  Transit: [
    "How do I get to Terminal...",
    "Where is Gate...",
    "Is it polite to talk on the phone on this train?",
    "Do I need to buy a ticket before boarding?"
  ]
};

interface ScanResult {
  title: string;
  userAnswer?: string;
  mapLocationName?: string;
  languageCode?: string;
  badges: { type: 'warn' | 'good' | 'info'; text: string }[];
  notes: { title: string; body: string }[];
}

const AnimatedG = Animated.createAnimatedComponent(G) as any;
const AnimatedCircle = Animated.createAnimatedComponent(Circle) as any;

function DolphinMascot({ size = 160, accent = '#5c7ce5', accentDark = '#4361c4', belly = '#eff6ff', ink = '#1e293b', spark = '#f5b962' }: {
  size?: number; accent?: string; accentDark?: string; belly?: string; ink?: string; spark?: string;
}) {
  const float = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const spk1 = useRef(new Animated.Value(0)).current;
  const spk2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatAnim = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    floatAnim.start();

    const blinkAnim = Animated.loop(Animated.sequence([
      Animated.delay(2200),
      Animated.timing(blink, { toValue: 0.05, duration: 90, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]));
    blinkAnim.start();

    const waveAnim = Animated.loop(Animated.sequence([
      Animated.timing(wave, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(wave, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    waveAnim.start();

    const spk1Anim = Animated.loop(Animated.sequence([
      Animated.timing(spk1, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(spk1, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    spk1Anim.start();

    const spk2Anim = Animated.loop(Animated.sequence([
      Animated.delay(500),
      Animated.timing(spk2, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(spk2, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    spk2Anim.start();

    return () => {
      floatAnim.stop();
      blinkAnim.stop();
      waveAnim.stop();
      spk1Anim.stop();
      spk2Anim.stop();
    };
  }, []);

  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  // FIX 1: Output raw numbers instead of strings for the SVG rotation prop
  const waveDeg = wave.interpolate({ inputRange: [0, 1], outputRange: [-15, 20] });

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ translateY: floatY }] }}>
      <Svg viewBox="0 0 200 200" width={size} height={size}>
        {/* shadow */}
        <Ellipse cx="100" cy="180" rx="58" ry="5" fill={accentDark} opacity={0.18} />

        {/* body */}
        <Path
          d="M35 125C35 70 65 35 100 35C135 35 165 70 165 125C165 150 152 165 135 165C120 165 112 153 100 153C88 153 80 165 65 165C48 165 35 150 35 125Z"
          fill={accent}
        />
        {/* belly */}
        <Path
          d="M44 132C44 105 60 92 100 92C140 92 156 105 156 132C156 156 142 165 135 165C120 165 112 153 100 153C88 153 80 165 65 165C58 165 44 156 44 132Z"
          fill={belly}
        />
        {/* highlight */}
        <Ellipse cx="68" cy="62" rx="14" ry="6" fill="rgba(255,255,255,0.5)" transform="rotate(-30 68 62)" />

        {/* brows */}
        <Path d="M 68 68 Q 76 64 84 68" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
        <Path d="M 116 68 Q 124 64 132 68" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* FIX 2: Use scaleY as a direct prop so it respects originX/originY */}
        <AnimatedG scaleY={blink} originX={76} originY={82}>
          <Ellipse cx="76" cy="82" rx="8.5" ry="8.5" fill="#fff" />
          <Ellipse cx="76" cy="82" rx="5" ry="5" fill={ink} />
          <Ellipse cx="74.5" cy="80.5" rx="1.8" ry="1.8" fill="#fff" />
        </AnimatedG>
        <AnimatedG scaleY={blink} originX={124} originY={82}>
          <Ellipse cx="124" cy="82" rx="8.5" ry="8.5" fill="#fff" />
          <Ellipse cx="124" cy="82" rx="5" ry="5" fill={ink} />
          <Ellipse cx="122.5" cy="80.5" rx="1.8" ry="1.8" fill="#fff" />
        </AnimatedG>

        {/* warm smile + blush */}
        <Path d="M91 122 Q 100 134 109 122" stroke={ink} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <Ellipse cx="62" cy="115" rx="7" ry="3.5" fill="#f9a8a8" opacity={0.55} />
        <Ellipse cx="138" cy="115" rx="7" ry="3.5" fill="#f9a8a8" opacity={0.55} />

        {/* FIX 3: Use rotation as a direct prop so it respects originX/originY */}
        <AnimatedG rotation={waveDeg} originX={150} originY={95}>
          <Path d="M 150 95 Q 178 70 172 45 Q 160 58 150 78 Q 142 90 150 95 Z" fill={accentDark} />
        </AnimatedG>

        {/* sparkles */}
        <AnimatedCircle cx="42" cy="58" r="3" fill={spark} opacity={spk1} />
        <AnimatedCircle cx="34" cy="82" r="2" fill={spark} opacity={spk2} />
        <AnimatedCircle cx="178" cy="38" r="2.5" fill={spark} opacity={spk2} />
      </Svg>
    </Animated.View>
  );
}


export default function ScanScreen() {

  const [permission, requestPermission] = useCameraPermissions();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, save, setDraft } = useProfile();

  // Define a platform-specific offset for the bottom controls
  const bottomUIOffset = Platform.select({
    ios: insets.bottom + 70, // Accounts for the dynamic iOS home indicator
    android: 20,              // Fixed value to sit perfectly above Android's 60px tab bar
    default: 20,
  }) ?? 20;

  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const [mode, setMode] = useState<Mode>('Menu');
  const [showModeInfo, setShowModeInfo] = useState(false);

  const MODE_DESCRIPTIONS: Record<Mode, string> = {
    Menu: "Scan restaurant or cafe menus to decode dishes, identify allergens, and get ordering tips.",
    Payment: "Scan payment terminals, signage, or receipts to understand tipping culture and hidden fees.",
    Transit: "Scan train schedules, station signs, or turnstiles for navigation and boarding etiquette."
  };

  // Auto-close the tooltip if they change the mode using the bottom bar
  useEffect(() => {
    setShowModeInfo(false);
  }, [mode]);

  const [analyzing, setAnalyzing] = useState(false);
  const [aiFinished, setAiFinished] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [captionIndex, setCaptionIndex] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isCaptured, setIsCaptured] = useState(false);
  const [pendingUploadPhoto, setPendingUploadPhoto] = useState<{uri: string, base64: string} | null>(null);

  const [showResultSheet, setShowResultSheet] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // NEW: One-Time Welcome Guide State
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);

  useEffect(() => {
    const checkWelcomeGuide = async () => {
      try {
        const hasSeen = await AsyncStorage.getItem('@thinktrip_scan_guide_seen');
        if (!hasSeen) {
          setShowWelcomeGuide(true);
        }
      } catch (e) {
        console.error("Error reading scan guide status:", e);
      }
    };
    checkWelcomeGuide();
  }, []);

  const dismissWelcomeGuide = async () => {
    setShowWelcomeGuide(false);
    try {
      await AsyncStorage.setItem('@thinktrip_scan_guide_seen', 'true');
    } catch (e) {
      console.error("Error saving scan guide status:", e);
    }
  };
  const slideAnim = useRef(new Animated.Value(800)).current; // Starts 800px off-screen

  const openSheet = () => {
    setShowResultSheet(true);
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
      setShowResultSheet(false);
      setResult(null);
      setIsCaptured(false);
      setPendingUploadPhoto(null);

      if (cameraRef.current) {
        cameraRef.current.resumePreview();
      }
    });
  };

  const handleFinishComplete = () => {
    openSheet();
    setAnalyzing(false);
    setAiFinished(false);

    if (Platform.OS !== 'web' && profile.hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const openMap = async (query: string) => {
    const encodedQuery = encodeURIComponent(query);

    // 1. Primary Native Schemes (Forces the OS to look for the actual app)
    let iosUrl = `maps://?q=${encodedQuery}`;
    if (userLocation) {
      iosUrl += `&sll=${userLocation.coords.latitude},${userLocation.coords.longitude}`;
    }

    let androidUrl = `geo:0,0?q=${encodedQuery}`;
    if (userLocation) {
      androidUrl = `geo:${userLocation.coords.latitude},${userLocation.coords.longitude}?q=${encodedQuery}`;
    }

    // 2. Universal Web Fallbacks (If the native app is deleted/unavailable)
    const fallbackIosUrl = `https://maps.apple.com/?q=${encodedQuery}`;
    // Note: I fixed a missing '$' typo in your original Android fallback here!
    const fallbackAndroidUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;

    const nativeUrl = Platform.select({ ios: iosUrl, android: androidUrl }) || fallbackIosUrl;
    const webUrl = Platform.select({ ios: fallbackIosUrl, android: fallbackAndroidUrl }) || fallbackIosUrl;

    try {
      // 3. Try the native app first
      const supported = await Linking.canOpenURL(nativeUrl);

      if (supported) {
        await Linking.openURL(nativeUrl);
      } else {
        // 4. Fall back to the browser if they don't have the app installed
        const webSupported = await Linking.canOpenURL(webUrl);
        if (webSupported) {
          await Linking.openURL(webUrl);
        } else {
          Alert.alert("Map Unavailable", "Could not open the map application or browser.");
        }
      }
    } catch (error) {
      console.error("Linking error:", error);
      Alert.alert("Map Unavailable", "An error occurred while trying to open the map.");
    }
  };

  const CAPTIONS = [
    'Mapping the scene...',
    'Reading cultural context...',
    'Cross-referencing baseline...',
    'Analyzing...',
  ];

  useEffect(() => {
    if (!analyzing) return;
    setCaptionIndex(0);

    // Pulse animation — gently breathes in and out
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();

    // Cycle captions every 5s, then stop at a fallback message
    const captionTimer = setInterval(() => {
      setCaptionIndex(i => i < CAPTIONS.length ? i + 1 : i);
    }, 5000);

    return () => {
      pulse.stop();
      pulseAnim.setValue(1);
      clearInterval(captionTimer);
    };
  }, [analyzing]);

  const analyzeImage = async (base64Image: string, currentMode: Mode, location?: Location.LocationObject | null): Promise<ScanResult> => {
    // ── MOCK MODE (comment this block out and uncomment the block below to go live) ──
    // await new Promise(res => setTimeout(res, 15000)); // simulate network delay
    // if (currentMode === 'Menu') {
    //   const badges: ScanResult['badges'] = [];
    //   if (profile.sodiumSensitive) badges.push({ type: 'warn', text: 'High sodium • ~1,840 mg' });
    //   if (profile.dairyFree) badges.push({ type: 'warn', text: 'Contains dairy' });
    //   if (profile.shellfishAllergy) badges.push({ type: 'warn', text: 'Shellfish risk in broth' });
    //   if (badges.length === 0) badges.push({ type: 'good', text: 'Safe with your profile' });
    //   return {
    //     title: '味噌ラーメン (Miso Ramen)',
    //     badges,
    //     notes: [
    //       { title: 'Why this matters for you', body: profile.sodiumSensitive ? 'Miso broths typically push past your daily sodium budget in a single bowl. Ask for a lighter broth (あっさり) and skip the extra seasoning.' : 'A balanced choice — pair with green tea to aid digestion and slow salt absorption.' },
    //       { title: 'Order tip', body: "Ask for 'あっさり' (assari) for a lighter broth, or 'こってり' (kotteri) for extra richness." },
    //       { title: 'Nutrition note', body: 'Typical serving: ~650 kcal, 2,400mg sodium, 25g protein. Noodles are wheat-based — not suitable for gluten-free diets.' },
    //     ],
    //   };
    // } else if (currentMode === 'Payment') {
    //   return {
    //     title: 'Izakaya — Cash preferred',
    //     badges: [
    //       { type: 'warn', text: 'Cash only after 9pm' },
    //       { type: 'info', text: 'No tipping culture' },
    //       { type: 'good', text: 'Otoshi charge ~¥400' },
    //     ],
    //     notes: [
    //       { title: 'Etiquette', body: 'Tipping is unusual and can be returned. Hand cash on the small tray provided, never directly into the staff\'s hand.' },
    //       { title: 'Otoshi (お通し)', body: 'A small appetizer dish appears unprompted — this is a standard ¥300–500 seating charge, not a complimentary gift.' },
    //       { title: 'Splitting the bill', body: 'Asking to split (割り勘, warikan) is common between friends. Let the staff know before ordering if you plan to split.' },
    //     ],
    //   };
    // } else {
    //   return {
    //     title: 'Yamanote Line — Inbound to Shibuya',
    //     badges: [
    //       { type: 'info', text: 'IC card accepted' },
    //       { type: 'good', text: 'Step-free transfer available' },
    //       { type: 'info', text: 'Next train: 3 min' },
    //     ],
    //     notes: [
    //       { title: 'Boarding', body: 'Queue inside the painted lines on the platform. Let all exiting riders off before boarding. Priority seats are near the doors — give them up if needed.' },
    //       { title: 'Transfer', body: 'Switch at Shibuya for the Hanzomon line — follow purple signs, approximately 6 minute walk via the underground concourse.' },
    //       { title: 'IC Card tip', body: 'Tap your Suica or Pasmo card at both entry and exit gates. Insufficient balance will block the exit gate — top up at any green kiosk on the platform.' },
    //     ],
    //   };
    // }
    // ── END MOCK MODE ──

    // uncomment this if use ai model.
    const healthBaseline = {
      skin: {
        type: profile.skinType,
        retinoids: profile.usesRetinoids,
        benzoylPeroxide: profile.usesBenzoylPeroxide,
        chemicalExfoliants: profile.usesChemicalExfoliants,
        fragranceFree: profile.fragranceFree,
      },
      dietary: {
        sodiumSensitive: profile.sodiumSensitive,
        caffeineLimit: profile.caffeineLimit,
        glutenFree: profile.glutenFree,
        dairyFree: profile.dairyFree,
      },
      allergies: {
        shellfish: profile.shellfishAllergy,
        peanut: profile.peanutAllergy,
      },
      body: {
        activityLevel: profile.activityLevel,
      }
    };

    // ── LIVE GEMINI MODE (uncomment to enable, comment out mock block above) ──
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing Gemini API Key");
    const genAI = new GoogleGenerativeAI(apiKey);
    const generationConfig = {
      responseMimeType: "application/json",
    };
    let model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview", generationConfig });

    const prompt = `
      You are the intelligence engine for "ThinkTrip", a premium, clinical, biometrically-aware travel OS. 
      Your primary directive is to decode cultural nuances, eliminate language barriers, and protect the user's biometric baseline, granting them absolute confidence in unfamiliar environments.

      Analyze the provided image and generate a response formatted strictly as valid JSON.

      **CURRENT CONTEXT:**
      - Active Mode: ${currentMode}
      - User's Health Baseline: ${JSON.stringify(healthBaseline)}
      - GPS Status: ${location
        ? `ACTIVE (Lat: ${location.coords.latitude}, Lng: ${location.coords.longitude}). CRITICAL: Bias all transit POIs to this exact physical location.`
        : `DISABLED. The user has opted out of location tracking. Do not attempt to guess the city or generate map routing.`}

      **USER INQUIRY (OPTIONAL):**
      ${searchQuery.trim() !== ''
        ? `The user asked a specific question: "${searchQuery}". You MUST provide a direct answer to this question in the 'userAnswer' field of the JSON. Break your answer into short paragraphs or use bullet points ("- ") for maximum readability. Do NOT ask the user for additional information or further guidance in the response.`
        : `No specific question was asked. Omit the 'userAnswer' field entirely.`}

      **CRITICAL RULES:**
      1. **IMAGE FIRST:** Extract text, context, and environment details exclusively from the image. If the image is completely illegible or entirely unrelated to the Active Mode, do not hallucinate. Set the 'title' to 'Unable to Analyze', omit the 'userAnswer' and 'mapLocationName', and provide a single 'warn' badge indicating the image is unclear.
      2. **TONE & FORMATTING:** Calm, premium, clinical, objective. STRICTLY NO EMOJIS, NO UNICODE ICONS. Output pure text only. DO NOT USE PARAGRAPHS in the 'notes' section. The 'body' of EVERY note MUST be a strict bulleted list ("- "). 
      3. **BE RUTHLESSLY CONCISE:** Keep every bullet point to a maximum of 15 words. Prioritize quick scannability over complete sentences. (Note: The native phrase and phonetic spelling do not count towards this limit).
      4. **BIOMETRIC AWARENESS:** Cross-reference image contents with the User's Baseline. Always flag items that violate their dietary or health restrictions.
      5. **CULTURAL CONFIDENCE & NATIVE SCRIPT:** You MUST use the actual native characters/script for the language strictly inside the single quotes (e.g., use '请问', NOT 'Qǐng wèn'; use 'こんにちは', NOT 'Konnichiwa'). NEVER use Romanization (like Pinyin or Romaji) inside the single quotes, as native text-to-speech engines cannot read it. Place the official Romanization and the English-approximated phonetic pronunciation OUTSIDE the quotes in parentheses (e.g., '请问' (Qǐng wèn - ching wen)). DO NOT provide literal, word-by-word English translations of dish names. 
      6. **NO DUPLICATION:** The 'userAnswer' field must strictly and exclusively address the user's specific question. 
      7. **GEOGRAPHIC SPECIFICITY:** The 'mapLocationName' field is STRICTLY RESERVED for 'Transit' mode. If the Active Mode is 'Menu' or 'Payment', you MUST omit the 'mapLocationName' field entirely, and use the GPS coordinates solely to inform your localized cultural notes and etiquette. If the Active Mode is 'Transit', your 'mapLocationName' MUST be the official, external name of the building, station, or terminal. CRITICAL: DO NOT include indoor qualifiers like "Gate B12" or "Platform 4". Place all indoor navigation details strictly in the 'notes' section.

      **MODE ADAPTATION:**
      If Mode is 'Menu':
        - Assume the image is a full menu with multiple items. 
        - Title: Summarize the menu type or restaurant name (e.g., "Izakaya Dinner Menu").
        - Analyze the menu collectively against the User's Baseline.
        - Badges: Flag high-level context (e.g., "warn" for "Heavy Dairy Use", "info" for "English Spoken", "good" for "Diet-Friendly Options").
        - Notes: Provide exactly three notes:
           1. "Recommended Options": Provide 2-3 specific safe dishes matching the Baseline. Include the original name and a simple phonetic pronunciation so the user can order confidently. Use bullet points ("- ").
           2. "Strict Avoids": Provide all Hidden ingredients or specific dishes that violate their Baseline. Use bullet points ("- "). If there are no items that violate the baseline, explicitly state 'No immediate conflicts detected based on your health profile'.
           3. "Ordering & Interactions": Provide EXACTLY 5 of the most popular requests, ordering tips, or practical phrases for this setting. For each phrase, provide the properly accented native spelling strictly inside single quotes, followed by an English-approximated phonetic spelling in parentheses (e.g., "- To request no cilantro, say 'Không ngò' (kohng ngo)").

      If Mode is 'Payment':
        - FIRST, classify the primary subject of the image into one of two sub-categories: 'Signage/Terminal' OR 'Receipt/Bill'.
        - If Sub-Category is 'Signage/Terminal':
           - Detect accepted payment methods from signage or context.
           - Badges: Flag "warn" for cash-only, "info" for IC cards, "good" for no-tipping.
           - Notes (Provide exactly three):
              1. "Behavioral Norms": Physical etiquette (e.g., "Place cash in the provided tray...").
              2. "Cashier Interactions": What the staff is likely to ask and how to reply. Provide 5 short, practical phrases with properly accented native spellings in single quotes and English phonetics (e.g., "- If they ask if you need a bag, decline by saying 'Irimasen' (ee-ree-mah-sen)").
              3. "Receipts & Hidden Charges": Explain unwritten costs like seating charges ('otoshi').
        - If Sub-Category is 'Receipt/Bill':
           - Analyze the line items, taxes, totals, and currency.
           - Badges: Flag "warn" for high mandatory service charges, "info" for included gratuity, "good" for transparent pricing.
           - Notes (Provide exactly three):
              1. "Bill Breakdown": Summarize the total, taxes, and hidden fees.
              2. "Tipping Culture": Specific advice on whether to add a tip for this region.
              3. "Settlement Protocol": Practical advice on paying. Include 5 phrases with native spellings in single quotes for asking to split the bill or pay by card.

      If Mode is 'Transit':
        - Identify the line, direction, signage, and next steps.
        - Badges: "info" for IC card support, "warn" for peak rush hour, "good" for step-free access.
        - Notes: Provide exactly three notes:
           1. "Signage & Navigation": How to physically get to the right spot.
           2. "Behavioral Norms": Unspoken local rules.
           3. "Ticketing & Assistance": Rules for validation. Include 5 practical phrases with native spellings in single quotes to confirm direction or ask for help.

      **REQUIRED JSON STRUCTURE:**
      {
        "title": "Short Title (In English)",
        "languageCode": "The exact BCP-47 language tag for the primary foreign language detected in the image (e.g., 'vi-VN', 'ja-JP', 'fr-FR', 'es-ES'). Omit this field if the image is purely English.",
        "userAnswer": "Formatted direct answer using \\n for paragraph breaks and '- ' for bullet points. Do NOT duplicate 'notes' content here (omit if no inquiry was made)",
        "mapLocationName": "The EXACT name of the primary building/station followed by city and country. CRITICAL: Omit this field entirely if the Active Mode is NOT 'Transit', if GPS Status is DISABLED, or if the image is an ambiguous street.",          
        "badges": [
          { "type": "good" | "warn" | "info", "text": "Short badge text" }
        ],
        "notes": [
          { "title": "Category (e.g., Behavioral Norms)", "body": "Clinical, concise explanation with phonetic phrasing if needed. CRITICAL: Use \\n for paragraph breaks and '- ' for bullet points." }
        ]
      }
    `;

    console.log("Prompt: ", prompt);

    let contentResult: any;
    try {
      contentResult = await model.generateContent([prompt, { inlineData: { data: base64Image, mimeType: "image/jpeg" } }]);
    } catch (e) {
      console.warn("Fallback to gemini-2.5-flash-lite:", e);

      try {
        model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite", generationConfig });
        contentResult = await model.generateContent([prompt, { inlineData: { data: base64Image, mimeType: "image/jpeg" } }]);
      } catch (e) {
        console.warn("Both models failed :( ", e);
        throw new Error("AI analysis failed after multiple attempts.");
      }
    }
    const responseText = contentResult.response.text().trim();
    return JSON.parse(responseText) as ScanResult;
    // ── END LIVE GEMINI MODE ──

    // -- Openrouter API Mode --
    // const orKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
    // if (!orKey) throw new Error("Missing OpenRouter API Key");

    // const prompt = `
    //   You are the intelligence engine for "ThinkTrip", a premium, clinical, biometrically-aware travel OS. 
    //   Your primary directive is to decode cultural nuances, eliminate language barriers, and protect the user's biometric baseline, granting them absolute confidence in unfamiliar environments.

    //   Analyze the provided image and generate a response formatted strictly as valid JSON.

    //   **CURRENT CONTEXT:**
    //   - Active Mode: ${currentMode}
    //   - User's Health Baseline: ${JSON.stringify(healthBaseline)}

    //   **USER INQUIRY (OPTIONAL):**
    //   ${searchQuery.trim() !== ''
    //     ? `The user asked a specific question: "${searchQuery}". You MUST provide a direct answer to this question in the 'userAnswer' field of the JSON. Break your answer into short paragraphs or use bullet points ("- ") for maximum readability.`
    //     : `No specific question was asked. Omit the 'userAnswer' field entirely.`}

    //   **CRITICAL RULES:**
    //   1. **IMAGE FIRST:** Extract text, context, and environment details exclusively from the image.
    //   2. **TONE:** Calm, premium, clinical, objective. No emojis, no playful language, no exclamation points.
    //   3. **BIOMETRIC AWARENESS:** Cross-reference image contents with the User's Baseline. Always flag items that violate their dietary or health restrictions.
    //   4. **CULTURAL CONFIDENCE:** Provide intuitive, English-approximated phonetic pronunciations (in parentheses) for local terms. Use simple syllables (e.g., "Konnichiwa (kohn-nee-chee-wah)"). Keep spoken phrases extremely short, practical, and conversational. Do not invent complex phonetic symbols or mix English words into the pronunciation guides.

    //   **MODE ADAPTATION:**
    //   If Mode is 'Menu':
    //     - Assume the image is a full menu with multiple items. 
    //     - Title: Summarize the menu type or restaurant name (e.g., "Izakaya Dinner Menu").
    //     - Analyze the menu collectively against the User's Baseline.
    //     - Badges: Flag high-level context (e.g., "warn" for "Heavy Dairy Use", "info" for "English Spoken", "good" for "Diet-Friendly Options").
    //     - Notes: Provide exactly three notes:
    //        1. "Recommended Options": 2-3 specific safe dishes matching the Baseline. Include the original name and a simple phonetic pronunciation so the user can order confidently.
    //        2. "Strict Avoids": Hidden ingredients or specific dishes that violate their Baseline.
    //        3. "Ordering & Interactions": Practical advice on how to order. If suggesting a phrase, provide ONE short, culturally accurate phrase (like requesting a modification) with a clear English-approximated phonetic spelling (e.g., "To request no cilantro, say 'Không ngò' (kohng ngo)"). Focus on behavior over complex language.

    //   If Mode is 'Payment':
    //     - Detect accepted payment methods from signage or context.
    //     - Badges: Flag "warn" for cash-only, "info" for IC cards, "good" for no-tipping.
    //     - Notes: Provide exactly three notes:
    //        1. "Behavioral Norms": Physical etiquette (e.g., "Place cash in the provided tray, never hand it directly to the cashier. Tipping is considered rude and will be returned.").
    //        2. "Cashier Interactions": What the staff is likely to ask and how to reply. Provide ONE short, practical phrase with an English-approximated phonetic spelling (e.g., "They will ask if you need a bag. Say 'Irimasen' (ee-ree-mah-sen) to decline.").
    //        3. "Receipts & Hidden Charges": Explain unwritten costs like seating charges ('otoshi'), mandatory water fees, or how to ask for a receipt. If no hidden charges exist, state that clearly so the user has peace of mind.

    //   If Mode is 'Transit':
    //     - Identify the line, direction, signage, and next steps.
    //     - Badges: "info" for IC card support, "warn" for peak rush hour, "good" for step-free access.
    //     - Notes: Provide exactly three notes:
    //        1. "Signage & Navigation": How to physically get to the right spot (e.g., "Follow the yellow painted lines on the floor for the Express train").
    //        2. "Behavioral Norms": Unspoken local rules (e.g., "Silence your phone. Do not eat or drink on this line. Stand strictly on the right side of the escalator.").
    //        3. "Ticketing & Assistance": Rules for validation (e.g., "Tap your IC card at both gates"). Include ONE short, practical phrase with an English-approximated phonetic spelling to confirm direction or ask for help (e.g., "To confirm this train goes to Shibuya, ask 'Shibuya yuki desu ka?' (shee-boo-yah yoo-kee dess kah)").

    //   **REQUIRED JSON STRUCTURE:**
    //   {
    //     "title": "Short Title (In English)",
    //     "userAnswer": "Formatted direct answer using \\n for paragraph breaks and '- ' for bullet points (omit if no inquiry was made)",
    //     "badges": [
    //       { "type": "good" | "warn" | "info", "text": "Short badge text" }
    //     ],
    //     "notes": [
    //       { "title": "Category (e.g., Behavioral Norms)", "body": "Clinical, concise explanation with phonetic phrasing if needed. Use \\n for paragraph breaks and '- ' for bullet points." }
    //     ]
    //   }
    // `;

    // const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    //   method: "POST",
    //   headers: {
    //     "Authorization": `Bearer ${orKey}`,
    //     "Content-Type": "application/json",
    //     "HTTP-Referer": "https://thinktrip.app",
    //     "X-Title": "ThinkTrip Travel OS",
    //   },
    //   body: JSON.stringify({
    //     // "model": "google/gemma-4-31b-it:free",
    //     "model": "nvidia/nemotron-nano-12b-v2-vl:free",
    //     "messages": [
    //       {
    //         "role": "user",
    //         "content": [
    //           { "type": "text", "text": prompt },
    //           {
    //             "type": "image_url",
    //             "image_url": {
    //               "url": `data:image/jpeg;base64,${base64Image}`
    //             }
    //           }
    //         ]
    //       }
    //     ],
    //     "response_format": { "type": "json_object" }
    //   })
    // });

    // const data = await response.json();
    // if (!response.ok) throw new Error(data.error?.message || "OpenRouter Error");

    // const responseText = data.choices[0].message.content.trim();
    // const jsonStr = responseText.replace(/^```json/i, '').replace(/```$/i, '').trim();
    // return JSON.parse(jsonStr) as ScanResult;
    // -- End of Openrouter API Mode-- 
  };

  // this captures the entire screen
  // const handleShutter = async () => {
  //   if (analyzing || !cameraRef.current) return;
  //   if (Platform.OS !== 'web' && profile.hapticsEnabled) {
  //     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  //   }
  //   setAnalyzing(true);
  //   setResult(null);

  //   try {
  //     const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
  //     if (photo && photo.base64) {
  //       const analysis = await analyzeImage(photo.base64, mode);
  //       setResult(analysis);
  //       if (Platform.OS !== 'web' && profile.hapticsEnabled) {
  //         Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  //       }
  //     }
  //   } catch (error) {
  //     console.error("Analysis Error:", error);
  //     Alert.alert("Analysis Failed", "Could not analyze the image. Please try again.");
  //   } finally {
  //     setAnalyzing(false);
  //   }
  // };

  const toggleGps = async () => {
    const newValue = !profile.locationRoutingEnabled;

    if (newValue) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          "Permission Denied",
          "Please enable location in your device settings to use precise transit routing.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() }
          ]
        );
        return; // Abort if OS denies it
      }
    }

    // Save the preference to Firestore/Context
    setDraft({ locationRoutingEnabled: newValue });
    save({ locationRoutingEnabled: newValue });
  };

  // old code
  // const handleShutter = async () => {
  //   Keyboard.dismiss();
  //   // Block if already analyzing or captured
  //   if (analyzing || isCaptured || !cameraRef.current) return;

  //   if (Platform.OS !== 'web' && profile.hapticsEnabled) {
  //     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  //   }

  //   // Freeze camera, trigger loading screen, AND trigger the blur overlay
  //   cameraRef.current.pausePreview();
  //   setIsCaptured(true);
  //   setAnalyzing(true);

  //   // --- NEW: Grab Location ---
  //   let currentLocation: Location.LocationObject | null = null;
  //   if (profile.locationRoutingEnabled) {
  //     try {
  //       const { status } = await Location.getForegroundPermissionsAsync();
  //       if (status === 'granted') {
  //         currentLocation = await Location.getLastKnownPositionAsync({})
  //           || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  //         setUserLocation(currentLocation);
  //       }
  //     } catch (e) {
  //       console.warn("Could not fetch location for scan:", e);
  //     }
  //   }
  //   // --------------------------

  //   try {
  //     // 3. takePictureAsync runs in the background. It naturally creates a 
  //     // micro-freeze on the camera feed, enhancing the "captured" effect.
  //     const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });

  //     if (photo) {
  //       // Calculate the exact percentage of the screen the Tab Bar covers
  //       const tabBarHeightPixels = insets.bottom + 84;
  //       const tabBarPercent = tabBarHeightPixels / Dimensions.get('window').height;

  //       // Capture full width, starting from the very top (0,0)
  //       const cropX = 0;
  //       const cropY = 0;
  //       const cropWidth = photo.width;
  //       // The height is the full photo height MINUS the tab bar portion
  //       const cropHeight = photo.height * (1 - tabBarPercent);

  //       const croppedImage = await ImageManipulator.manipulateAsync(
  //         photo.uri,
  //         [{ crop: { originX: cropX, originY: cropY, width: cropWidth, height: cropHeight } }],
  //         { base64: true, compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  //       );

  //       if (croppedImage.base64) {
  //         const analysis = await analyzeImage(croppedImage.base64, mode, currentLocation);

  //         // Educational fallback if they scanned without GPS
  //         if (!currentLocation) {
  //           analysis.badges.unshift({
  //             type: 'warn',
  //             text: 'Routing disabled • No GPS'
  //           });
  //           delete analysis.mapLocationName;
  //         }

  //         setResult(analysis);
  //         openSheet();

  //         if (Platform.OS !== 'web' && profile.hapticsEnabled) {
  //           Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  //         }
  //         setSearchQuery('');
  //       }
  //     }
  //   } catch (error) {
  //     console.error("Analysis Error:", error);
  //     Alert.alert("Analysis Failed", "Could not analyze the image. Please try again.");

  //     // Reset if it fails so the user can try again
  //     setIsCaptured(false);
  //     if (cameraRef.current) cameraRef.current.resumePreview();

  //   } finally {
  //     setAnalyzing(false);
  //   }
  // };

  // new working code
  // const handleShutter = async () => {
  //   Keyboard.dismiss();
  //   if (analyzing || isCaptured || !cameraRef.current) return;

  //   if (Platform.OS !== 'web' && profile.hapticsEnabled) {
  //     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  //   }

  //   // 1. Immediately trigger the blur overlay so the UI feels instantly responsive
  //   setIsCaptured(true);
  //   setAnalyzing(true);

  //   // --- Grab Location ---
  //   let currentLocation: Location.LocationObject | null = null;
  //   if (profile.locationRoutingEnabled) {
  //     try {
  //       const { status } = await Location.getForegroundPermissionsAsync();
  //       if (status === 'granted') {
  //         currentLocation = await Location.getLastKnownPositionAsync({})
  //           || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  //         setUserLocation(currentLocation);
  //       }
  //     } catch (e) {
  //       console.warn("Could not fetch location for scan:", e);
  //     }
  //   }

  //   try {
  //     // 2. CRITICAL ANDROID FIX: Take the picture BEFORE pausing the preview
  //     const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });

  //     // 3. Now that the frame is safely captured into memory, pause the feed
  //     // cameraRef.current.pausePreview();

  //     if (photo) {
  //       const tabBarHeightPixels = insets.bottom + 84;
  //       const tabBarPercent = tabBarHeightPixels / Dimensions.get('window').height;

  //       // 4. CRITICAL ANDROID FIX: ImageManipulator requires strict integers
  //       const cropX = 0;
  //       const cropY = 0;
  //       const cropWidth = Math.round(photo.width);
  //       const cropHeight = Math.round(photo.height * (1 - tabBarPercent));

  //       const croppedImage = await ImageManipulator.manipulateAsync(
  //         photo.uri,
  //         [{ crop: { originX: cropX, originY: cropY, width: cropWidth, height: cropHeight } }],
  //         { base64: true, compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  //       );

  //       if (croppedImage.base64) {
  //         const analysis = await analyzeImage(croppedImage.base64, mode, currentLocation);

  //         if (!currentLocation) {
  //           analysis.badges.unshift({
  //             type: 'warn',
  //             text: 'Routing disabled • No GPS'
  //           });
  //           delete analysis.mapLocationName;
  //         }

  //         setResult(analysis);
  //         openSheet();

  //         if (Platform.OS !== 'web' && profile.hapticsEnabled) {
  //           Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  //         }
  //         setSearchQuery('');
  //       }
  //     }
  //   } catch (error) {
  //     console.error("Analysis Error:", error);
  //     Alert.alert("Analysis Failed", "Could not analyze the image. Please try again.");

  //     // Reset if it fails so the user can try again
  //     setIsCaptured(false);
  //     if (cameraRef.current) cameraRef.current.resumePreview();

  //   } finally {
  //     setAnalyzing(false);
  //   }
  // };

  const handleShutter = async () => {
    Keyboard.dismiss();
    if (analyzing || isCaptured) return;
    if (!pendingUploadPhoto && !cameraRef.current) return;

    if (Platform.OS !== 'web' && profile.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // 1. Instant UI Reaction
    setIsCaptured(true);
    setAnalyzing(true);

    // 2. Give the UI 50ms to actually paint the blur overlay 
    // before the camera hogs the CPU hardware.
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      // 5. CONCURRENCY: Start GPS and Image Processing at the same time
      const locationPromise = (async () => {
        if (!profile.locationRoutingEnabled) return null;
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status !== 'granted') return null;

          // Race the GPS fetch against a 2-second timeout so the user isn't stuck
          return await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))
          ]);
        } catch (e) {
          return null;
        }
      })();

      let imagePromise;
      if (pendingUploadPhoto) {
        imagePromise = Promise.resolve({ base64: pendingUploadPhoto.base64 });
      } else {
        const photo = await cameraRef.current!.takePictureAsync({ quality: 0.5 });
        if (!photo) throw new Error("Photo capture failed");

        imagePromise = (async () => {
          const tabBarHeightPixels = insets.bottom + 84;
          const tabBarPercent = tabBarHeightPixels / Dimensions.get('window').height;

          // Ensure strict integers for Android stability
          const cropX = 0;
          const cropY = 0;
          const cropWidth = Math.round(photo.width);
          const cropHeight = Math.round(photo.height * (1 - tabBarPercent));

          return await ImageManipulator.manipulateAsync(
            photo.uri,
            [{ crop: { originX: cropX, originY: cropY, width: cropWidth, height: cropHeight } }],
            { base64: true, compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );
        })();
      }

      // Wait for both to finish simultaneously
      const [currentLocation, croppedImage] = await Promise.all([locationPromise, imagePromise]);
      if (currentLocation) setUserLocation(currentLocation);

      // 6. AI Analysis
      if (croppedImage.base64) {
        const analysis = await analyzeImage(croppedImage.base64, mode, currentLocation);

        if (analysis.title === 'Unable to Analyze') {
          Alert.alert(
            "Couldn't read image",
            `Make sure the image is clear and relevant to ${mode} mode.`,
            [{ text: "Try again" }]
          );

          setIsCaptured(false);
          if (!pendingUploadPhoto && cameraRef.current) cameraRef.current.resumePreview();
          setSearchQuery('');
          setAnalyzing(false);
          return;
        }

        if (!currentLocation && profile.locationRoutingEnabled) {
          analysis.badges.unshift({
            type: 'warn',
            text: 'Routing disabled • Weak GPS'
          });
          delete analysis.mapLocationName;
        }

        setResult(analysis);
        setAiFinished(true); // Signal to OceanLoader that the analysis has completed
        setSearchQuery('');
      }
    } catch (error) {
      console.error("Analysis Error:", error);
      Alert.alert("Analysis Failed", "Could not analyze the image. Please try again.");

      setIsCaptured(false);
      if (!pendingUploadPhoto && cameraRef.current) cameraRef.current.resumePreview();
      setAnalyzing(false);
    }
  };

  const handleImagePick = async () => {
    Keyboard.dismiss();
    if (analyzing || isCaptured) return;

    if (pendingUploadPhoto) {
      setPendingUploadPhoto(null);
      return;
    }

    if (Platform.OS !== 'web' && profile.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to grant camera roll permissions to upload an image.");
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.5,
    });

    if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
      return;
    }

    const photo = pickerResult.assets[0];
    if (!photo.base64) {
        Alert.alert("Error", "Could not read image data.");
        return;
    }

    setPendingUploadPhoto({ uri: photo.uri, base64: photo.base64 });
  };

  // Helper to extract and speak the foreign phrase
  const speakPhrase = async (text: string, langCode?: string) => {
    // Stop any ongoing speech to prevent overlapping audio
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      Speech.stop();
    }

    // Extract the literal foreign text inside the single quotes
    const match = text.match(/'([^']+)'/);
    const phraseToSpeak = match ? match[1] : text;

    console.log("🗣️ Speaking:", phraseToSpeak, "| Language:", langCode || "System Default");

    // Configure speech options
    const speechOptions: Speech.SpeechOptions = {
      rate: 0.85,
      pitch: 1.0
    };

    // If Gemini detected a foreign language, force the native TTS engine
    if (langCode) {
      speechOptions.language = langCode;
    }

    Speech.speak(phraseToSpeak, speechOptions);
  };

  // Helper to parse a single line and inject inline audio buttons
  const renderInlineText = (line: string, textColor: string, langCode?: string) => {
    // Split the string by content inside single quotes, keeping the quoted text in the array
    const parts = line.split(/('[^']+')/g);

    return parts.map((part, index) => {
      // If this part is our quoted foreign phrase
      if (part.startsWith("'") && part.endsWith("'")) {
        const phrase = part.slice(1, -1); // Remove the quotes for the actual spoken text

        return (
          <Text
            key={index}
            style={{ color: colors.primary, fontFamily: 'Inter_700Bold' }}
            onPress={() => speakPhrase(phrase, langCode)}
            suppressHighlighting={true} // Removes the ugly grey tap highlight on iOS
          >
            {part} <Feather name="volume-2" size={14} color={colors.primary} />
          </Text>
        );
      }
      // Otherwise, return standard text
      return <Text key={index} style={{ color: textColor }}>{part}</Text>;
    });
  };

  // Helper to elegantly parse and render AI text with hierarchy
  const renderFormattedText = (text: string, textColor: string, langCode?: string) => {
    return text.split('\n').map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return <View key={`space-${index}`} style={{ height: 6 }} />;

      // Handle bullet points ("- item" or "* item")
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <View key={`bullet-${index}`} style={styles.bulletRow}>
            <Text style={[styles.bulletDot, { color: textColor }]}>•</Text>
            <Text style={[styles.noteBody, { flex: 1 }]}>
              {renderInlineText(trimmed.substring(2).trim(), textColor, langCode)}
            </Text>
          </View>
        );
      }

      // Handle numbered lists ("1. item")
      const numberMatch = trimmed.match(/^(\d+\.)\s(.*)/);
      if (numberMatch) {
        return (
          <View key={`num-${index}`} style={styles.bulletRow}>
            <Text style={[styles.bulletDot, { color: textColor, width: 20 }]}>{numberMatch[1]}</Text>
            <Text style={[styles.noteBody, { flex: 1 }]}>
              {renderInlineText(numberMatch[2], textColor, langCode)}
            </Text>
          </View>
        );
      }

      // Regular paragraph text
      return (
        <Text key={`text-${index}`} style={[styles.noteBody, { marginBottom: 8 }]}>
          {renderInlineText(trimmed, textColor, langCode)}
        </Text>
      );
    });
  };

  // Filter suggestions based on user input
  const filteredSuggestions = PROMPT_SUGGESTIONS[mode].filter(sug =>
    sug.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: '#000', justifyContent: 'center' }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.deniedContainer, { backgroundColor: colors.card, paddingBottom: insets.bottom + 80 }]}>
        <View style={[styles.deniedIconBox, { backgroundColor: colors.primary }]}>
          <Feather name="camera" size={28} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.deniedTitle, { color: colors.foreground }]}>Enable Camera Access</Text>
        <Text style={[styles.deniedBody, { color: colors.mutedForeground }]}>
          Camera access powers menu translation, payment etiquette, and transit decoding. Photos never leave your device.
        </Text>
        <TouchableOpacity style={[styles.enableBtn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
          <Text style={[styles.enableBtnText, { color: colors.primaryForeground }]}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />
      {pendingUploadPhoto && (
        <View 
          style={[
            StyleSheet.absoluteFillObject, 
            { 
              backgroundColor: '#000',
              paddingTop: (insets.top || 20) + 85,
              paddingBottom: bottomUIOffset + 160,
              paddingHorizontal: 16
            }
          ]}
        >
          <Image 
            source={{ uri: pendingUploadPhoto.uri }} 
            style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }} 
            resizeMode="contain" 
          />
        </View>
      )}

      {/* ─── INVISIBLE DISMISS OVERLAY ─── */}
      {/* Covers the screen behind the UI to close popups or the keyboard when tapping empty space */}
      {(showModeInfo || isSearchExpanded) && (
        <TouchableOpacity
          style={[StyleSheet.absoluteFillObject, { zIndex: 9 }]}
          activeOpacity={1}
          onPress={() => {
            if (showModeInfo) setShowModeInfo(false);
            if (isSearchExpanded) Keyboard.dismiss();
          }}
        />
      )}

      {/* ─── RETICLE FRAME (From Sketch) ─── */}
      {/* {!isSearchExpanded && (
        <View style={styles.reticleContainer} pointerEvents="none">
          <View style={[styles.corner, styles.topLeft, { borderColor: colors.primary }]} />
          <View style={[styles.corner, styles.topRight, { borderColor: colors.primary }]} />
          <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.primary }]} />
          <View style={[styles.corner, styles.bottomRight, { borderColor: colors.primary }]} />
        </View>
      )} */}

      {/* ─── CAPTURE BLUR SURROUND ─── */}
      {isCaptured && (
        <BlurView
          intensity={25}
          tint="dark"
          style={[StyleSheet.absoluteFillObject, { zIndex: 8 }]}
          pointerEvents="none"
        />
      )}



      {analyzing && (
        <View style={[StyleSheet.absoluteFillObject, styles.analyzingOverlay]}>
          <OceanLoader
            isFinished={aiFinished}
            onFinishComplete={handleFinishComplete}
          />
        </View>
      )}

      {/* ─── TOP SEARCH BAR & PILL ─── */}
      <View style={[styles.topOverlay, { paddingTop: insets.top || 20 }]}>

        {/* NEW WRAPPER: Keeps the search bar and the button in a row */}
        <View style={styles.topRowWrapper}>
          <View style={[styles.searchBar, isSearchExpanded && styles.searchBarExpanded]}>

            {/* Top Row: Icon & Input */}
            <View style={styles.searchInputWrapper}>
              <View style={{ paddingTop: Platform.OS === 'android' ? 4 : 2 }}>
                <Feather
                  name="search"
                  size={18}
                  color="#fff"
                  style={{ opacity: 0.8 }}
                />
              </View>

              <TextInput
                style={styles.searchInput}
                placeholder="Ask a specific question (optional)..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={searchQuery}
                onChangeText={(text) => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setSearchQuery(text);
                }}
                returnKeyType="done"
                blurOnSubmit={true}
                multiline={true}
                textAlignVertical="top"
                onSubmitEditing={Keyboard.dismiss}
                onFocus={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setIsSearchExpanded(true);
                }}
                onBlur={() => {
                  // LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setIsSearchExpanded(false);
                }}
              />
            </View>

            {/* Bottom Area: Suggested Prompts */}
            {isSearchExpanded && filteredSuggestions.length > 0 && (
              <View style={styles.suggestionsWrapper}>
                <Text style={styles.suggestionsTitle}>SUGGESTED</Text>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.suggestionsScrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredSuggestions.map((sug, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.suggestionChip}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setSearchQuery(sug);
                        setIsSearchExpanded(false);
                        Keyboard.dismiss();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestionChipText}>{sug}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Always-visible Submit Button — dimmed when idle, blue when active */}
          {/* <TouchableOpacity
            activeOpacity={0.8}
            onPress={Keyboard.dismiss}
            style={[
              styles.promptActionBtn,
              {
                backgroundColor: searchQuery.trim().length > 0
                  ? colors.primary
                  : 'rgba(255,255,255,0.15)'
              }
            ]}
          >
            <Feather
              name="arrow-up"
              size={20}
              color={searchQuery.trim().length > 0 ? colors.primaryForeground : 'rgba(255,255,255,0.4)'}
            />
          </TouchableOpacity> */}
        </View>

        {/* Hide the pill when expanded to keep the UI clean */}
        {!isSearchExpanded && (
          <View style={{ zIndex: 20, width: '100%', alignItems: 'center' }}>

            {/* The Row of Pills */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -4 }}>
              <TouchableOpacity
                style={[
                  styles.topPill,
                  showModeInfo && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setShowModeInfo(!showModeInfo)}
                activeOpacity={0.8}
              >
                <Feather
                  name="info"
                  size={12}
                  color="#fff"
                  style={{ opacity: showModeInfo ? 1 : 0.8 }}
                />
                <Text style={[styles.topPillText, showModeInfo && { color: '#fff' }]}>
                  {mode.toUpperCase()}
                </Text>
              </TouchableOpacity>

              {/* Your existing GPS Pill */}
              <TouchableOpacity
                style={[
                  styles.topPill,
                  { backgroundColor: profile.locationRoutingEnabled ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.1)' }
                ]}
                onPress={toggleGps}
                activeOpacity={0.8}
              >
                <Feather
                  name="map-pin"
                  size={10}
                  color={profile.locationRoutingEnabled ? colors.primary : colors.mutedForeground}
                />
                <Text style={[styles.topPillText, { color: profile.locationRoutingEnabled ? colors.primary : colors.mutedForeground }]}>
                  GPS: {profile.locationRoutingEnabled ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* THE TOOLTIP BUBBLE - Now dynamically positioned below the row */}
            {showModeInfo && (
              <View style={styles.modeInfoBubble}>
                <View style={styles.modeInfoPointer} />
                <Text style={styles.modeInfoText}>{MODE_DESCRIPTIONS[mode]}</Text>
              </View>
            )}

          </View>
        )}
      </View>

      {/* Spacer to push bottom bar down */}
      {!analyzing && <View style={{ flex: 1 }} />}

      {/* ─── BOTTOM CONTROLS ─── */}
      <View style={[styles.bottomBar, { bottom: bottomUIOffset }]}>
        {!analyzing && (
          <View style={styles.modeSelector}>
            {(['Menu', 'Payment', 'Transit'] as Mode[]).map((m) => {
              const isActive = m === mode;
              let icon: any = 'book-open';
              if (m === 'Payment') icon = 'credit-card';
              else if (m === 'Transit') icon = 'navigation';

              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeBtn, isActive && { backgroundColor: colors.primary }]}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setMode(m);
                  }}
                  disabled={analyzing}
                >
                  <Feather name={icon} size={14} color={isActive ? colors.primaryForeground : '#fff'} />
                  <Text style={[styles.modeBtnText, { color: isActive ? colors.primaryForeground : '#fff' }]}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.shutterRow}>
          <TouchableOpacity
            style={styles.galleryBtn}
            onPress={handleImagePick}
            disabled={analyzing}
            activeOpacity={0.8}
          >
            <Feather name={pendingUploadPhoto ? "x" : "image"} size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shutterRing}
            onPress={handleShutter}
            activeOpacity={0.95}
          >
            <View style={styles.shutterInner}>
              {analyzing ? (
                <ActivityIndicator color="#0a1f1e" />
              ) : (
                <Feather name="zap" size={22} color="#f4fffeff" />
              )}
            </View>
          </TouchableOpacity>

          {/* Spacer to keep shutter centered */}
          <View style={{ width: 44 }} />
        </View>

        <Text style={styles.captionText}>
          {analyzing ? 'READING THE SCENE…' : 'SCAN ENVIRONMENT'}
        </Text>
      </View>


      {/* ─── FIRST-TIME WELCOME GUIDE (with mascot) ─── */}
      <Modal visible={showWelcomeGuide} transparent animationType="fade">
        <View style={[styles.modalBackdrop, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <View style={[styles.welcomeCard, { backgroundColor: colors.card, borderColor: colors.border, maxHeight: '90%' }]}>

            {/* Added ScrollView to prevent overflow on smaller devices with the new content */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>

              {/* Mascot hero band */}
              <View style={[styles.welcomeHero, { backgroundColor: colors.muted }]}>
                <View style={styles.welcomeHeroOrb} />
                <View style={styles.welcomeHeroOrb2} />
                <DolphinMascot size={150} accent={colors.primary} accentDark={colors.primary} belly={colors.card} ink={colors.foreground} />
              </View>

              {/* Greeting */}
              <View style={styles.welcomeGreetRow}>
                <View style={[styles.welcomeGreetDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.welcomeGreetText, { color: colors.mutedForeground }]}>YOUR TRAVEL COMPANION</Text>
              </View>

              <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
                Hi, I'm Finn — let's read the scene together.
              </Text>
              <Text style={[styles.welcomeBody, { color: colors.mutedForeground }]}>
                Point your camera at anything confusing abroad. I'll translate, decode and explain it in seconds.
              </Text>

              <View style={styles.welcomeModesList}>
                {(['Menu', 'Payment', 'Transit'] as Mode[]).map((m) => {
                  let icon: any = 'book-open';
                  if (m === 'Payment') icon = 'credit-card';
                  else if (m === 'Transit') icon = 'navigation';

                  return (
                    <View key={m} style={styles.welcomeModeRow}>
                      <View style={[styles.welcomeModeIcon, { backgroundColor: colors.muted }]}>
                        <Feather name={icon} size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.welcomeModeTitle, { color: colors.foreground }]}>{m.toUpperCase()}</Text>
                        <Text style={[styles.welcomeModeDesc, { color: colors.mutedForeground }]}>
                          {MODE_DESCRIPTIONS[m]}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* NEW: Quick Tips Section for Feature Discovery */}
              <View style={{ marginTop: 8, marginBottom: 28, paddingTop: 24, borderTopWidth: 1, borderColor: colors.border }}>
                <Text style={[styles.welcomeModeTitle, { color: colors.foreground, marginBottom: 16 }]}>QUICK TIPS</Text>

                <View style={{ gap: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <Feather name="search" size={16} color={colors.primary} style={{ width: 20, textAlign: 'center' }} />
                    <Text style={[styles.welcomeModeDesc, { color: colors.mutedForeground, flex: 1, lineHeight: 20 }]}>
                      Interact with the <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>search bar</Text> at the top to ask specific questions about the scene.
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <Feather name="map-pin" size={16} color={colors.primary} style={{ width: 20, textAlign: 'center' }} />
                    <Text style={[styles.welcomeModeDesc, { color: colors.mutedForeground, flex: 1, lineHeight: 20 }]}>
                      Toggle <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>GPS</Text> on for hyper-local transit routing and location awareness.
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <Feather name="info" size={16} color={colors.primary} style={{ width: 20, textAlign: 'center' }} />
                    <Text style={[styles.welcomeModeDesc, { color: colors.mutedForeground, flex: 1, lineHeight: 20 }]}>
                      Tap the <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>Mode pill</Text> at the top to reopen these instructions anytime.
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

      {/* Result Modal */}
      <Modal visible={showResultSheet} transparent animationType="none" onRequestClose={closeSheet}>
        <Animated.View style={[styles.modalBackdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.modalDismissArea} activeOpacity={1} onPress={closeSheet} />
          <Animated.View style={[styles.sheet, { backgroundColor: colors.card, maxHeight: Dimensions.get('window').height * 0.82, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.handle} />
            <ScrollView showsVerticalScrollIndicator bounces contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 24 }}>
              <Text style={[styles.sheetEyebrow, { color: colors.mutedForeground }]}>{mode.toUpperCase()} INTELLIGENCE</Text>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{result?.title}</Text>

              {result?.userAnswer && (
                <View style={[styles.userAnswerBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Text style={[styles.userAnswerLabel, { color: colors.primary }]}>DIRECT ANSWER</Text>
                  {/* Apply formatting to the direct answer too */}
                  <View style={{ marginTop: 4 }}>
                    {renderFormattedText(result.userAnswer, colors.foreground, result?.languageCode)}
                  </View>
                </View>
              )}

              {mode === 'Transit' && result?.mapLocationName && (
                <TouchableOpacity
                  style={[styles.mapsButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => openMap(result.mapLocationName!)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.mapsIconBox, { backgroundColor: colors.primary }]}>
                    <Feather name="navigation" size={16} color={colors.primaryForeground} />
                  </View>

                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[styles.mapsButtonTitle, { color: colors.foreground }]}>Open in Maps</Text>
                    <Text
                      style={[styles.mapsButtonSubtitle, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {result.mapLocationName}
                    </Text>
                  </View>

                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}

              <View style={styles.badgeRow}>
                {result?.badges?.map((b, i) => {
                  let bg = colors.muted;
                  let dot = colors.primary;
                  let label = colors.foreground;
                  if (b.type === 'warn') {
                    bg = colors.isDark ? 'rgba(245, 185, 98, 0.15)' : '#fdf2dc';
                    dot = colors.isDark ? '#f5b962' : '#a76b18';
                    label = colors.isDark ? '#f5b962' : '#7a4f12';
                  } else if (b.type === 'good') {
                    bg = colors.isDark ? 'rgba(21, 128, 61, 0.2)' : '#dff1e1';
                    dot = colors.isDark ? '#4ade80' : '#15803d';
                    label = colors.isDark ? '#4ade80' : '#14532d';
                  }
                  return (
                    <View key={i} style={[styles.badge, { backgroundColor: bg }]}>
                      <View style={[styles.badgeDot, { backgroundColor: dot }]} />
                      <Text style={[styles.badgeText, { color: label }]}>{b.text}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.notesColumn}>
                {result?.notes?.map((n, i) => {
                  return (
                    <View key={i} style={[styles.noteCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                      <Text style={[styles.noteTitle, { color: colors.primary }]}>{n.title}</Text>
                      <View style={{ marginTop: 8 }}>
                        {/* Pass the languageCode down into the parser */}
                        {renderFormattedText(n?.body || "Analysis details unavailable.", colors.foreground, result?.languageCode)}
                      </View>
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity style={[styles.gotItBtn, { backgroundColor: colors.primary }]} onPress={closeSheet}>
                <Text style={[styles.gotItText, { color: colors.primaryForeground }]}>Got it</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // -- Top Overlay & Search Bar --
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 20, zIndex: 10 },

  // NEW: Row wrapper for the bar and the button
  topRowWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    gap: 12,
  },

  searchBar: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: 'rgba(0,0,0,0.80)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchBarExpanded: {
    // backgroundColor: 'rgba(0,0,0,0.85)',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: '#fff',
    paddingTop: 0,
    paddingBottom: 0,
    maxHeight: 80,
  },
  promptActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  // ─── Suggestion Chips ───
  suggestionsWrapper: {
    marginTop: 16,
  },
  suggestionsTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
  },
  suggestionsScrollContent: {
    gap: 8,
    paddingBottom: 12,
  },
  suggestionChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  suggestionChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#fff',
  },
  topPill: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#5c7ce5' },
  topPillText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.2, color: '#fff' },

  // -- Bracket Reticle --
  reticleContainer: { position: 'absolute', top: '16%', bottom: '32%', left: '10%', right: '10%', zIndex: 5 },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: '#5c7ce5' },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 16 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 16 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 16 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 16 },

  deniedContainer: { flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  deniedIconBox: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  deniedTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.5, textAlign: 'center', marginTop: 24, marginBottom: 12 },
  deniedBody: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24, textAlign: 'center', marginBottom: 32, opacity: 0.8 },
  enableBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  enableBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },

  analyzingOverlay: { backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', gap: 20, zIndex: 10 },
  analyzingCaption: { fontFamily: 'Inter_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.3 },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 20 },
  modeSelector: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, padding: 5, gap: 4, marginBottom: 20 },
  modeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, gap: 6 },
  modeBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 32, marginBottom: 12 },
  galleryBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  shutterRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#5c7ce5', alignItems: 'center', justifyContent: 'center' },
  captionText: { color: '#fff', fontFamily: 'Inter_500Medium', fontSize: 12, opacity: 0.8, letterSpacing: 1 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalDismissArea: { flex: 1 },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 14 },
  handle: { width: 38, height: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetEyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.4, marginBottom: 4 },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.4, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, gap: 6 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  notesColumn: { gap: 12, marginBottom: 24 },
  noteCard: { padding: 14, borderRadius: 14, borderWidth: 1 },
  noteTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },

  // Base text is now larger and uses Inter_500Medium
  noteBody: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22 },

  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, paddingRight: 8 },
  // Bullet dots are now bolder and align perfectly with the larger text
  bulletDot: { fontFamily: 'Inter_700Bold', fontSize: 15, marginRight: 10, lineHeight: 22, opacity: 0.8 },
  gotItBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  gotItText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },

  userAnswerBox: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 18, gap: 6 },
  userAnswerLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, letterSpacing: 1.2 },
  userAnswerText: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 },
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20
  },
  mapsIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  mapsButtonTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  mapsButtonSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 1 },

  // ─── Tooltip Styles ───
  modeInfoBubble: {
    position: 'absolute',
    top: '100%', // Automatically snaps to the bottom of the pill row
    marginTop: 14, // Space for the arrow
    width: Dimensions.get('window').width * 0.85, // Responsive to phone size
    maxWidth: 340, // Prevents it from getting too wide on tablets
    backgroundColor: 'rgba(10, 15, 25, 0.95)',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  modeInfoPointer: {
    position: 'absolute',
    top: -7,
    left: '50%',
    marginLeft: -48, // Perfectly offsets the arrow to point directly at the Mode pill
    width: 12,
    height: 12,
    backgroundColor: 'rgba(10, 15, 25, 0.95)',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    transform: [{ rotate: '45deg' }],
  },
  modeInfoText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#f8fafc',
    lineHeight: 20,
  },
  // ─── Welcome Guide Styles ───
  welcomeCard: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  welcomeIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  welcomeTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.4, marginBottom: 8 },
  welcomeBody: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, marginBottom: 24 },
  welcomeModesList: { gap: 18, marginBottom: 32 },
  welcomeModeRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  welcomeModeIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  welcomeModeTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 1, marginBottom: 2 },
  welcomeModeDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  welcomeBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  welcomeBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  welcomeHero: {
    height: 170,
    borderRadius: 20,
    marginBottom: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  welcomeHeroOrb: {
    position: 'absolute',
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(92,124,229,0.10)',
    top: -90, left: -60,
  },
  welcomeHeroOrb2: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(245,185,98,0.10)',
    bottom: -60, right: -40,
  },
  welcomeGreetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  welcomeGreetDot: { width: 6, height: 6, borderRadius: 3 },
  welcomeGreetText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.4 },

});
