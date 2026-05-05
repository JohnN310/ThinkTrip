import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useColors } from '../hooks/useColors';

interface ToggleRowProps {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
}

export const ToggleRow = ({ title, description, value, onValueChange }: ToggleRowProps) => {
  const colors = useColors();
  const translateAnim = React.useRef(new Animated.Value(value ? 16 : 0)).current;

  useEffect(() => {
    Animated.spring(translateAnim, {
      toValue: value ? 16 : 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, [value]);

  return (
    <View style={[styles.container, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {description && <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>}
      </View>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onValueChange(!value)}
        style={[
          styles.track,
          { backgroundColor: value ? colors.primary : colors.border },
        ]}
      >
        <Animated.View
          style={[
            styles.knob,
            {
              backgroundColor: colors.card,
              transform: [{ translateX: translateAnim }],
            },
          ]}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  track: {
    width: 42,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});
