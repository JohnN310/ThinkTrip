import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Platform, Alert, Dimensions, Animated, TextInput, Keyboard, LayoutAnimation, UIManager, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../hooks/useColors';
import { useProfile } from '../../contexts/ProfileContext';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as ImageManipulator from 'expo-image-manipulator';
import { BlurView } from 'expo-blur';
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
  badges: { type: 'warn' | 'good' | 'info'; text: string }[];
  notes: { title: string; body: string }[];
}

export default function ScanScreen() {

  const [permission, requestPermission] = useCameraPermissions();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const [mode, setMode] = useState<Mode>('Menu');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [captionIndex, setCaptionIndex] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isCaptured, setIsCaptured] = useState(false);

  const [showResultSheet, setShowResultSheet] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
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

      if (cameraRef.current) {
        cameraRef.current.resumePreview();
      }
    });
  };

  const openMap = async (query: string) => {
    const encodedQuery = encodeURIComponent(query);
    const url = Platform.select({
      ios: `maps://?q=${encodedQuery}`,
      android: `google.navigation:q=${encodedQuery}`
    });

    try {
      const supported = await Linking.canOpenURL(url!);
      if (supported) {
        await Linking.openURL(url!);
      } else {
        Alert.alert("Map Unavailable", "Could not open the map application.");
      }
    } catch (error) {
      console.error("Linking error:", error);
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

  const analyzeImage = async (base64Image: string, currentMode: Mode): Promise<ScanResult> => {
    // ── MOCK MODE (comment this block out and uncomment the block below to go live) ──
    // await new Promise(res => setTimeout(res, 5000)); // simulate network delay
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

      **USER INQUIRY (OPTIONAL):**
      ${searchQuery.trim() !== ''
        ? `The user asked a specific question: "${searchQuery}". You MUST provide a direct answer to this question in the 'userAnswer' field of the JSON. Break your answer into short paragraphs or use bullet points ("- ") for maximum readability. Do NOT ask the user for additional information or further guidance in the response.`
        : `No specific question was asked. Omit the 'userAnswer' field entirely.`}

      **CRITICAL RULES:**
      1. **IMAGE FIRST:** Extract text, context, and environment details exclusively from the image.
      2. **TONE & FORMATTING:** Calm, premium, clinical, objective. STRICTLY NO EMOJIS, NO UNICODE ICONS, no playful language. STRICTLY NO MARKDOWN FORMATTING (do not use **asterisks** or underscores for bolding or italics). Output pure, unformatted text only. Do not output any symbols like 🔠 or 🪂. Break your answer into short paragraphs or use bullet points ("- ") for maximum readability.
      3. **BIOMETRIC AWARENESS:** Cross-reference image contents with the User's Baseline. Always flag items that violate their dietary or health restrictions.
      4. **CULTURAL CONFIDENCE:** Provide intuitive, English-approximated phonetic pronunciations (in parentheses). DO NOT provide literal, word-by-word English translations of foreign dish names. Instead, provide a clear culinary description.
      5. **NO DUPLICATION:** The 'userAnswer' field must strictly and exclusively address the user's specific question. Do not summarize or repeat your recommended options, strict avoids, or behavioral norms in the 'userAnswer'. Keep the structured data strictly isolated within the 'notes' array.
      6. **GEOGRAPHIC SPECIFICITY & DEEP ROUTING:** If the user's inquiry or the image context specifies a highly granular sub-location (e.g., "Departures 3", "Gate B12", "Platform 4"), your 'mapLocationName' MUST be as specific as possible. To do this securely, you MUST combine the specific sub-location with the FULL, OFFICIAL parent POI name or building name (e.g., "Departures 3, Hartsfield-Jackson Airport" or "Platform 4, Gare du Nord"). Do NOT just return the generic parent airport or station name if a deeper, specific destination is known. However, STILL DO NOT generate map locations for generic local bus stops or ambiguous street signs (e.g., "M41").

      **MODE ADAPTATION:**
      If Mode is 'Menu':
        - Assume the image is a full menu with multiple items. 
        - Title: Summarize the menu type or restaurant name (e.g., "Izakaya Dinner Menu").
        - Analyze the menu collectively against the User's Baseline.
        - Badges: Flag high-level context (e.g., "warn" for "Heavy Dairy Use", "info" for "English Spoken", "good" for "Diet-Friendly Options").
        - Notes: Provide exactly three notes:
           1. "Recommended Options": 2-3 specific safe dishes matching the Baseline. Include the original name and a simple phonetic pronunciation so the user can order confidently. Use bullet points ("- ").
           2. "Strict Avoids": Hidden ingredients or specific dishes that violate their Baseline. Use bullet points ("- ").
           3. "Ordering & Interactions": Practical advice on how to order. If suggesting a phrase, provide ONE short, culturally accurate phrase (like requesting a modification) with a clear English-approximated phonetic spelling (e.g., "To request no cilantro, say 'Không ngò' (kohng ngo)"). Focus on behavior over complex language.

      If Mode is 'Payment':
        - Detect accepted payment methods from signage or context.
        - Badges: Flag "warn" for cash-only, "info" for IC cards, "good" for no-tipping.
        - Notes: Provide exactly three notes:
           1. "Behavioral Norms": Physical etiquette (e.g., "Place cash in the provided tray, never hand it directly to the cashier. Tipping is considered rude and will be returned.").
           2. "Cashier Interactions": What the staff is likely to ask and how to reply. Provide ONE short, practical phrase with an English-approximated phonetic spelling (e.g., "They will ask if you need a bag. Say 'Irimasen' (ee-ree-mah-sen) to decline.").
           3. "Receipts & Hidden Charges": Explain unwritten costs like seating charges ('otoshi'), mandatory water fees, or how to ask for a receipt. If no hidden charges exist, state that clearly so the user has peace of mind.

      If Mode is 'Transit':
        - Identify the line, direction, signage, and next steps.
        - Badges: "info" for IC card support, "warn" for peak rush hour, "good" for step-free access.
        - Notes: Provide exactly three notes:
           1. "Signage & Navigation": How to physically get to the right spot (e.g., "Follow the yellow painted lines on the floor for the Express train").
           2. "Behavioral Norms": Unspoken local rules (e.g., "Silence your phone. Do not eat or drink on this line. Stand strictly on the right side of the escalator.").
           3. "Ticketing & Assistance": Rules for validation (e.g., "Tap your IC card at both gates"). Include ONE short, practical phrase with an English-approximated phonetic spelling to confirm direction or ask for help (e.g., "To confirm this train goes to Shibuya, ask 'Shibuya yuki desu ka?' (shee-boo-yah yoo-kee dess kah)").

      **REQUIRED JSON STRUCTURE:**
      {
        "title": "Short Title (In English)",
        "userAnswer": "Formatted direct answer using \\n for paragraph breaks and '- ' for bullet points. Do NOT duplicate 'notes' content here (omit if no inquiry was made)",
        "mapLocationName": "The EXACT name of a major transit POI or specific terminal/gate combined with the FULL, OFFICIAL parent location name (e.g., 'Gate B12, Hartsfield-Jackson Atlanta International Airport'). MUST BE OMITTED if the image is a generic bus stop, street sign, or ambiguous local location.",        "badges": [
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

  // this crops to only within the frame
  const handleShutter = async () => {
    Keyboard.dismiss();
    // Block if already analyzing or captured
    if (analyzing || isCaptured || !cameraRef.current) return;

    if (Platform.OS !== 'web' && profile.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Freeze camera, trigger loading screen, AND trigger the blur overlay
    cameraRef.current.pausePreview();
    setIsCaptured(true);
    setAnalyzing(true);

    try {
      // 3. takePictureAsync runs in the background. It naturally creates a 
      // micro-freeze on the camera feed, enhancing the "captured" effect.
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });

      if (photo) {
        // Calculate crop dimensions matching your reticle styling
        // left: 10%, right: 10% -> Width is 80%
        // top: 16%, bottom: 32% -> Height is 52% (100 - 16 - 32)
        const cropX = photo.width * 0.10;
        const cropY = photo.height * 0.16;
        const cropWidth = photo.width * 0.80;
        const cropHeight = photo.height * 0.52;

        const croppedImage = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ crop: { originX: cropX, originY: cropY, width: cropWidth, height: cropHeight } }],
          { base64: true, compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        if (croppedImage.base64) {
          const analysis = await analyzeImage(croppedImage.base64, mode);
          setResult(analysis);
          openSheet();

          if (Platform.OS !== 'web' && profile.hapticsEnabled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          setSearchQuery('');
        }
      }
    } catch (error) {
      console.error("Analysis Error:", error);
      Alert.alert("Analysis Failed", "Could not analyze the image. Please try again.");

      // Reset if it fails so the user can try again
      setIsCaptured(false);
      if (cameraRef.current) cameraRef.current.resumePreview();

    } finally {
      setAnalyzing(false);
    }
  };

  // Helper to elegantly parse and render AI text with bullet points and spacing
  const renderFormattedText = (text: string, textColor: string) => {
    return text.split('\n').map((line, index) => {
      const trimmed = line.trim();

      // Preserve intentional paragraph breaks
      if (!trimmed) return <View key={`space-${index}`} style={{ height: 8 }} />;

      // Handle bullet points ("- item" or "* item")
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <View key={`bullet-${index}`} style={styles.bulletRow}>
            <Text style={[styles.bulletDot, { color: textColor }]}>•</Text>
            <Text style={[styles.noteBody, { color: textColor, flex: 1 }]}>
              {trimmed.substring(2).trim()}
            </Text>
          </View>
        );
      }

      // Handle numbered lists ("1. item")
      const numberMatch = trimmed.match(/^(\d+\.)\s(.*)/);
      if (numberMatch) {
        return (
          <View key={`num-${index}`} style={styles.bulletRow}>
            <Text style={[styles.bulletDot, { color: textColor, width: 18 }]}>{numberMatch[1]}</Text>
            <Text style={[styles.noteBody, { color: textColor, flex: 1 }]}>
              {numberMatch[2]}
            </Text>
          </View>
        );
      }

      // Regular paragraph text
      return (
        <Text key={`text-${index}`} style={[styles.noteBody, { color: textColor, marginBottom: 8 }]}>
          {trimmed}
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
        <TouchableOpacity style={[styles.enableBtn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
          <Text style={[styles.enableBtnText, { color: colors.primaryForeground }]}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />

      {/* ─── RETICLE FRAME (From Sketch) ─── */}
      {!isSearchExpanded && (
        <View style={styles.reticleContainer} pointerEvents="none">
          <View style={[styles.corner, styles.topLeft, { borderColor: colors.primary }]} />
          <View style={[styles.corner, styles.topRight, { borderColor: colors.primary }]} />
          <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.primary }]} />
          <View style={[styles.corner, styles.bottomRight, { borderColor: colors.primary }]} />
        </View>
      )}

      {/* ─── CAPTURE BLUR SURROUND ─── */}
      {isCaptured && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 8 }]} pointerEvents="none">
          {/* Top Panel */}
          <BlurView intensity={25} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '16%' }} />
          {/* Bottom Panel */}
          <BlurView intensity={25} tint="dark" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '32%' }} />
          {/* Left Panel */}
          <BlurView intensity={25} tint="dark" style={{ position: 'absolute', top: '16%', bottom: '32%', left: 0, width: '10%' }} />
          {/* Right Panel */}
          <BlurView intensity={25} tint="dark" style={{ position: 'absolute', top: '16%', bottom: '32%', right: 0, width: '10%' }} />
        </View>
      )}

      {analyzing && (
        <View style={[StyleSheet.absoluteFillObject, styles.analyzingOverlay]}>

          {/* Central Content */}
          <View style={{ alignItems: 'center', gap: 20 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.analyzingCaption}>
              {captionIndex < CAPTIONS.length ? CAPTIONS[captionIndex] : 'Almost there....'}
            </Text>
          </View>
        </View>
      )}

      {/* ─── TOP SEARCH BAR & PILL ─── */}
      <View style={[styles.topOverlay, { paddingTop: insets.top || 20 }]}>
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
              onChangeText={setSearchQuery}
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
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setIsSearchExpanded(false);
              }}
            />

            {/* Submit / Minimize Button — lives in the row so it never overlaps suggestions */}
            {isSearchExpanded && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={Keyboard.dismiss}
                style={styles.promptActionBtn}
              >
                <Feather name="arrow-up" size={18} color="#0a1f1e" />
              </TouchableOpacity>
            )}
          </View>

          {/* Bottom Area: Suggested Prompts */}
          {isSearchExpanded && (
            <View style={styles.suggestionsWrapper}>
              <Text style={styles.suggestionsTitle}>SUGGESTED</Text>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.suggestionsScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {PROMPT_SUGGESTIONS[mode].map((sug, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.suggestionChip}
                    onPress={() => setSearchQuery(sug)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggestionChipText}>{sug}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Hide the pill when expanded to keep the UI clean */}
        {!isSearchExpanded && (
          <View style={styles.topPill}>
            <View style={styles.liveDot} />
            <Text style={styles.topPillText}>LIVE • {mode.toUpperCase()}</Text>
          </View>
        )}
      </View>

      {/* Spacer to push bottom bar down */}
      {!analyzing && <View style={{ flex: 1 }} />}

      {/* ─── BOTTOM CONTROLS ─── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 70 }]}>
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
                  onPress={() => setMode(m)}
                  disabled={analyzing}
                >
                  <Feather name={icon} size={14} color={isActive ? colors.primaryForeground : '#fff'} />
                  <Text style={[styles.modeBtnText, { color: isActive ? colors.primaryForeground : '#fff' }]}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

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

        <Text style={styles.captionText}>
          {analyzing ? 'READING THE SCENE…' : 'SCAN ENVIRONMENT'}
        </Text>
      </View>


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
                    {renderFormattedText(result.userAnswer, colors.foreground)}
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
                {result?.badges.map((b, i) => {
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
                {result?.notes.map((n, i) => (
                  <View key={i} style={[styles.noteCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[styles.noteTitle, { color: colors.foreground }]}>{n.title}</Text>
                    {/* Render the beautifully formatted body */}
                    <View style={{ marginTop: 6 }}>
                      {renderFormattedText(n.body, colors.mutedForeground)}
                    </View>
                  </View>
                ))}
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
  searchBar: {
    flexDirection: 'column',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchBarExpanded: {
    backgroundColor: 'rgba(0,0,0,0.85)',
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
    alignSelf: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#5c7ce5',
    alignItems: 'center',
    justifyContent: 'center',
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

  analyzingOverlay: { backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', gap: 20, zIndex: 10 },
  analyzingCaption: { fontFamily: 'Inter_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.3 },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 20 },
  modeSelector: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, padding: 5, gap: 4, marginBottom: 20 },
  modeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, gap: 6 },
  modeBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  shutterRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
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
  noteTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 4 },
  noteBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 }, // Increased line-height slightly for readability

  // Added List Styles
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, paddingRight: 8 },
  bulletDot: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginRight: 8, lineHeight: 20, opacity: 0.7 },
  gotItBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  gotItText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },

  userAnswerBox: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 18, gap: 6 },
  userAnswerLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.2 },
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
});
