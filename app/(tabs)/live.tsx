import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Platform, ScrollView, Modal, Animated } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import Translate from '@react-native-ml-kit/translate-text'; // --- ML KIT IMPORT (Commented out for testing Gemini translation) ---

import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '../../hooks/useColors';
import { useProfile } from '../../contexts/ProfileContext';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Types and Language Config
type Message = {
  id: string;
  speaker: 'me' | 'local';
  originalText: string;
  translatedText: string;
  romaji?: string;
  timestamp: string;
  isAnalyzing: boolean;
  confidence?: string;
  suggestedResponse?: string;
};

type Language = { code: string; bcp47: string; name: string; emoji: string; };

const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', bcp47: 'en-US', name: 'English', emoji: '🇺🇸' },
  { code: 'de', bcp47: 'de-DE', name: 'German', emoji: '🇩🇪' },
  { code: 'ja', bcp47: 'ja-JP', name: 'Japanese', emoji: '🇯🇵' },
  { code: 'ko', bcp47: 'ko-KR', name: 'Korean', emoji: '🇰🇷' },
  { code: 'fr', bcp47: 'fr-FR', name: 'French', emoji: '🇫🇷' },
  { code: 'es', bcp47: 'es-ES', name: 'Spanish', emoji: '🇪🇸' },
  { code: 'vi', bcp47: 'vi-VN', name: 'Vietnamese', emoji: '🇻🇳' },
  { code: 'zh', bcp47: 'zh-CN', name: 'Chinese', emoji: '🇨🇳' },
  { code: 'ru', bcp47: 'ru-RU', name: 'Russian', emoji: '🇷🇺' },
  { code: 'it', bcp47: 'it-IT', name: 'Italian', emoji: '🇮🇹' },
  { code: 'pt', bcp47: 'pt-PT', name: 'Portuguese', emoji: '🇵🇹' },
];

export default function LiveInteractionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, save } = useProfile();
  const flatListRef = useRef<FlatList>(null);

  // Dynamic Language State
  const [myLang, setMyLang] = useState<Language>(() =>
    SUPPORTED_LANGUAGES.find(l => l.code === profile.scanTargetLanguage) || SUPPORTED_LANGUAGES[0]
  );
  const [localLang, setLocalLang] = useState<Language>(() =>
    SUPPORTED_LANGUAGES.find(l => l.code === profile.scanSourceLanguage) || SUPPORTED_LANGUAGES[1]
  );

  // Sync state if user changes languages in Profile tab
  useEffect(() => {
    if (profile.scanTargetLanguage) {
      const match = SUPPORTED_LANGUAGES.find(l => l.code === profile.scanTargetLanguage);
      if (match) setMyLang(match);
    }
    if (profile.scanSourceLanguage) {
      const match = SUPPORTED_LANGUAGES.find(l => l.code === profile.scanSourceLanguage);
      if (match) setLocalLang(match);
    }
  }, [profile.scanTargetLanguage, profile.scanSourceLanguage]);

  // Modal State
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);
  const [selectingFor, setSelectingFor] = useState<'me' | 'local'>('local');

  // --- MOCK DATA FOR TESTING UI ---

  // const [messages, setMessages] = useState<Message[]>([
  //   {
  //     id: '1',
  //     speaker: 'me',
  //     originalText: 'Hello, where is the train station?',
  //     translatedText: 'Hallo, wo ist der Bahnhof?',
  //     timestamp: '10:00 AM',
  //     isAnalyzing: false,
  //   },
  //   {
  //     id: '2',
  //     speaker: 'local',
  //     originalText: 'Es ist gleich um die Ecke, auf der linken Seite.',
  //     translatedText: 'It is just around the corner, on the left side.',
  //     timestamp: '10:01 AM',
  //     isAnalyzing: false,
  //   }
  // ]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<'me' | 'local' | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');

  // Animation Refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(800)).current;

  // Concurrency Tracking
  const activeInteractionId = useRef<string | null>(null);

  // AI Suggestion Tray State
  const [dynamicSuggestions, setDynamicSuggestions] = useState<any[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  // Trigger contextual suggestions whenever the conversation updates
  useEffect(() => {
    if (messages.length === 0 || isRecording) {
      if (messages.length === 0) setDynamicSuggestions([]);
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.speaker !== 'local') {
      return; // Only suggest things for ME to say after the LOCAL person speaks
    }

    const timerId = setTimeout(() => {
      const generateContextualSuggestions = async () => {
        setIsGeneratingSuggestions(true);
        try {
          const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
          if (!apiKey) throw new Error("Missing API Key");

          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: "gemini-3.1-flash-lite",
            generationConfig: { responseMimeType: "application/json" }
          });

          const recentMessages = messages.slice(-5);
          const historyText = recentMessages.map(m =>
            `${m.speaker === 'me' ? myLang.name : localLang.name}: ${m.originalText}`
          ).join('\n');

          const prompt = `
            Analyze this conversation transcript between a user speaking ${myLang.name} and a local speaking ${localLang.name}:
            ${historyText}

            Predict 3 highly practical, short follow-up phrases the user (${myLang.name}) might want to say next to continue or conclude the interaction.
            Format strictly as a JSON array of objects:
            [
              {
                "icon": "Valid Feather icon name representing the phrase (e.g., 'credit-card', 'map-pin', 'coffee', 'message-square', 'help-circle')",
                "myPhrase": "The phrase in ${myLang.name}",
                "localPhrase": "The exact translated phrase in ${localLang.name}"
              }
            ]
          `;

          const result = await model.generateContent(prompt);
          const responseText = result.response.text().trim();

          let jsonString = responseText.trim();
          jsonString = jsonString
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

          const data = JSON.parse(jsonString);

          setDynamicSuggestions(data);
        } catch (error) {
          console.error("Contextual Suggestions Error:", error);
        } finally {
          setIsGeneratingSuggestions(false);
        }
      };

      generateContextualSuggestions();
    }, 4000);

    return () => clearTimeout(timerId);
  }, [messages.length, myLang.name, localLang.name, isRecording]);


  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript || '';
    if (!event.isFinal) {
      if (transcript) setLiveTranscript(transcript);
    } else {
      if (activeSpeaker && transcript) {
        processConversation(transcript, activeSpeaker);
      }
      resetRecordingState();
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'no-speech' || event.error === 'aborted') {
      console.log('Speech recognition stopped:', event.error, event.message);
    } else {
      console.error('Speech recognition error:', event.error, event.message);
    }
    resetRecordingState();
  });

  const resetRecordingState = () => {
    setIsRecording(false);
    setActiveSpeaker(null);
    setLiveTranscript('');
  };

  const startRecording = async (speaker: 'me' | 'local') => {
    // Add this guard
    if (isRecording) {
      ExpoSpeechRecognitionModule.abort();
    }

    if (profile.hapticsEnabled && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) Speech.stop();

    setActiveSpeaker(speaker);
    setLiveTranscript('');
    setIsRecording(true);

    try {
      const langCode = speaker === 'me' ? myLang.bcp47 : localLang.bcp47;

      const permissions = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (permissions.status !== 'granted') {
        console.warn('Speech recognition permissions not granted');
        resetRecordingState();
        return;
      }

      ExpoSpeechRecognitionModule.start({
        lang: langCode,
        interimResults: true,
        // Continuous mode is optional, but stopping it properly will trigger the 'result' with isFinal=true
        continuous: false
      });
    } catch (e) {
      console.error("Voice start failed:", e);
      resetRecordingState();
    }
  };

  const toggleRecording = (speaker: 'me' | 'local') => {
    if (isRecording) {
      // Capture state before resetting
      const currentSpeaker = activeSpeaker;
      const textToProcess = liveTranscript.trim();

      // Force abort to prevent the library from sending a duplicate final result
      try { ExpoSpeechRecognitionModule.abort(); } catch (e) { console.error(e); }
      resetRecordingState();

      // Process whatever was heard so far
      if (textToProcess && currentSpeaker) {
        processConversation(textToProcess, currentSpeaker);
      }

      // If they tapped the other button, start listening for the other person
      if (currentSpeaker !== speaker) {
        setTimeout(() => startRecording(speaker), 300);
      }
    } else {
      startRecording(speaker);
    }
  };

  const getTimestamp = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const processConversation = async (text: string, speaker: 'me' | 'local') => {
    const messageId = Date.now().toString();
    activeInteractionId.current = messageId; // Track this as the latest interaction
    let translated = "Translation failed.";

    const sourceLang = speaker === 'me' ? myLang.code : localLang.code;
    const targetLang = speaker === 'me' ? localLang.code : myLang.code;

    // Names are better for Gemini prompting than just codes
    const sourceLangName = speaker === 'me' ? myLang.name : localLang.name;
    const targetLangName = speaker === 'me' ? localLang.name : myLang.name;

    try {
      if (sourceLang === targetLang) {
        translated = text;
      } else {
        // ==============================================================
        // --- GEMINI AI TRANSLATION ---
        // ==============================================================
        // const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
        // if (!apiKey) throw new Error("Missing API Key");

        // const genAI = new GoogleGenerativeAI(apiKey);
        // const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

        // const prompt = `Translate the following text from ${sourceLangName} to ${targetLangName}. Return ONLY the pure translated text, nothing else.\n\nText: "${text}"`;

        // const result = await model.generateContent(prompt);
        // translated = result.response.text().trim().replace(/^["']|["']$/g, '');

        // ==============================================================
        // --- ML KIT APPROACH (Commented out) ---
        // ==============================================================

        translated = (await Translate.translate({
          text,
          sourceLanguage: sourceLang as any,
          targetLanguage: targetLang as any,
          downloadModelIfNeeded: true,
        })) as unknown as string;

      }
    } catch (e) {
      console.error("Translation Error:", e);
    }

    const newMessage: Message = {
      id: messageId,
      speaker,
      originalText: text,
      translatedText: translated,
      timestamp: getTimestamp(),
      isAnalyzing: true,
    };

    // If a newer interaction started while processing, drop this UI update
    if (activeInteractionId.current !== messageId) return;

    setMessages(prev => [...prev, newMessage]);

    const speechLang = speaker === 'me' ? localLang.bcp47 : myLang.bcp47;
    Speech.speak(translated, { language: speechLang, rate: 0.85 });

    fetchGeminiInsights(newMessage, sourceLangName, targetLangName);
  };

  const fetchGeminiInsights = async (msg: Message, source: string, target: string) => {
    // --- AI Insights Commented Out For Testing ---
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isAnalyzing: false } : m));
    /*
    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing API Key");

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `
        Analyze this translated phrase from ${source} to ${target}: "${msg.translatedText}" (Original: "${msg.originalText}").
        Provide a confidence score on the translation accuracy (High, Medium, Low) and provide ONE short, practical suggested response in the original language (with phonetic english) if applicable. 
        Format strictly as JSON:
        {
          "confidence": "High" | "Medium" | "Low",
          "suggestedResponse": "String or empty"
        }
      `;

      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text());

      setMessages(prev => prev.map(m =>
        m.id === msg.id
          ? { ...m, confidence: data.confidence, suggestedResponse: data.suggestedResponse, isAnalyzing: false }
          : m
      ));
    } catch (error) {
      console.error("Gemini Error:", error);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isAnalyzing: false, confidence: 'Low' } : m));
    }
    */
  };

  const playAudio = (text: string, lang: string) => {
    Speech.stop();
    Speech.speak(text, { language: lang, rate: 0.85 });
  };

  const handleSuggestionTap = (item: any) => {
    if (profile.hapticsEnabled && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // 1. Play the audio immediately for the local listener
    playAudio(item.localPhrase, localLang.bcp47);

    // 2. Construct the message using the AI's pre-translated text
    const messageId = Date.now().toString();
    activeInteractionId.current = messageId; // Track this as the latest interaction

    const newMessage: Message = {
      id: messageId,
      speaker: 'me',
      originalText: item.myPhrase,
      translatedText: item.localPhrase,
      timestamp: getTimestamp(),
      isAnalyzing: true,
    };

    // 3. Inject it into the chat stream
    setMessages(prev => [...prev, newMessage]);

    // 4. Fetch the confidence/insights for this new message
    fetchGeminiInsights(newMessage, myLang.name, localLang.name);

    // Note: The useEffect listening to `messages.length` will automatically 
    // trigger now and generate the NEXT batch of suggestions!
  };

  const swapLanguages = () => {
    if (profile.hapticsEnabled && Platform.OS !== 'web') Haptics.selectionAsync();
    const temp = myLang;
    setMyLang(localLang);
    setLocalLang(temp);

    save({
      scanTargetLanguage: localLang.code,
      scanSourceLanguage: myLang.code
    });
  };

  const openLangSelector = (side: 'me' | 'local') => {
    setSelectingFor(side);
    setIsLangModalOpen(true);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 24, stiffness: 200, useNativeDriver: true })
    ]).start();
  };

  const closeLangSelector = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 800, duration: 250, useNativeDriver: true })
    ]).start(() => {
      setIsLangModalOpen(false);
    });
  };

  const selectLanguage = (lang: Language) => {
    if (selectingFor === 'me') {
      setMyLang(lang);
      save({ scanTargetLanguage: lang.code });
    } else {
      setLocalLang(lang);
      save({ scanSourceLanguage: lang.code });
    }
    closeLangSelector();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Language Selection Modal (Premium Animated) */}
      <Modal visible={isLangModalOpen} transparent animationType="none" onRequestClose={closeLangSelector}>
        <Animated.View style={[styles.modalBackdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.modalDismissArea} activeOpacity={1} onPress={closeLangSelector} />

          <Animated.View style={[
            styles.modalSheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + 20,
              maxHeight: '80%',
              transform: [{ translateY: slideAnim }]
            }
          ]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Select {selectingFor === 'me' ? 'Your' : 'Local'} Language
            </Text>

            <ScrollView
              style={{ marginTop: 16 }}
              showsVerticalScrollIndicator={true}
              indicatorStyle={colors.isDark ? 'white' : 'black'}
            >
              {SUPPORTED_LANGUAGES.map(lang => {
                const isSelected = selectingFor === 'me' ? myLang.code === lang.code : localLang.code === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.langRow, { borderBottomColor: colors.border, backgroundColor: isSelected ? 'rgba(92, 124, 229, 0.1)' : 'transparent' }]}
                    onPress={() => selectLanguage(lang)}
                  >
                    <Text style={styles.langRowEmoji}>{lang.emoji}</Text>
                    <Text style={[styles.langRowName, { color: isSelected ? colors.primary : colors.foreground }]}>{lang.name}</Text>
                    {isSelected && <Feather name="check" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* 1. Language Swap Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={[styles.langPill, { backgroundColor: colors.card, borderColor: colors.border }]}>

          <TouchableOpacity style={[styles.langSide, { justifyContent: 'flex-start' }]} onPress={() => openLangSelector('me')}>
            <Text style={styles.langEmoji}>{myLang.emoji}</Text>
            <View>
              <Text style={[styles.langName, { color: colors.foreground }]}>{myLang.name}</Text>
              <Text style={[styles.langSub, { color: colors.mutedForeground }]}>You speak</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.swapBtn} onPress={swapLanguages}>
            <Feather name="repeat" size={18} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.langSide, { justifyContent: 'flex-end' }]} onPress={() => openLangSelector('local')}>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.langName, { color: colors.foreground }]}>{localLang.name}</Text>
              <Text style={[styles.langSub, { color: colors.mutedForeground }]}>Local language</Text>
            </View>
            <Text style={styles.langEmoji}>{localLang.emoji}</Text>
          </TouchableOpacity>

        </View>
      </View>

      {/* 2. Chat Bubbles Area */}
      <FlatList
        ref={flatListRef}
        style={{ flex: 1 }}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.chatContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMe = item.speaker === 'me';

          if (isMe) {
            return (
              <View style={styles.myMessageWrapper}>
                <View style={[styles.myBubble, { backgroundColor: colors.isDark ? '#312e81' : '#e0e7ff' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <Text style={[styles.myText, { color: colors.foreground, flexShrink: 1 }]}>{item.originalText}</Text>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => playAudio(item.originalText, myLang.bcp47)}>
                      <Feather name="volume-2" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  <Text style={[styles.translatedText, { color: colors.foreground }]}>{item.translatedText}</Text>

                  <View style={[styles.metaRowRight, { justifyContent: 'space-between', width: '100%', marginTop: 12 }]}>
                    <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>{item.timestamp}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => playAudio(item.translatedText, localLang.bcp47)}>
                        <Feather name="play" size={16} color={colors.primary} />
                      </TouchableOpacity>
                      <Feather name="check" size={14} color={colors.primary} />
                    </View>
                  </View>
                </View>
              </View>
            );
          }

          return (
            <View style={styles.localMessageWrapper}>
              <View style={styles.avatarCol}>
                <View style={[styles.avatarBox, { borderColor: '#10b981' }]}>
                  <Feather name="user" size={16} color="#10b981" />
                </View>
              </View>
              <View style={[styles.localBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.localHeaderRow}>
                  <Text style={[styles.nativeText, { color: colors.foreground }]}>{item.originalText}</Text>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => playAudio(item.originalText, localLang.bcp47)}>
                    <Feather name="volume-2" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                {item.romaji && <Text style={[styles.romajiText, { color: colors.mutedForeground }]}>{item.romaji}</Text>}

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <Text style={[styles.translatedText, { color: colors.foreground }]}>{item.translatedText}</Text>

                <View style={styles.localFooterRow}>
                  <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>{item.timestamp}</Text>
                  <View style={styles.actionBtns}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => playAudio(item.translatedText, myLang.bcp47)}>
                      <Feather name="play" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {item.isAnalyzing && (
                  <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                )}

                {/* {item.suggestedResponse && !item.isAnalyzing && (
                  <View style={[styles.suggestionBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[styles.suggestionLabel, { color: colors.primary }]}>AI SUGGESTION</Text>
                    <Text style={[styles.suggestionText, { color: colors.foreground }]}>{item.suggestedResponse}</Text>
                  </View>
                )} */}
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          isRecording ? (
            <View style={activeSpeaker === 'me' ? styles.myMessageWrapper : styles.localMessageWrapper}>
              {activeSpeaker === 'local' && (
                <View style={styles.avatarCol}>
                  <View style={[styles.avatarBox, { borderColor: '#10b981' }]}><Feather name="user" size={16} color="#10b981" /></View>
                </View>
              )}
              <View style={[activeSpeaker === 'me' ? styles.myBubble : styles.localBubble, { backgroundColor: colors.card, borderColor: colors.primary, opacity: 0.7 }]}>
                {activeSpeaker === 'me' ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <Text style={[styles.myText, { color: colors.foreground, flexShrink: 1 }]}>{liveTranscript || 'Listening...'}</Text>
                  </View>
                ) : (
                  <View style={styles.localHeaderRow}>
                    <Text style={[styles.nativeText, { color: colors.foreground }]}>{liveTranscript || 'Listening...'}</Text>
                  </View>
                )}
              </View>
            </View>
          ) : null
        }
      />

      {/* 3. Dynamic Contextual Suggestion Tray */}
      {dynamicSuggestions.length > 0 && (
        <View style={styles.suggestionTray}>
          <View style={styles.suggestionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="zap" size={14} color={colors.primary} />
              <Text style={[styles.suggestionTitle, { color: colors.foreground }]}>Suggested Responses</Text>
              {isGeneratingSuggestions && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
              )}
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
            {dynamicSuggestions.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.suggestionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handleSuggestionTap(item)}
              >
                <View style={[styles.suggestionIconBox, { backgroundColor: colors.muted }]}>
                  <Feather name={item.icon as any} size={16} color={colors.primary} />
                </View>
                <Text style={[styles.suggestionEn, { color: colors.foreground }]} numberOfLines={2}>{item.myPhrase}</Text>
                <Text style={[styles.suggestionJp, { color: colors.mutedForeground }]} numberOfLines={2}>{item.localPhrase}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 4. Action Area */}
      <View
        style={[
          styles.actionArea,
          {
            backgroundColor: colors.background,
            paddingBottom: Platform.OS === 'ios' ? insets.bottom + 84 : 16
          }
        ]}
      >
        <TouchableOpacity
          style={[styles.micBtn, { backgroundColor: isRecording && activeSpeaker === 'local' ? 'rgba(16, 185, 129, 0.1)' : colors.card, borderColor: isRecording && activeSpeaker === 'local' ? '#10b981' : colors.border }]}
          onPress={() => toggleRecording('local')}
          activeOpacity={0.8}
        >
          <Feather name="users" size={20} color={isRecording && activeSpeaker === 'local' ? '#10b981' : '#10b981'} />
          <View>
            <Text style={[styles.btnTitle, { color: '#10b981' }]}>TAP 'LOCAL'</Text>
            <Text style={[styles.btnSub, { color: colors.mutedForeground }]}>{localLang.name}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.micBtn, { backgroundColor: isRecording && activeSpeaker === 'me' ? 'rgba(92, 124, 229, 0.1)' : colors.card, borderColor: isRecording && activeSpeaker === 'me' ? colors.primary : colors.border }]}
          onPress={() => toggleRecording('me')}
          activeOpacity={0.8}
        >
          <Feather name="user" size={20} color={isRecording && activeSpeaker === 'me' ? colors.primary : colors.primary} />
          <View>
            <Text style={[styles.btnTitle, { color: colors.primary }]}>TAP 'ME'</Text>
            <Text style={[styles.btnSub, { color: colors.mutedForeground }]}>{myLang.name}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Modal Styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalDismissArea: { flex: 1 },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 14, maxHeight: '80%' },
  modalHandle: { width: 38, height: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, paddingHorizontal: 24 },
  langRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24, borderBottomWidth: 1 },
  langRowEmoji: { fontSize: 24, marginRight: 16 },
  langRowName: { fontFamily: 'Inter_600SemiBold', fontSize: 16, flex: 1 },

  // Header
  header: { paddingHorizontal: 16, paddingBottom: 16, alignItems: 'center' },
  langPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: 12, borderRadius: 20, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  langSide: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  langEmoji: { fontSize: 24 },
  langName: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  langSub: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  swapBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(92, 124, 229, 0.1)', alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 },

  // Chat Area
  chatContainer: { padding: 16, gap: 20 },
  myMessageWrapper: { alignItems: 'flex-end', marginBottom: 4 },
  myBubble: { maxWidth: '80%', padding: 14, borderRadius: 20, borderBottomRightRadius: 4 },
  myText: { fontFamily: 'Inter_700Bold', fontSize: 16, lineHeight: 24 },
  metaRowRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 6 },
  localMessageWrapper: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  avatarCol: { paddingTop: 4 },
  avatarBox: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  localBubble: { flex: 1, padding: 16, borderRadius: 20, borderTopLeftRadius: 4, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  localHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  nativeText: { fontFamily: 'Inter_700Bold', fontSize: 16, flex: 1, marginRight: 10, lineHeight: 24 },
  romajiText: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 4 },
  divider: { height: 1, width: '100%', marginVertical: 12, opacity: 0.5 },
  translatedText: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22 },
  localFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  actionBtns: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(92, 124, 229, 0.05)', alignItems: 'center', justifyContent: 'center' },
  timestamp: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  suggestionBox: { marginTop: 16, padding: 12, borderRadius: 12, borderWidth: 1 },
  suggestionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1, marginBottom: 4 },
  suggestionText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },

  // Suggestions
  suggestionTray: { paddingVertical: 12 },
  suggestionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  suggestionTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  suggestionCard: { width: 140, padding: 12, borderRadius: 16, borderWidth: 1 },
  suggestionIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  suggestionEn: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 4, lineHeight: 18 },
  suggestionJp: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },

  // Bottom Actions
  actionArea: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  micBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  btnTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  btnSub: { fontFamily: 'Inter_500Medium', fontSize: 12 },
});