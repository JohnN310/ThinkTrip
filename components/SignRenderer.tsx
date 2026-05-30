import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { SignData } from '../lib/scanTypes';

interface SignRendererProps {
  sign: SignData;
  colors: any;
  languageCode?: string;
}

export const SignRenderer: React.FC<SignRendererProps> = ({ sign, colors, languageCode }) => {
  if (!sign) return null;

  const handleTTS = () => {
    Speech.stop();
    Speech.speak(sign.originalText, { language: languageCode, rate: 0.65 });
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

      {/* ─── TRANSLATION (Prominent) ─── */}
      <Text style={[styles.translatedText, { color: colors.foreground }]}>
        "{sign.translatedText}"
      </Text>

      {/* ─── NATIVE TEXT & TTS ─── */}
      <TouchableOpacity
        onPress={handleTTS}
        style={styles.ttsContainer}
        activeOpacity={0.7}
      >
        <Feather name="volume-2" size={14} color={colors.primary} style={{ marginTop: 4 }} />
        <Text style={[styles.nativeText, { color: colors.mutedForeground }]}>
          {sign.originalText}
        </Text>
      </TouchableOpacity>

      {/* ─── ACTIONABLE INSTRUCTION BOX ─── */}
      <View style={[styles.instructionBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <View style={styles.instructionHeader}>
          <Feather name="info" size={14} color={colors.primary} />
          <Text style={[styles.instructionEyebrow, { color: colors.primary }]}>WHAT TO DO</Text>
        </View>
        <Text style={[styles.instructionText, { color: colors.foreground }]}>
          {sign.instruction}
        </Text>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    marginTop: 12
  },
  translatedText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    letterSpacing: -0.4,
    lineHeight: 28,
    marginBottom: 12,
  },
  ttsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 24,
  },
  nativeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    flexShrink: 1,
    lineHeight: 22,
  },
  instructionBox: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  instructionEyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  instructionText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    lineHeight: 22,
  },
});
