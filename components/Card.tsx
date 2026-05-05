import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useColors } from '../hooks/useColors';

interface CardProps extends ViewProps {
  padded?: boolean;
}

export const Card = ({ style, padded = true, ...props }: CardProps) => {
  const colors = useColors();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        padded && styles.padded,
        style,
      ]}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  padded: {
    padding: 18,
  },
});
