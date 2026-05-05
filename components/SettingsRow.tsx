import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors } from '../hooks/useColors';

interface SettingsRowProps {
  icon: React.ReactNode;
  iconBackgroundColor?: string;
  label: string;
  description?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
}

export const SettingsRow = ({ icon, iconBackgroundColor, label, description, rightElement, onPress }: SettingsRowProps) => {
  const colors = useColors();

  const content = (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: iconBackgroundColor || colors.muted }]}>
        {icon}
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
        {description && <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>}
      </View>
      {rightElement && <View style={styles.rightContainer}>{rightElement}</View>}
    </View>
  );

  if (onPress) {
    return <TouchableOpacity activeOpacity={0.7} onPress={onPress}>{content}</TouchableOpacity>;
  }
  return content;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  rightContainer: {
    marginLeft: 12,
  },
});

export const SettingsGroup = ({ title, children, footnote }: { title?: string, children: React.ReactNode, footnote?: string }) => {
  const colors = useColors();
  
  return (
    <View style={stylesGroup.groupContainer}>
      {title && <Text style={[stylesGroup.groupTitle, { color: colors.mutedForeground }]}>{title}</Text>}
      <View style={[stylesGroup.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {React.Children.map(children, (child, index) => (
          <React.Fragment key={index}>
            {child}
            {index < React.Children.count(children) - 1 && (
              <View style={[stylesGroup.divider, { backgroundColor: colors.border }]} />
            )}
          </React.Fragment>
        ))}
      </View>
      {footnote && <Text style={[stylesGroup.footnote, { color: colors.mutedForeground }]}>{footnote}</Text>}
    </View>
  );
};

const stylesGroup = StyleSheet.create({
  groupContainer: {
    marginBottom: 18,
  },
  groupTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 14,
  },
  groupCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    marginLeft: 56, // offset to start after icon
  },
  footnote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 8,
    marginLeft: 14,
  },
});
