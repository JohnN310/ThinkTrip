import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';

export const ErrorFallback = ({ error, resetError }: { error?: Error, resetError: () => void }) => {
  const systemTheme = useColorScheme();
  const isDark = systemTheme === 'dark';

  const bgColor = isDark ? '#020617' : '#f8fafc';
  const fgColor = isDark ? '#f8fafc' : '#1e293b';
  const mutedFgColor = isDark ? '#94a3b8' : '#64748b';
  const primaryColor = isDark ? '#818cf8' : '#5c7ce5';
  const primaryFgColor = '#f8fafc'; // Same for both
  const destructiveColor = isDark ? '#f43f5e' : '#e11d48';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Feather name="alert-triangle" color={destructiveColor} size={48} />
      <Text style={[styles.title, { color: fgColor }]}>Something went wrong</Text>
      <Text style={[styles.subtitle, { color: mutedFgColor }]}>
        {error?.message || "An unexpected error occurred."}
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: primaryColor }]}
        onPress={resetError}
      >
        <Text style={[styles.buttonText, { color: primaryFgColor }]}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
});
