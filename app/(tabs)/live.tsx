import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import Voice, { SpeechResultsEvent } from '@react-native-voice/voice';
import Translate from '@react-native-ml-kit/translate-text';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '../../hooks/useColors';
import { useProfile } from '../../contexts/ProfileContext';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Types for our chat state
type Message = {
  id: string;
  speaker: 'me' | 'local';
  originalText: string;
  translatedText: string;
  confidence?: 'High' | 'Medium' | 'Low';
  suggestedResponse?: string;
  isAnalyzing: boolean;
};

export default function LiveInteractionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<'me' | 'local' | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  
  // Temporary hardcoded language models for testing
  const targetLanguage = 'ja'; 

  useEffect(() => {
    // 1. Live Streaming Hook
    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      if (e.value && e.value.length > 0) {
        setLiveTranscript(e.value[0]);
      }
    };

    // 2. End of Speech Hook
    Voice.onSpeechEnd = async () => {
      if (activeSpeaker && liveTranscript) {
        await processConversation(liveTranscript, activeSpeaker);
      }
      resetRecordingState();
    };

    Voice.onSpeechError = (e) => {
      console.error(e);
      resetRecordingState();
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, [activeSpeaker, liveTranscript]);

  const resetRecordingState = () => {
    setIsRecording(false);
    setActiveSpeaker(null);
    setLiveTranscript('');
  };

  const startRecording = async (speaker: 'me' | 'local') => {
    if (profile.hapticsEnabled && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // Stop any ongoing audio playback
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) Speech.stop();

    setActiveSpeaker(speaker);
    setLiveTranscript('');
    setIsRecording(true);
    
    try {
      const langCode = speaker === 'me' ? 'en-US' : 'ja-JP';
      await Voice.start(langCode);
    } catch (e) {
      console.error("Voice start failed:", e);
      resetRecordingState();
    }
  };

  const stopRecording = async () => {
    try {
      await Voice.stop();
    } catch (e) {
      console.error(e);
    }
  };

  const processConversation = async (text: string, speaker: 'me' | 'local') => {
    const messageId = Date.now().toString();
    
    // TRACK 1: Instant Local Translation (ML Kit)
    let translated = "Translation failed.";
    try {
      const sourceLang = speaker === 'me' ? 'en' : targetLanguage;
      const targetLang = speaker === 'me' ? targetLanguage : 'en';
      
      // ML Kit automatically downloads the model if it's not present on first run
      translated = (await Translate.translate({
        text,
        sourceLanguage: sourceLang as any,
        targetLanguage: targetLang as any,
        downloadModelIfNeeded: true,
      })) as unknown as string;
    } catch (e) {
      console.error("ML Kit Error:", e);
    }

    // Add to UI immediately
    const newMessage: Message = {
      id: messageId,
      speaker,
      originalText: text,
      translatedText: translated,
      isAnalyzing: true, // Triggers the loading state for Gemini
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // Play the audio back instantly
    const speechLang = speaker === 'me' ? 'ja-JP' : 'en-US';
    Speech.speak(translated, { language: speechLang, rate: 0.85 });

    // TRACK 2: Background Gemini Intelligence
    fetchGeminiInsights(newMessage);
  };

  const fetchGeminiInsights = async (msg: Message) => {
    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing API Key");

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3.1-flash-lite",
        generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `
        Analyze this translated phrase: "${msg.translatedText}" (Original: "${msg.originalText}").
        Provide a confidence score on the translation accuracy (High, Medium, Low) and provide ONE short, practical suggested response in the native language (with phonetic english) if applicable. 
        Format strictly as JSON:
        {
          "confidence": "High" | "Medium" | "Low",
          "suggestedResponse": "String or empty"
        }
      `;

      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text());

      // Update the specific message in state with the AI results
      setMessages(prev => prev.map(m => 
        m.id === msg.id 
          ? { ...m, confidence: data.confidence, suggestedResponse: data.suggestedResponse, isAnalyzing: false }
          : m
      ));

    } catch (error) {
      console.error("Gemini Error:", error);
      setMessages(prev => prev.map(m => 
        m.id === msg.id ? { ...m, isAnalyzing: false, confidence: 'Low' } : m
      ));
    }
  };

  const getBadgeColor = (confidence?: string) => {
    if (confidence === 'High') return { bg: colors.isDark ? 'rgba(21, 128, 61, 0.2)' : '#dff1e1', text: colors.isDark ? '#4ade80' : '#15803d' };
    if (confidence === 'Medium') return { bg: colors.isDark ? 'rgba(245, 185, 98, 0.15)' : '#fdf2dc', text: colors.isDark ? '#f5b962' : '#7a4f12' };
    return { bg: colors.isDark ? 'rgba(225, 29, 72, 0.15)' : '#ffe4e6', text: colors.destructive };
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Live Interaction</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.chatContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMe = item.speaker === 'me';
          const badge = getBadgeColor(item.confidence);
          
          return (
            <View style={[styles.card, { backgroundColor: isMe ? colors.secondary : colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.speakerLabel, { color: colors.mutedForeground }]}>
                  {isMe ? 'ME' : 'LOCAL'}
                </Text>
                
                {item.isAnalyzing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Feather name="shield" size={10} color={badge.text} />
                    <Text style={[styles.badgeText, { color: badge.text }]}>{item.confidence}</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.nativeText, { color: colors.foreground }]}>{item.originalText}</Text>
              <Text style={[styles.translatedText, { color: colors.mutedForeground }]}>{item.translatedText}</Text>

              {item.suggestedResponse && !item.isAnalyzing && (
                <View style={[styles.suggestionBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Text style={[styles.suggestionLabel, { color: colors.primary }]}>SUGGESTED RESPONSE</Text>
                  <Text style={[styles.suggestionText, { color: colors.foreground }]}>{item.suggestedResponse}</Text>
                </View>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          isRecording ? (
            <View style={[styles.card, { backgroundColor: activeSpeaker === 'me' ? colors.secondary : colors.card, borderColor: colors.border, opacity: 0.7 }]}>
              <Text style={[styles.speakerLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>
                {activeSpeaker === 'me' ? 'ME SPEAKING...' : 'LOCAL SPEAKING...'}
              </Text>
              <Text style={[styles.nativeText, { color: colors.foreground }]}>{liveTranscript || 'Listening...'}</Text>
            </View>
          ) : null
        }
      />

      <View style={[styles.actionArea, { paddingBottom: insets.bottom + 100, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.micBtn, { backgroundColor: colors.card, borderColor: isRecording && activeSpeaker === 'me' ? colors.primary : colors.border }]}
          onPressIn={() => startRecording('me')}
          onPressOut={stopRecording}
          activeOpacity={0.8}
        >
          <Feather name="user" size={20} color={isRecording && activeSpeaker === 'me' ? colors.primary : colors.foreground} />
          <View>
            <Text style={[styles.btnTitle, { color: isRecording && activeSpeaker === 'me' ? colors.primary : colors.foreground }]}>TAP 'ME'</Text>
            <Text style={[styles.btnSub, { color: colors.mutedForeground }]}>I speak</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.micBtn, { backgroundColor: colors.card, borderColor: isRecording && activeSpeaker === 'local' ? '#10b981' : colors.border }]}
          onPressIn={() => startRecording('local')}
          onPressOut={stopRecording}
          activeOpacity={0.8}
        >
          <Feather name="users" size={20} color={isRecording && activeSpeaker === 'local' ? '#10b981' : colors.foreground} />
          <View>
            <Text style={[styles.btnTitle, { color: isRecording && activeSpeaker === 'local' ? '#10b981' : colors.foreground }]}>TAP 'LOCAL'</Text>
            <Text style={[styles.btnSub, { color: colors.mutedForeground }]}>They speak</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', paddingBottom: 16, borderBottomWidth: 1 },
  headerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  chatContainer: { padding: 16, gap: 16 },
  card: { padding: 16, borderRadius: 18, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  speakerLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.2 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, gap: 4 },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 0.5 },
  nativeText: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 4 },
  translatedText: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 },
  suggestionBox: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  suggestionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1, marginBottom: 4 },
  suggestionText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  actionArea: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, position: 'absolute', bottom: 0, width: '100%' },
  micBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  btnTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  btnSub: { fontFamily: 'Inter_500Medium', fontSize: 12 },
});
