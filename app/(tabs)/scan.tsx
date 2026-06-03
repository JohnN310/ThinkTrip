import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Platform, Alert, Dimensions, Animated, Easing, TextInput, Keyboard, LayoutAnimation, UIManager, Linking, Image, SectionList, PanResponder, KeyboardAvoidingView, FlatList } from 'react-native';
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
import { useFocusEffect } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import OceanLoader from '../../components/OceanLoader';
import DolphinLoaderScreen from '../../components/DolphinLoaderScreen';
import { DolphinMascot } from '../../components/DolphinMascot';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MenuData, ScanResult, ReceiptData, ReceiptItem } from '../../lib/scanTypes';
import { MenuItemRow, MenuCategoryHeader } from '../../components/MenuRenderer';
import { ReceiptRenderer } from '../../components/ReceiptRenderer';
import { SignRenderer } from '../../components/SignRenderer';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import Translate from '@react-native-ml-kit/translate-text';
const { width, height } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const TypingIndicator = ({ color }: { color: string }) => {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true })
        ])
      ).start();
    };
    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 22 }}>
      <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: dot1 }} />
      <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: dot2 }} />
      <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: dot3 }} />
    </View>
  );
};



type Mode = 'Menu' | 'Bill/Receipt' | 'Sign';

const PROMPT_SUGGESTIONS: Record<Mode, string[]> = {
  Menu: [
    "What is the most traditional dish on this page?",
    "Which of these takes the longest to prepare?",
    "Are any of these dishes meant to be shared?",
    "What is a standard drink pairing for the top item?"
  ],
  "Bill/Receipt": [
    "Do they accept international Visa/Mastercard?",
    "Are there any hidden service charges or seating fees on this bill?",
    "Is it polite to split the bill (go Dutch) here?",
    "Do I pay at the table or at the register?"
  ],
  Sign: [
    "What does this sign mean?",
    "Am I allowed to park here right now?",
    "Is this a warning or just an informational notice?",
    "Where is this directing me?"
  ]
};





const getMarkdownStyles = (textColor: string, colors: any) => ({
  body: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    lineHeight: 22,
    color: textColor,
  },
  heading1: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    marginTop: 12,
    marginBottom: 8,
    color: textColor,
  },
  heading2: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    marginTop: 10,
    marginBottom: 6,
    color: textColor,
  },
  heading3: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 4,
    color: textColor,
  },
  strong: {
    fontFamily: 'Inter_700Bold',
  },
  em: {
    fontStyle: 'italic' as const,
  },
  blockquote: {
    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    borderColor: colors.border,
    borderLeftWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 8,
    borderRadius: 4,
  },
  code_inline: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 13,
  },
  fence: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
    borderColor: colors.border,
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    fontSize: 13,
    color: textColor,
  },
  link: {
    color: colors.primary,
    textDecorationLine: 'none' as const,
  },
  list_item: {
    marginVertical: 4,
  },
  bullet_list_icon: {
    color: textColor,
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    marginTop: Platform.OS === 'ios' ? 0 : 2,
  }
});

export default function ScanScreen() {

  const [permission, requestPermission] = useCameraPermissions();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, save, setDraft, hydrated } = useProfile();

  // Define a platform-specific offset for the bottom controls
  const bottomUIOffset = Platform.select({
    ios: insets.bottom + 70, // Accounts for the dynamic iOS home indicator
    android: 20,              // Fixed value to sit perfectly above Android's 60px tab bar
    default: 20,
  }) ?? 20;

  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [isChatTyping, setIsChatTyping] = useState(false);
  const chatInputRef = useRef<TextInput>(null);
  const chatListRef = useRef<FlatList>(null);

  // ─── CHAT ANIMATION STATE ───
  const chatAnim = useRef(new Animated.Value(0)).current;
  const [chatOrigin, setChatOrigin] = useState({ x: 0, y: 0 });

  const openChat = () => {
    // 1. Calculate the center of the target Chat Sheet (which sits at the bottom, 65% height)
    const sheetCenterY = height - (height * 0.80) / 2;
    const sheetCenterX = width / 2;

    // 2. Get safe absolute coordinates of the mascot
    const mascotCenter = getMascotCenter();

    // 3. Set the translation origin delta
    setChatOrigin({
      x: mascotCenter.x - sheetCenterX,
      y: mascotCenter.y - sheetCenterY,
    });

    // 4. Open modal and spring the animation
    setIsChatOpen(true);
    Animated.spring(chatAnim, {
      toValue: 1,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // 5. Automatically pull up the keyboard
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 150);
  };

  const closeChat = () => {
    // 1. Dismiss the keyboard first so it slides down gracefully
    Keyboard.dismiss();

    // 2. Wait just a split second for the layout to settle back down
    // before we shrink the chat window. This prevents the "jumping" glitch.
    setTimeout(() => {
      Animated.timing(chatAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setIsChatOpen(false);
      });
    }, 100);
  };

  // ─── FLOATING MASCOT DRAG LOGIC WITH BOUNDARIES ───

  // Set starting coordinates: Right side (width - 80px for margin) and 80% down
  const initialX = Dimensions.get('window').width - 80;
  const initialY = Dimensions.get('window').height * 0.2;

  const pan = useRef(new Animated.ValueXY({
    x: initialX,
    y: initialY
  })).current;

  // Helper function to safely get absolute coordinates regardless of drag offsets
  const getMascotCenter = () => {
    // @ts-ignore - Safely read internal Animated values
    const currentX = pan.x._value + pan.x._offset;
    // @ts-ignore
    const currentY = pan.y._value + pan.y._offset;
    return {
      x: currentX + 32, // +32 for center of the 64px button
      y: currentY + 32,
    };
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        pan.extractOffset();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  const [mode, setMode] = useState<Mode>('Menu');
  const [showModeInfo, setShowModeInfo] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategoryExpand = (categoryName: string) => {
    // 1. Replace the basic easeInEaseOut with a custom, premium animation config
    LayoutAnimation.configureNext({
      duration: 300, // Slightly longer duration for a calmer feel
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity, // Fades new items in smoothly
      },
      update: {
        type: LayoutAnimation.Types.spring,
        springDamping: 12, // Adds a very subtle, natural deceleration
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity, // Fades items out when collapsing
      },
    });

    // 2. State update remains exactly the same
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  const MODE_DESCRIPTIONS: Record<Mode, string> = {
    Menu: "Scan restaurant or cafe menus to extract all dishes, decode ingredients, and check dietary safety.",
    "Bill/Receipt": "Scan restaurant bills or store receipts to itemize costs, detect hidden fees, and understand tipping culture.",
    Sign: "Scan physical signs, notices, or warnings to translate them and extract actionable instructions."
  };

  // Auto-close the tooltip if they change the mode using the bottom bar
  useEffect(() => {
    setShowModeInfo(false);
  }, [mode]);

  const [analyzing, setAnalyzing] = useState(false);
  const [aiFinished, setAiFinished] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [currentScanImage, setCurrentScanImage] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [captionIndex, setCaptionIndex] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isCaptured, setIsCaptured] = useState(false);
  const [pendingUploadPhoto, setPendingUploadPhoto] = useState<{ uri: string, base64: string } | null>(null);

  const [showResultSheet, setShowResultSheet] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // NEW: One-Time Welcome Guide State
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);

  // --- Welcome Guide Scroll State ---
  const welcomeScrollRef = useRef<ScrollView>(null);
  const [welcomeScrollHeight, setWelcomeScrollHeight] = useState(0);
  const [welcomeContentHeight, setWelcomeContentHeight] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const isWelcomeScrollable = welcomeContentHeight > welcomeScrollHeight;

  const handleWelcomeScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 20) {
      setIsAtBottom(true);
    } else {
      setIsAtBottom(false);
    }
  };

  useEffect(() => {
    if (isWelcomeScrollable) {
      setIsAtBottom(false);
    } else {
      setIsAtBottom(true);
    }
  }, [isWelcomeScrollable]);

  useFocusEffect(
    useCallback(() => {
      if (!hydrated) return;

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
    }, [hydrated])
  );

  // Clear chatbot memory when navigating away from this tab
  useFocusEffect(
    useCallback(() => {
      return () => {
        setChatMessages([]);
      };
    }, [])
  );

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

      // Add this line to wipe the chatbot's memory for the next scan
      // setChatMessages([]);

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

  const analyzeImage = async (base64Image: string, imageUri: string, currentMode: Mode, location?: Location.LocationObject | null): Promise<ScanResult> => {
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
    // } else if (currentMode === 'Bill/Receipt') {
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
      allergies: profile.allergies,
      customAllergies: profile.customAllergies,
      body: {
        activityLevel: profile.activityLevel,
      }
    };

    /* ==============================================================
       --- LIVE GEMINI MODE (COMMENTED OUT FOR ML KIT TESTING) ---
       ==============================================================
       */
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing Gemini API Key");
    const genAI = new GoogleGenerativeAI(apiKey);
    const generationConfig = {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    };
    let model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite", generationConfig });

    const targetLangCode = profile.scanTargetLanguage || 'en';
    const sourceLangCode = profile.scanSourceLanguage || 'ja';

    const prompt = `
      You are the intelligence engine for "ThinkTrip", a premium, clinical, biometrically-aware travel OS. 
      Your primary directive is to decode cultural nuances, eliminate language barriers, and protect the user's biometric baseline, granting them absolute confidence in unfamiliar environments.

      Analyze the provided image and generate a response formatted strictly as valid JSON.

      **CURRENT CONTEXT:**
      - Active Mode: ${currentMode}
      - Target Translation Language: ${targetLangCode} (ISO 639-1 code)
      - Foreign Source Language: ${sourceLangCode} (ISO 639-1 code)
      - User's Health Baseline: ${JSON.stringify(healthBaseline)}
      - GPS Status: ${location
        ? `ACTIVE (Lat: ${location.coords.latitude}, Lng: ${location.coords.longitude}). CRITICAL: Bias all transit POIs to this exact physical location.`
        : `DISABLED. The user has opted out of location tracking. Do not attempt to guess the city or generate map routing.`}

      **CRITICAL RULES:**
      1. **IMAGE FIRST:** Extract text, context, and environment details exclusively from the image. If the image is completely illegible or entirely unrelated to the Active Mode, do not hallucinate. Set the 'title' to 'Unable to Analyze', omit the 'userAnswer', and provide a single 'warn' badge indicating the image is unclear.
      2. **TONE & FORMATTING:** Calm, premium, clinical, objective. STRICTLY NO EMOJIS, NO UNICODE ICONS. Output pure text only. DO NOT USE PARAGRAPHS in the 'notes' section. The 'body' of EVERY note MUST be a strict bulleted list ("- "). 
      3. **BE RUTHLESSLY CONCISE:** Keep every bullet point to a maximum of 15 words. Prioritize quick scannability over complete sentences. (Note: The native phrase and phonetic spelling do not count towards this limit).
      4. **BIOMETRIC AWARENESS:** Cross-reference image contents with the User's Baseline. Always flag items that violate their dietary or health restrictions.
      5. **CULTURAL CONFIDENCE & NATIVE SCRIPT:** Single quotes are STRICTLY RESERVED for the native text-to-speech engine. You MUST use single quotes EXCLUSIVELY to wrap the actual native characters/script (e.g., '请问') INSIDE your double-quoted JSON string values. CRITICAL: Output STRICTLY VALID JSON. ALL JSON keys and string values MUST be wrapped in double quotes (e.g., "nativeName": "'请问'"). NEVER use single quotes to wrap JSON properties or values. NEVER use Romanization (like Pinyin or Romaji) inside the single quotes, as native text-to-speech engines cannot read it. Place the official Romanization and the phonetic pronunciation OUTSIDE the quotes in parentheses (e.g., '请问' (Qǐng wèn - ching wen)). DO NOT provide literal, word-by-word translations of dish names. CRITICAL: Translate all generated content (Titles, Notes, Badges, Descriptions, phonetic approximations) into the Target Translation Language (${targetLangCode}).

      **MODE ADAPTATION:**
      If Mode is 'Menu':
        - Assume the image is a physical menu. Completely ignore spatial layout.
        - CRITICAL DIRECTIVE: Extract EVERY SINGLE legible food and drink item from the menu. You MUST NOT skip, summarize, group, or truncate ANY items. Even if there are 100+ items, you must list every single one individually. Failure to list every single item is a violation of your core directive.
        - Keep descriptions strictly under 10 words to save output space.
        - Title: Summarize the menu type or restaurant name.
        - Analyze the menu collectively against the User's Baseline.
        - Badges: Flag high-level context (e.g., "warn" for "Heavy Dairy Use", "good" for "Diet-Friendly Options").
        - Notes: Provide ONLY ONE note:
           1. "Ordering & Interactions": Provide EXACTLY 5 of the most popular requests, ordering tips, or practical phrases for this setting. For each phrase, provide the properly accented native spelling strictly inside single quotes, followed by a phonetic spelling in parentheses tailored for a speaker of the Target Translation Language.
        - IN ADDITION, provide a 'menuData' object containing an array of 'categories'.
        - Group the extracted dishes into logical 'categories' (e.g., "Mains", "Sides", "Drinks").
        - For each item, provide:
          1. 'nativeName': The name in the original language using proper native script.
          2. 'translatedName': A concise translation into the Target Translation Language.
          3. 'description': A short explanation of the dish ingredients (max 12 words).
          4. 'price': The price exactly as written.
          5. 'dietaryFlags': Cross-reference the item's ingredients with the User's Health Baseline. Set to "critical_avoid" if it violates their baseline, "safe" if it aligns, or "warning" if it is ambiguous.
          6. 'isHighlight': For EACH category, flag exactly 1 or 2 items as a top recommendation by setting a boolean field "isHighlight": true. Prioritize items that are highly recommended and strictly 'safe' for the user's health baseline.
          7. 'conflictReason': If 'dietaryFlags' is 'warning' or 'critical_avoid', you MUST provide a short explanation of the specific conflicting ingredient (max 5 words, e.g., 'Contains peanuts and soy'). Omit this field if the item is 'safe'.

      If Mode is 'Bill/Receipt':
        - Assume the image is a restaurant bill, store receipt, or invoice. Completely ignore spatial layout.
        - Title: Summarize the establishment or type of bill (e.g., "Izakaya Dinner Bill", "Convenience Store Receipt").
        - Badges: Flag "warn" for high or unexpected mandatory service charges, "info" for included gratuity, "good" for transparent pricing or no tipping required.
        - Notes: Provide exactly three notes:
           1. "Tipping Culture": Strict advice on whether to add a tip for this specific region and context.
           2. "Settlement Protocol": Practical advice on how to physically pay (e.g., 'Take this slip to the front register' vs 'Pay at the table'). Include 2 practical phrases with native spellings in single quotes for asking to split the bill or pay by card.
        - Additionally, provide a 'receiptData' object.
        - Extract EVERY legible line item from the bill into the 'items' array. For each item, provide:
           1. 'originalName': The item name exactly as printed in the native script.
           2. 'translatedName': A concise translation into the Target Translation Language.
           3. 'price': The cost of the item in the native currency.
           4. 'convertedPrice': Calculate the estimated cost converted into the primary currency of the Target Translation Language (${targetLangCode}). Include the currency symbol (e.g., "$4.50", "€4.10").
        - Extract the 'subtotal', 'tax', 'serviceCharge', and 'total'. If a value is not present on the receipt, return "0" or "N/A". Also calculate and provide 'convertedSubtotal', 'convertedTax', 'convertedServiceCharge', and 'convertedTotal' using the same currency conversion logic.
        - Identify the 'currencySymbol' (e.g., "¥", "€", "$", "₫").

      If Mode is 'Sign':
        - Assume the image is a street sign, warning, notice, or directional board. Completely ignore spatial layout.
        - Title: Summarize the type of sign (e.g., "Parking Restriction", "Transit Notice").
        - Badges: "info" for general context, "warn" for restrictions or penalties, "good" for allowed actions.
        - Notes: Provide exactly ONE note:
           1. "Context & Norms": Explain any unspoken local rules or cultural context surrounding this type of sign.
        - IN ADDITION, provide a 'signData' object.
           1. 'originalText': EXACTLY transcribe ALL legible text from the sign in the native script. Do not summarize, truncate, or skip any text.
           2. 'translatedText': A complete, direct English translation of ALL the transcribed text.
           3. 'instruction': Clinical, actionable advice on what the user MUST do (e.g., 'Do not park here between 8 AM and 6 PM', 'Enter through the left turnstile').

      **REQUIRED JSON STRUCTURE:**
      {
        "title": "Short Title (Translated into Target Language)",
        "badges": [
          { "type": "good" | "warn" | "info", "text": "Short badge text" }
        ],
        "notes": [
          { "title": "Category (e.g., Behavioral Norms)", "body": "Clinical, concise explanation with phonetic phrasing if needed. CRITICAL: Use \\n for paragraph breaks and '- ' for bullet points." }
        ]${currentMode === 'Menu' ? `,
        "menuData": {
          "categories": [
            {
              "categoryName": "String",
              "items": [
                {
                  "nativeName": "'String'",
                  "translatedName": "String",
                  "description": "String",
                  "price": "String",
                  "dietaryFlags": "safe | warning | critical_avoid",
                  "isHighlight": false,
                  "conflictReason": "String (omit if safe)"
                }
              ]
            }
          ]
        }` : ''}${currentMode === 'Bill/Receipt' ? `,
        "receiptData": {
          "currencySymbol": "String",
          "subtotal": "String",
          "convertedSubtotal": "String",
          "tax": "String",
          "convertedTax": "String",
          "serviceCharge": "String",
          "convertedServiceCharge": "String",
          "total": "String",
          "convertedTotal": "String",
          "items": [
            {
              "originalName": "'String'",
              "translatedName": "String",
              "price": "String",
              "convertedPrice": "String"
            }
          ]
        }` : ''}${currentMode === 'Sign' ? `,
        "signData": {
          "originalText": "'String'",
          "translatedText": "String",
          "instruction": "String"
        }` : ''}
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
    try {
      const responseText = contentResult.response.text().trim();

      // Isolate the JSON by finding the first and last curly braces.
      // This completely ignores any conversational filler or markdown ticks the AI might have added.
      const firstBrace = responseText.indexOf('{');
      const lastBrace = responseText.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error("No valid JSON structure found in AI response.");
      }

      const jsonString = responseText.slice(firstBrace, lastBrace + 1);
      return JSON.parse(jsonString) as ScanResult;

    } catch (e) {
      console.error("JSON parsing error:", e);

      // If you are still hitting token limits, we throw a specific error so the user knows what happened.
      if (e instanceof SyntaxError && e.message.includes('Unexpected end of input')) {
        throw new Error("The menu was too large and the analysis timed out. Try scanning a smaller section of the menu.");
      }

      throw new Error("Analysis failed: Received malformed data from AI. Please try again.");
    }


    // ==============================================================
    // --- ML KIT TEXT RECOGNITION & TRANSLATION MODE ---
    // ==============================================================
    // try {
    //   // 1. Extract raw text from the image URI
    //   const recognizedResult = await TextRecognition.recognize(imageUri);
    //   const extractedText = recognizedResult.text;

    //   if (!extractedText || extractedText.trim() === '') {
    //     return {
    //       title: 'Unable to Analyze',
    //       badges: [{ type: 'warn', text: 'No legible text found' }],
    //       notes: []
    //     };
    //   }

    //   // 3. AI Analysis using ML Kit translation
    //   const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    //   if (!apiKey) throw new Error("Missing Gemini API Key");
    //   const genAI = new GoogleGenerativeAI(apiKey);
    //   const generationConfig = {
    //     responseMimeType: "application/json",
    //     maxOutputTokens: 8192,
    //   };
    //   let model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite", generationConfig });

    //   const prompt = `
    //     You are the intelligence engine for "ThinkTrip", a premium, clinical, biometrically-aware travel OS. 
    //     Your primary directive is to decode cultural nuances, eliminate language barriers, and protect the user's biometric baseline, granting them absolute confidence in unfamiliar environments.

    //     Analyze the provided image alongside the text, and generate a response formatted strictly as valid JSON.

    //     **ORIGINAL TEXT:**
    //     ${extractedText}

    //     **CURRENT CONTEXT:**
    //     - Active Mode: ${currentMode}
    //     - User's Health Baseline: ${JSON.stringify(healthBaseline)}
    //     - GPS Status: ${location
    //       ? `ACTIVE (Lat: ${location.coords.latitude}, Lng: ${location.coords.longitude}). CRITICAL: Bias all transit POIs to this exact physical location.`
    //       : `DISABLED. The user has opted out of location tracking. Do not attempt to guess the city or generate map routing.`}

    //     **CRITICAL RULES:**
    //     1. **IMAGE FIRST:** Extract text, context, and environment details exclusively from the image. If the image is completely illegible or entirely unrelated to the Active Mode, do not hallucinate. Set the 'title' to 'Unable to Analyze', omit the 'userAnswer', and provide a single 'warn' badge indicating the image is unclear.
    //     2. **TONE & FORMATTING:** Calm, premium, clinical, objective. STRICTLY NO EMOJIS, NO UNICODE ICONS. Output pure text only. DO NOT USE PARAGRAPHS in the 'notes' section. The 'body' of EVERY note MUST be a strict bulleted list ("- "). 
    //     3. **BE RUTHLESSLY CONCISE:** Keep every bullet point to a maximum of 15 words. Prioritize quick scannability over complete sentences. (Note: The native phrase and phonetic spelling do not count towards this limit).
    //     4. **BIOMETRIC AWARENESS:** Cross-reference image contents with the User's Baseline. Always flag items that violate their dietary or health restrictions.
    //     5. **CULTURAL CONFIDENCE & NATIVE SCRIPT:** Single quotes are STRICTLY RESERVED for the native text-to-speech engine. You MUST use single quotes EXCLUSIVELY to wrap the actual native characters/script (e.g., '请问') INSIDE your double-quoted JSON string values. CRITICAL: Output STRICTLY VALID JSON. ALL JSON keys and string values MUST be wrapped in double quotes (e.g., "nativeName": "'请问'"). NEVER use single quotes to wrap JSON properties or values. NEVER use Romanization (like Pinyin or Romaji) inside the single quotes, as native text-to-speech engines cannot read it. Place the official Romanization and the English-approximated phonetic pronunciation OUTSIDE the quotes in parentheses (e.g., '请问' (Qǐng wèn - ching wen)). DO NOT provide literal, word-by-word English translations of dish names. 

    //     **MODE ADAPTATION:**
    //     If Mode is 'Menu':
    //       - Assume the image is a physical menu. Completely ignore spatial layout.
    //       - CRITICAL DIRECTIVE: Extract EVERY SINGLE legible food and drink item from the menu. You MUST NOT skip, summarize, group, or truncate ANY items. Even if there are 100+ items, you must list every single one individually. Failure to list every single item is a violation of your core directive.
    //       - Keep descriptions strictly under 10 words to save output space.
    //       - Title: Summarize the menu type or restaurant name.
    //       - Analyze the menu collectively against the User's Baseline.
    //       - Badges: Flag high-level context (e.g., "warn" for "Heavy Dairy Use", "good" for "Diet-Friendly Options").
    //       - Notes: Provide ONLY ONE note:
    //          1. "Ordering & Interactions": Provide EXACTLY 5 of the most popular requests, ordering tips, or practical phrases for this setting. For each phrase, provide the properly accented native spelling strictly inside single quotes, followed by an English-approximated phonetic spelling in parentheses (e.g., "- To request no cilantro, say 'Không ngò' (kohng ngo)").
    //       - IN ADDITION, provide a 'menuData' object containing an array of 'categories'.
    //       - Group the extracted dishes into logical 'categories' (e.g., "Mains", "Sides", "Drinks").
    //       - For each item, provide:
    //         1. 'nativeName': The name in the original language using proper native script.
    //         2. 'description': A short explanation of the dish ingredients (max 12 words).
    //         3. 'price': The price exactly as written.
    //         4. 'dietaryFlags': Cross-reference the item's ingredients with the User's Health Baseline. Set to "critical_avoid" if it violates their baseline, "safe" if it aligns, or "warning" if it is ambiguous.
    //         5. 'isHighlight': For EACH category, flag exactly 1 or 2 items as a top recommendation by setting a boolean field "isHighlight": true. Prioritize items that are highly recommended and strictly 'safe' for the user's health baseline.
    //         6. 'conflictReason': If 'dietaryFlags' is 'warning' or 'critical_avoid', you MUST provide a short explanation of the specific conflicting ingredient (max 5 words, e.g., 'Contains peanuts and soy'). Omit this field if the item is 'safe'.

    //     If Mode is 'Bill/Receipt':
    //       - Assume the image is a restaurant bill, store receipt, or invoice. Completely ignore spatial layout.
    //       - Title: Summarize the establishment or type of bill (e.g., "Izakaya Dinner Bill", "Convenience Store Receipt").
    //       - Badges: Flag "warn" for high or unexpected mandatory service charges, "info" for included gratuity, "good" for transparent pricing or no tipping required.
    //       - Notes: Provide exactly three notes:
    //          1. "Tipping Culture": Strict advice on whether to add a tip for this specific region and context.
    //          2. "Settlement Protocol": Practical advice on how to physically pay (e.g., 'Take this slip to the front register' vs 'Pay at the table'). Include 2 practical phrases with native spellings in single quotes for asking to split the bill or pay by card.
    //       - Additionally, provide a 'receiptData' object.
    //       - Extract EVERY legible line item from the bill into the 'items' array. For each item, provide:
    //          1. 'originalName': The item name exactly as printed in the native script.
    //          2. 'price': The cost of the item.
    //       - Extract the 'subtotal', 'tax', 'serviceCharge', and 'total'. If a value is not present on the receipt, return "0" or "N/A".
    //       - Identify the 'currencySymbol' (e.g., "¥", "€", "$", "₫").

    //     If Mode is 'Sign':
    //       - Assume the image is a street sign, warning, notice, or directional board. Completely ignore spatial layout.
    //       - Title: Summarize the type of sign (e.g., "Parking Restriction", "Transit Notice").
    //       - Badges: "info" for general context, "warn" for restrictions or penalties, "good" for allowed actions.
    //       - Notes: Provide exactly ONE note:
    //          1. "Context & Norms": Explain any unspoken local rules or cultural context surrounding this type of sign.
    //       - IN ADDITION, provide a 'signData' object.
    //          1. 'originalText': EXACTLY transcribe ALL legible text from the sign in the native script. Do not summarize, truncate, or skip any text.
    //          2. 'instruction': Clinical, actionable advice on what the user MUST do (e.g., 'Do not park here between 8 AM and 6 PM', 'Enter through the left turnstile').

    //     **REQUIRED JSON STRUCTURE:**
    //     {
    //       "title": "Short Title (In English)",
    //       "languageCode": "The exact BCP-47 language tag for the primary foreign language detected in the image (e.g., 'vi-VN', 'ja-JP', 'fr-FR', 'es-ES'). Omit this field if the image is purely English.",
    //       "badges": [
    //         { "type": "good" | "warn" | "info", "text": "Short badge text" }
    //       ],
    //       "notes": [
    //         { "title": "Category (e.g., Behavioral Norms)", "body": "Clinical, concise explanation with phonetic phrasing if needed. CRITICAL: Use \\n for paragraph breaks and '- ' for bullet points." }
    //       ]${currentMode === 'Menu' ? `,
    //       "menuData": {
    //         "categories": [
    //           {
    //             "categoryName": "String",
    //             "items": [
    //               {
    //                 "nativeName": "'String'",
    //                 "description": "String",
    //                 "price": "String",
    //                 "dietaryFlags": "safe | warning | critical_avoid",
    //                 "isHighlight": false,
    //                 "conflictReason": "String (omit if safe)"
    //               }
    //             ]
    //           }
    //         ]
    //       }` : ''}${currentMode === 'Bill/Receipt' ? `,
    //       "receiptData": {
    //         "currencySymbol": "String",
    //         "subtotal": "String",
    //         "tax": "String",
    //         "serviceCharge": "String",
    //         "total": "String",
    //         "items": [
    //           {
    //             "originalName": "'String'",
    //             "price": "String"
    //           }
    //         ]
    //       }` : ''}${currentMode === 'Sign' ? `,
    //       "signData": {
    //         "originalText": "'String'",
    //         "instruction": "String"
    //       }` : ''}
    //     }
    //   `;

    //   console.log("Prompt: ", prompt);

    //   let contentResult: any;
    //   try {
    //     contentResult = await model.generateContent([prompt, { inlineData: { data: base64Image, mimeType: "image/jpeg" } }]);
    //   } catch (e) {
    //     console.warn("Fallback to gemini-2.5-flash-lite:", e);

    //     try {
    //       model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite", generationConfig });
    //       contentResult = await model.generateContent([prompt, { inlineData: { data: base64Image, mimeType: "image/jpeg" } }]);
    //     } catch (e) {
    //       console.warn("Both models failed :( ", e);
    //       throw new Error("AI analysis failed after multiple attempts.");
    //     }
    //   }
    //   try {
    //     const responseText = contentResult.response.text().trim();

    //     const firstBrace = responseText.indexOf('{');
    //     const lastBrace = responseText.lastIndexOf('}');

    //     if (firstBrace === -1 || lastBrace === -1) {
    //       throw new Error("No valid JSON structure found in AI response.");
    //     }

    //     const jsonString = responseText.slice(firstBrace, lastBrace + 1);
    //     const scanResult = JSON.parse(jsonString) as ScanResult;

    //     // Perform local ML Kit translation for the names
    //     const translationPromises: Promise<void>[] = [];

    //     const translateAndAssign = (obj: any, sourceKey: string, targetKey: string) => {
    //       if (!obj[sourceKey]) return;

    //       // The native string might be wrapped in single quotes per the AI prompt rules
    //       let cleanText = obj[sourceKey];
    //       if (cleanText.startsWith("'") && cleanText.endsWith("'")) {
    //         cleanText = cleanText.slice(1, -1);
    //       }

    //       const p = Translate.translate({
    //         text: cleanText,
    //         sourceLanguage: (profile.scanSourceLanguage || 'ja') as any,
    //         targetLanguage: (profile.scanTargetLanguage || 'en') as any,
    //         downloadModelIfNeeded: true,
    //       }).then((res) => {
    //         obj[targetKey] = res as unknown as string;
    //       }).catch((e) => {
    //         console.warn("Translation failed for", cleanText, e);
    //         obj[targetKey] = cleanText; // Fallback to native text if ML Kit fails
    //       });
    //       translationPromises.push(p);
    //     };

    //     if (scanResult.menuData?.categories) {
    //       scanResult.menuData.categories.forEach(cat => {
    //         cat.items.forEach(item => translateAndAssign(item, 'nativeName', 'translatedName'));
    //       });
    //     }

    //     if (scanResult.receiptData?.items) {
    //       scanResult.receiptData.items.forEach(item => translateAndAssign(item, 'originalName', 'translatedName'));
    //     }

    //     if (scanResult.signData) {
    //       translateAndAssign(scanResult.signData, 'originalText', 'translatedText');
    //     }

    //     // Await all local translation tasks in parallel
    //     await Promise.all(translationPromises);

    //     return scanResult;

    //   } catch (e) {
    //     console.error("JSON parsing error:", e);

    //     if (e instanceof SyntaxError && e.message.includes('Unexpected end of input')) {
    //       throw new Error("The menu was too large and the analysis timed out. Try scanning a smaller section of the menu.");
    //     }

    //     throw new Error("Analysis failed: Received malformed data from AI. Please try again.");
    //   }

    // } catch (error) {
    //   console.error("ML Kit processing error:", error);
    //   throw new Error("Analysis failed: Could not process text locally.");
    // }

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

    //   If Mode is 'Bill/Receipt':
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

  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatTyping) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatTyping(true);

    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing API Key");

      const genAI = new GoogleGenerativeAI(apiKey);
      let model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

      // Format the existing conversation history for the Gemini SDK
      const history = chatMessages.map((msg, index) => {
        const parts: any[] = [{ text: msg.text }];
        // ✅ Inject the image into the first user message of the history
        if (index === 0 && msg.role === 'user' && currentScanImage) {
          parts.push({
            inlineData: { data: currentScanImage, mimeType: "image/jpeg" }
          });
        }
        return { role: msg.role, parts };
      });

      // ✅ Update the prompt so Finn knows he can see the image
      const contextString = result
        ? `The user just scanned an image and the system extracted this JSON data: ${JSON.stringify(result)}. The user has also provided the raw image itself in the chat. Use BOTH the JSON data and your visual analysis of the image to answer their questions accurately.`
        : `The user has not scanned an image yet. Guide them briefly on how to use ${mode} mode, or cheerfully answer any general travel, culture, or language questions they have.`;

      const systemInstruction = {
        parts: [{
          text: `You are Finn, the friendly ThinkTrip Dolphin Mascot, a clinical, highly intelligent travel AI. 
            The user is currently in ${mode} mode.
            ${contextString}
            Be concise, helpful, and maintain a calm, premium tone.`
        }],
        role: "model"
      };

      let chat = model.startChat({ history, systemInstruction });
      let chatResult;

      try {
        // ✅ If this is the VERY FIRST message of the chat, send the text AND the image
        if (chatMessages.length === 0 && currentScanImage) {
          chatResult = await chat.sendMessage([
            userMsg,
            { inlineData: { data: currentScanImage, mimeType: "image/jpeg" } }
          ]);
        } else {
          chatResult = await chat.sendMessage(userMsg);
        }
      } catch (error) {
        console.warn("Fallback to gemini-2.5-flash-lite for chat:", error);
        try {
          model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
          chat = model.startChat({ history, systemInstruction });

          // ✅ Repeat the injection logic for the fallback model
          if (chatMessages.length === 0 && currentScanImage) {
            chatResult = await chat.sendMessage([
              userMsg,
              { inlineData: { data: currentScanImage, mimeType: "image/jpeg" } }
            ]);
          } else {
            chatResult = await chat.sendMessage(userMsg);
          }
        } catch (fallbackError) {
          console.warn("Both models failed for chat:", fallbackError);
          throw fallbackError;
        }
      }

      setChatMessages(prev => [...prev, { role: 'model', text: chatResult.response.text() }]);
    } catch (error) {
      console.error("Chat Error:", error);
      setChatMessages(prev => [...prev, { role: 'model', text: "I'm having trouble connecting to the intelligence engine right now." }]);
    } finally {
      setIsChatTyping(false);
    }
  };

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
        imagePromise = Promise.resolve({ uri: pendingUploadPhoto.uri, base64: pendingUploadPhoto.base64 });
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
        // ✅ Save the image to state so the chatbot can see it
        setCurrentScanImage(croppedImage.base64);

        const analysis = await analyzeImage(croppedImage.base64, croppedImage.uri, mode, currentLocation);

        if (analysis.title === 'Unable to Analyze') {
          Alert.alert(
            "Couldn't read image",
            `Make sure the image is clear and relevant to ${mode} mode.`,
            [{ text: "Try again" }]
          );

          setIsCaptured(false);
          if (!pendingUploadPhoto && cameraRef.current) cameraRef.current.resumePreview();
          setAnalyzing(false);
          return;
        }

        if (!currentLocation && profile.locationRoutingEnabled) {
          analysis.badges.unshift({
            type: 'warn',
            text: 'Routing disabled • Weak GPS'
          });

        }

        setResult(analysis);
        setAiFinished(true); // Signal to OceanLoader that the analysis has completed
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      rate: 0.65,
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
        <TouchableOpacity
          style={[styles.enableBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            if (permission.canAskAgain) {
              requestPermission();
            } else {
              Linking.openSettings();
            }
          }}
        >
          <Text style={[styles.enableBtnText, { color: colors.primaryForeground }]}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderListHeader = () => (
    <View style={{ paddingBottom: 0 }}>
      <Text style={[styles.sheetEyebrow, { color: colors.mutedForeground }]}>{mode.toUpperCase()} INTELLIGENCE</Text>
      <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{result?.title}</Text>

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
    </View>
  );

  const renderListFooter = () => (
    <View style={{ paddingTop: 12 }}>
      <View style={styles.notesColumn}>
        {result?.notes?.map((n, i) => {
          return (
            <View key={i} style={[styles.noteCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[styles.noteTitle, { color: colors.primary }]}>{n.title}</Text>
              <View style={{ marginTop: 8 }}>
                {renderFormattedText(n?.body || "Analysis details unavailable.", colors.foreground, profile.scanSourceLanguage)}
              </View>
            </View>
          );
        })}
      </View>

      <TouchableOpacity style={[styles.gotItBtn, { backgroundColor: colors.primary }]} onPress={closeSheet}>
        <Text style={[styles.gotItText, { color: colors.primaryForeground }]}>Got it</Text>
      </TouchableOpacity>
    </View>
  );

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
      {showModeInfo && (
        <TouchableOpacity
          style={[StyleSheet.absoluteFillObject, { zIndex: 9 }]}
          activeOpacity={1}
          onPress={() => {
            if (showModeInfo) setShowModeInfo(false);
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


      {/* Dolphin Loader Screen */}
      {/* {analyzing && (
        <View style={[StyleSheet.absoluteFillObject, styles.analyzingOverlay]}>
          <DolphinLoaderScreen
            isFinished={aiFinished}
            onFinishComplete={handleFinishComplete}
          />
        </View>
      )} */}

      {/* Ocean Loader Screen */}
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
        {/* Hide the pill when expanded to keep the UI clean */}
        {true && (
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
            {(['Menu', 'Bill/Receipt', 'Sign'] as Mode[]).map((m) => {
              const isActive = m === mode;
              let icon: any = 'book-open';
              if (m === 'Bill/Receipt') icon = 'credit-card';
              else if (m === 'Sign') icon = 'type';

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
          <View style={[styles.welcomeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>

            <ScrollView
              ref={welcomeScrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 80 }} // Room for the floating button
              onLayout={(e) => setWelcomeScrollHeight(e.nativeEvent.layout.height)}
              onContentSizeChange={(w, h) => setWelcomeContentHeight(h)}
              onScroll={handleWelcomeScroll}
              scrollEventThrottle={16}
            >

              {/* Mascot hero band */}
              <View style={[styles.welcomeHero, { backgroundColor: colors.muted }]}>
                <View style={styles.welcomeHeroOrb} />
                <View style={styles.welcomeHeroOrb2} />
                <DolphinMascot size={150} />
              </View>

              {/* Greeting */}
              <View style={styles.welcomeGreetRow}>
                <View style={[styles.welcomeGreetDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.welcomeGreetText, { color: colors.mutedForeground }]}>YOUR TRAVEL COMPANION</Text>
              </View>

              <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
                Hi, let's read this together.
              </Text>
              <Text style={[styles.welcomeBody, { color: colors.mutedForeground }]}>
                Point your camera at anything confusing abroad. I'll translate, decode and explain it in seconds.
              </Text>

              <View style={styles.welcomeModesList}>
                {(['Menu', 'Bill/Receipt', 'Sign'] as Mode[]).map((m) => {
                  let icon: any = 'book-open';
                  if (m === 'Bill/Receipt') icon = 'credit-card';
                  else if (m === 'Sign') icon = 'type';

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

              {/* Quick Tips Section for Feature Discovery */}
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
            </ScrollView>

            {/* Fixed Bottom Right Action Button */}
            <TouchableOpacity
              style={[
                styles.welcomeBtnFixed,
                { backgroundColor: (!isWelcomeScrollable || isAtBottom) ? colors.primary : colors.muted }
              ]}
              onPress={() => {
                if (!isWelcomeScrollable || isAtBottom) {
                  dismissWelcomeGuide();
                } else {
                  welcomeScrollRef.current?.scrollToEnd({ animated: true });
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={[
                styles.welcomeBtnText,
                { color: (!isWelcomeScrollable || isAtBottom) ? colors.primaryForeground : colors.foreground }
              ]}>
                {(!isWelcomeScrollable || isAtBottom) ? "Let's go" : "Scroll down"}
              </Text>
              <Feather
                name={(!isWelcomeScrollable || isAtBottom) ? "arrow-right" : "arrow-down"}
                size={18}
                color={(!isWelcomeScrollable || isAtBottom) ? colors.primaryForeground : colors.foreground}
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      {/* ─── COMBINED OVERLAYS (Fixes iOS Multiple-Modal Touch Freeze) ─── */}
      <Modal
        visible={showResultSheet || isChatOpen}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => {
          if (isChatOpen) closeChat();
          else if (showResultSheet) closeSheet();
        }}
      >
        {/* 1. Result Sheet Backdrop & Content */}
        {showResultSheet && (
          <Animated.View style={[styles.modalBackdrop, { opacity: fadeAnim }]}>
            <TouchableOpacity style={styles.modalDismissArea} activeOpacity={1} onPress={closeSheet} />
            <Animated.View style={[styles.sheet, { backgroundColor: colors.card, maxHeight: Dimensions.get('window').height * 0.82, transform: [{ translateY: slideAnim }] }]}>
              <View style={styles.handle} />
              {mode === 'Menu' && result?.menuData ? (
                <SectionList
                  stickySectionHeadersEnabled={false}
                  sections={result.menuData.categories.map(c => {
                    const isExpanded = expandedCategories.has(c.categoryName);
                    const data = (c.items.length > 3 && !isExpanded) ? c.items.slice(0, 3) : c.items;
                    return { title: c.categoryName, data, totalItems: c.items.length };
                  })}
                  keyExtractor={(item, index) => item.nativeName + index}
                  renderItem={({ item }) => (
                    <MenuItemRow item={item as any} colors={colors} languageCode={profile.scanSourceLanguage} />
                  )}
                  renderSectionHeader={({ section: { title } }) => (
                    <MenuCategoryHeader categoryName={title} colors={colors} />
                  )}
                  renderSectionFooter={({ section }) => {
                    if (section.totalItems <= 3) return null;
                    const isExpanded = expandedCategories.has(section.title);
                    return (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => toggleCategoryExpand(section.title)}
                        style={{ paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                      >
                        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.primary }}>
                          {isExpanded ? "Show less" : `Show more`}
                        </Text>
                        <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={colors.primary} />
                      </TouchableOpacity>
                    );
                  }}
                  ListHeaderComponent={renderListHeader}
                  ListFooterComponent={renderListFooter}
                  contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 24 }}
                  initialNumToRender={10}
                  windowSize={5}
                  maxToRenderPerBatch={5}
                  showsVerticalScrollIndicator
                  bounces
                />
              ) : (
                <ScrollView showsVerticalScrollIndicator bounces contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 24 }}>
                  {renderListHeader()}
                  {mode === 'Bill/Receipt' && result?.receiptData && (
                    <ReceiptRenderer receipt={result.receiptData} colors={colors} languageCode={profile.scanSourceLanguage} />
                  )}
                  {mode === 'Sign' && result?.signData && (
                    <SignRenderer sign={result.signData} colors={colors} languageCode={profile.scanSourceLanguage} />
                  )}
                  {renderListFooter()}
                </ScrollView>
              )}
            </Animated.View>
          </Animated.View>
        )}

        {/* 2. Floating Mascot (Inside Modal) */}
        {/* Rendered inside to stay above the Result Sheet. Fades out smoothly when chat opens. */}
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            pan.getLayout(),
            styles.floatingMascotContainer,
          ]}
          pointerEvents={isChatOpen ? 'none' : 'auto'}
        >
          <Animated.View style={{ opacity: chatAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
            <TouchableOpacity activeOpacity={0.8} onPress={openChat} style={styles.mascotButton}>
              <DolphinMascot size={44} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* 3. Chat UI Overlay */}
        {isChatOpen && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} pointerEvents="box-none">
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: chatAnim }]}>
              <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeChat} />
            </Animated.View>

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.chatModalContainer}
              pointerEvents="box-none"
            >
              <Animated.View
                style={[
                  styles.chatSheet,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: chatAnim,
                    transform: [
                      { translateX: chatAnim.interpolate({ inputRange: [0, 1], outputRange: [chatOrigin.x, 0] }) },
                      { translateY: chatAnim.interpolate({ inputRange: [0, 1], outputRange: [chatOrigin.y, 0] }) },
                      { scale: chatAnim.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1] }) }
                    ]
                  }
                ]}
              >
                <View style={styles.chatHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.chatHeaderAvatar}>
                      <DolphinMascot size={24} />
                    </View>
                    <Text style={[styles.chatHeaderTitle, { color: colors.foreground }]}>Finn</Text>
                  </View>
                  <TouchableOpacity onPress={closeChat} style={styles.chatCloseBtn}>
                    <Feather name="x" size={20} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>

                <FlatList
                  ref={chatListRef}
                  data={chatMessages}
                  keyExtractor={(item, index) => index.toString()}
                  contentContainerStyle={{ padding: 20, gap: 16 }}
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
                  onLayout={() => chatListRef.current?.scrollToEnd({ animated: true })}
                  renderItem={({ item }) => {
                    const isUser = item.role === 'user';
                    const textColor = isUser ? '#fff' : (colors.foreground as string);

                    return (
                      <View style={[
                        styles.chatBubble,
                        isUser ? styles.chatBubbleUser : [styles.chatBubbleModel, { backgroundColor: colors.muted }]
                      ]}>
                        <Markdown style={getMarkdownStyles(textColor, colors)}>
                          {item.text}
                        </Markdown>
                      </View>
                    );
                  }}
                  ListFooterComponent={
                    isChatTyping ? (
                      <View style={[
                        styles.chatBubble,
                        styles.chatBubbleModel,
                        {
                          backgroundColor: colors.muted,
                          paddingHorizontal: 18,
                          paddingVertical: 12,
                          alignSelf: 'flex-start',
                          marginTop: chatMessages.length > 0 ? 0 : 16
                        }
                      ]}>
                        <TypingIndicator color={colors.foreground} />
                      </View>
                    ) : null
                  }
                />

                <View style={[styles.chatInputRow, { borderTopColor: colors.border }]}>
                  <TextInput
                    ref={chatInputRef}
                    style={[styles.chatInput, { color: colors.foreground, backgroundColor: colors.muted }]}
                    placeholder={`Ask about this ${mode.toLowerCase()}, or anything...`}
                    placeholderTextColor={colors.mutedForeground}
                    value={chatInput}
                    onChangeText={setChatInput}
                    onSubmitEditing={handleSendChat}
                    returnKeyType="send"
                  />
                  <TouchableOpacity
                    style={[
                      styles.chatSendBtn,
                      { backgroundColor: chatInput.trim() ? colors.primary : colors.muted }
                    ]}
                    onPress={handleSendChat}
                    disabled={isChatTyping || !chatInput.trim()}
                  >
                    {isChatTyping ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Feather name="arrow-up" size={20} color={chatInput.trim() ? '#fff' : colors.mutedForeground} />
                    )}
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </KeyboardAvoidingView>
          </View>
        )}
      </Modal>

      {/* ─── FLOATING MASCOT (BASE CAMERA VIEW) ─── */}
      {(!showResultSheet && !isChatOpen) && (
        <Animated.View
          {...panResponder.panHandlers}
          style={[pan.getLayout(), styles.floatingMascotContainer]}
        >
          <TouchableOpacity activeOpacity={0.8} onPress={openChat} style={styles.mascotButton}>
            <DolphinMascot size={44} />
          </TouchableOpacity>
        </Animated.View>
      )}
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
  categoryHeader: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    letterSpacing: -0.3,
    marginBottom: 12,
    marginTop: 24,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 0 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, gap: 6 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  notesColumn: { gap: 12, marginBottom: 16 },
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
    height: '85%',
    maxHeight: 700,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden'
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
  // Add this new style for the absolute pinned button
  welcomeBtnFixed: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999, // Pill shape
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6
  },
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

  // ─── FLOATING MASCOT STYLES ───
  floatingMascotContainer: {
    position: 'absolute',
    zIndex: 99,
  },
  mascotButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  mascotNotificationDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#5c7ce5', // colors.primary
    borderWidth: 2,
    borderColor: '#000',
  },

  // ─── CHAT MODAL STYLES ───
  chatModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  chatModalDismissArea: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  chatSheet: {
    height: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  chatHeaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(92, 124, 229, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  chatCloseBtn: {
    padding: 8,
  },
  chatBubble: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#5c7ce5',
    borderBottomRightRadius: 4,
  },
  chatBubbleModel: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  chatText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    lineHeight: 22,
  },
  chatEmptyText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
    opacity: 0.7,
  },
  chatInputRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    gap: 12,
  },
  chatInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
  },
  chatSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
