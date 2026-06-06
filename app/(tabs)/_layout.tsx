import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import { BlurView } from 'expo-blur';
import { useColors } from '../../hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: {
          fontFamily: 'Inter_600SemiBold',
          fontSize: 11,
        },
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: 'transparent',
          height: Platform.OS === 'ios' ? 88 : 74,
          paddingBottom: Platform.OS === 'ios' ? 28 : 14,
        },
        tabBarBackground: () => (
          <BlurView
            tint={colors.isDark ? 'dark' : 'light'}
            intensity={colors.isDark ? 40 : 60}
            style={{
              ...StyleSheet.absoluteFillObject,
              borderTopColor: 'rgba(255, 255, 255, 0.15)',
              borderTopWidth: 1,
            }}
          />
        ),
      }}
    >
      {/* 1. Plan Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color }) =>
            Platform.OS === 'ios' ? (
              <SymbolView name="map" tintColor={color} fallback={<Feather name="map" size={24} color={color} />} style={{ width: 24, height: 24 }} />
            ) : (
              <Feather name="map" size={24} color={color} />
            ),
        }}
      />

      {/* 2. Live Tab (Moved here!) */}
      <Tabs.Screen
        name="live"
        options={{
          title: 'Interaction',
          tabBarIcon: ({ color }) =>
            Platform.OS === 'ios' ? (
              <SymbolView
                name="bubble.left.and.bubble.right.fill"
                tintColor={color}
                fallback={<Feather name="message-square" size={24} color={color} />}
                style={{ width: 24, height: 24 }}
              />
            ) : (
              <Feather name="message-square" size={24} color={color} />
            ),
        }}
      />

      {/* 3. Scan Tab */}
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color }) =>
            Platform.OS === 'ios' ? (
              <SymbolView name="viewfinder.circle" tintColor={color} fallback={<Feather name="camera" size={24} color={color} />} style={{ width: 24, height: 24 }} />
            ) : (
              <Feather name="camera" size={24} color={color} />
            ),
        }}
      />

      {/* 4. Profile Tab */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) =>
            Platform.OS === 'ios' ? (
              <SymbolView name="person.crop.circle" tintColor={color} fallback={<Feather name="user" size={24} color={color} />} style={{ width: 24, height: 24 }} />
            ) : (
              <Feather name="user" size={24} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}