import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors } from '../hooks/useColors';

interface SegmentedControlProps<T extends string> {
  options: T[];
  value: T;
  onChange: (val: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.muted }]}>
      {options.map((opt) => {
        const isActive = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            activeOpacity={0.8}
            onPress={() => onChange(opt)}
            style={[
              styles.segment,
              isActive && [
                styles.activeSegment,
                { backgroundColor: colors.card, shadowColor: colors.foreground },
              ],
            ]}
          >
            <Text
              style={[
                styles.text,
                { color: isActive ? colors.foreground : colors.mutedForeground },
                isActive && { fontFamily: 'Inter_600SemiBold' }
              ]}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeSegment: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  text: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
});
