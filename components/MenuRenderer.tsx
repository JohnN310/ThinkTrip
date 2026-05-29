import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager, Modal, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { MenuItem } from '../lib/scanTypes';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const MenuCategoryHeader = ({ categoryName, colors }: { categoryName: string; colors: any }) => (
  <View style={styles.headerContainer}>
    <Text style={[styles.headerText, { color: colors.mutedForeground }]}>
      {categoryName}
    </Text>
    <View style={[styles.headerRule, { backgroundColor: colors.border }]} />
  </View>
);

interface MenuItemRowProps {
  item: MenuItem;
  colors: any;
  languageCode?: string;
}

export const MenuItemRow: React.FC<MenuItemRowProps> = ({ item, colors, languageCode }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ bottom: 0, right: 0 });

  const iconRef = useRef<View>(null);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  const handleTTS = (e: any) => {
    e.stopPropagation();
    Speech.stop();
    Speech.speak(item.nativeName, { language: languageCode, rate: 0.65 });
  };

  const handleBadgePress = (e: any) => {
    e.stopPropagation();
    if (iconRef.current) {
      iconRef.current.measure((x, y, width, height, pageX, pageY) => {
        setTooltipPos({
          // Position the bubble exactly 12px above the icon, regardless of text length
          bottom: WINDOW_HEIGHT - pageY + 12,
          // Align relative to the right edge of the screen
          right: WINDOW_WIDTH - pageX - width - 8,
        });
        setShowTooltip(true);
      });
    }
  };

  const isAvoid = item.dietaryFlags === 'critical_avoid';
  const isSafe = item.dietaryFlags === 'safe';
  const isHighlight = item.isHighlight === true;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={toggleExpand}
        style={[
          styles.rowContainer,
          {
            backgroundColor: isHighlight ? colors.secondary : colors.card,
            borderColor: isHighlight ? 'transparent' : colors.border,
            borderWidth: isHighlight ? 0 : 1,
          }
        ]}
      >
        {isHighlight && (
          <Text style={[styles.highlightEyebrow, { color: colors.primary }]}>
            ✨ Top Match
          </Text>
        )}
        <View style={styles.topRow}>
          <Text style={[styles.translatedName, { color: colors.foreground }]}>
            {item.translatedName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>

            {/* Added ref here to measure the icon's position */}
            <View style={styles.badgeContainer} ref={iconRef}>
              {isAvoid && (
                <TouchableOpacity
                  onPress={handleBadgePress}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                  <Feather name="alert-octagon" size={16} color={colors.destructive || '#ef4444'} />
                </TouchableOpacity>
              )}
            </View>

            <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
          </View>
        </View>

        <View style={styles.bottomRow}>
          <Text style={[styles.nativeName, { color: colors.mutedForeground }]}>
            {item.nativeName}
          </Text>
          <TouchableOpacity onPress={handleTTS} style={styles.ttsButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="volume-2" size={14} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.bullet, { color: colors.mutedForeground }]}>•</Text>
          <Text style={[styles.price, { color: colors.mutedForeground }]}>{item.price}</Text>
        </View>

        {isExpanded && (
          <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              {item.description}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ─── FLOATING TOOLTIP BUBBLE ─── */}
      <Modal visible={showTooltip} transparent animationType="fade">
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={(e) => {
            e.stopPropagation();
            setShowTooltip(false);
          }}
        >
          <View style={[styles.tooltipBubble, { bottom: tooltipPos.bottom, right: tooltipPos.right }]}>
            <Text style={styles.tooltipText}>
              {item.conflictReason || "Contains ingredients that conflict with your profile."}
            </Text>
            {/* The little triangle pointing down */}
            <View style={styles.tooltipPointer} />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
    marginTop: 12
  },
  headerText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12, // Kept the smaller Eyebrow size
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  headerRule: {
    flex: 1,
    height: 1,
  },
  rowContainer: {
    borderRadius: 18,
    padding: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  highlightEyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  translatedName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    flex: 1,
    paddingRight: 10,
  },
  badgeContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 20, // Gives the measure function a stable bounding box
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  nativeName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  ttsButton: {
    marginLeft: 6,
    padding: 2,
  },
  bullet: {
    marginHorizontal: 6,
    fontSize: 13,
  },
  price: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  expandedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },

  // ─── TOOLTIP STYLES ───
  tooltipBubble: {
    position: 'absolute',
    maxWidth: 240,
    backgroundColor: 'rgba(10, 15, 25, 0.95)', // Matches the dark slate of the Mode Info bubble
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  tooltipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#f8fafc',
    lineHeight: 18,
  },
  tooltipPointer: {
    position: 'absolute',
    bottom: -7, // Pulls the triangle slightly outside the bottom of the bubble
    right: 14,  // Aligns perfectly with the alert-octagon icon below it
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(10, 15, 25, 0.95)', // Matches the bubble background
  }
});
