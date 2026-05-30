import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager, Modal, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { MenuItem } from '../lib/scanTypes';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── CLASSIC CENTERED MENU HEADER ───
export const MenuCategoryHeader = ({ categoryName, colors }: { categoryName: string; colors: any }) => (
  <View style={styles.headerContainer}>
    <View style={[styles.headerLine, { backgroundColor: colors.border }]} />
    <Text style={[styles.headerText, { color: colors.foreground }]}>
      {categoryName}
    </Text>
    <View style={[styles.headerLine, { backgroundColor: colors.border }]} />
  </View>
);

interface MenuItemRowProps {
  item: MenuItem;
  colors: any;
  languageCode?: string;
}

export const MenuItemRow: React.FC<MenuItemRowProps> = ({ item, colors, languageCode }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  const handleTTS = (e: any) => {
    e.stopPropagation();
    Speech.stop();
    Speech.speak(item.nativeName, { language: languageCode, rate: 0.65 });
  };

  const isAvoid = item.dietaryFlags === 'critical_avoid';
  const isHighlight = item.isHighlight === true;

  return (
    <>
      <TouchableOpacity
        activeOpacity={1}
        onPress={toggleExpand}
        style={styles.menuItemContainer}
      >
        {/* ─── CLASSIC DISH LINE (Name ........ Price) ─── */}
        <View style={styles.mainLine}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 8 }}>
            <Text style={[styles.translatedName, { color: colors.foreground }]}>
              {/* The star highlight has been removed from here */}
              {item.translatedName}
            </Text>
          </View>

          {/* Dotted leader line mimicking a physical menu */}
          <View style={[styles.leaderLine, { borderBottomColor: colors.border }]} />

          <Text style={[styles.price, { color: colors.foreground }]}>
            {item.price}
          </Text>
        </View>

        {/* ─── SUBTITLE LINE (Native Name + Intelligence) ─── */}
        <View style={styles.subLine}>
          <TouchableOpacity onPress={handleTTS} style={styles.ttsContainer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.nativeName, { color: colors.mutedForeground }]}>
              {item.nativeName}
            </Text>
            <Feather name="volume-2" size={13} color={colors.primary} style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {/* Biometric Warning (Next to Chevron) */}
            {/* {isAvoid && (
              <Feather name="alert-octagon" size={14} color={colors.destructive} />
            )} */}
            {/* Expand Indicator */}
            <Feather
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.mutedForeground}
              style={{ opacity: 0.5 }}
            />
          </View>
        </View>

        {/* ─── INLINE DESCRIPTION (Traditional Menu Style) ─── */}
        {isExpanded && (
          <View style={{ marginTop: 8 }}>
            {isAvoid && (
              <View style={styles.expandedWarningContainer}>
                <Feather name="alert-octagon" size={14} color={colors.destructive} style={{ marginTop: 2 }} />
                <Text style={[styles.expandedWarningText, { color: colors.destructive }]}>
                  {item.conflictReason || "Contains ingredients that conflict with your profile."}
                </Text>
              </View>
            )}
            <Text style={[styles.description, { color: colors.mutedForeground, marginTop: isAvoid ? 4 : 0 }]}>
              {item.description}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  // ─── HEADER STYLES ───
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20,
    gap: 16,
  },
  headerLine: {
    flex: 1,
    height: 1,
    opacity: 0.6,
  },
  headerText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },

  // ─── MENU ITEM STYLES ───
  menuItemContainer: {
    marginBottom: 22, // Generous spacing like a real menu
    paddingHorizontal: 4,
  },
  mainLine: {
    flexDirection: 'row',
    alignItems: 'flex-end', // Aligns the text baseline with the dots
    marginBottom: 4,
  },
  translatedName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  leaderLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    marginHorizontal: 10,
    marginBottom: 5, // Lifts the dots slightly off the bottom
    opacity: 0.4,
  },
  price: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  subLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ttsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nativeName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic', // Mimics traditional menu descriptions
  },
  expandedWarningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },
  expandedWarningText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  }
});