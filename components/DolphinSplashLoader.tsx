import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing, Dimensions, Platform } from 'react-native';
import Svg, { Path, Ellipse } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { lightTheme } from '../constants/colors';

// Create high-performance animated SVG primitives to avoid matrix transform drift
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

interface DolphinSplashLoaderProps {
  isLoading: boolean;
  onAnimationComplete: () => void;
}

const { width } = Dimensions.get('window');

export default function DolphinSplashLoader({ isLoading, onAnimationComplete }: DolphinSplashLoaderProps) {
  // Animation Core States
  const bobAnim = useRef(new Animated.Value(0)).current;
  const eyeRadiusY = useRef(new Animated.Value(9)).current; // Direct radius mutation handles scaling perfectly in-place
  const containerFade = useRef(new Animated.Value(1)).current;

  const isLooping = useRef(true);

  useEffect(() => {
    if (isLoading) {
      startIdleLoop();
    } else {
      triggerCompletionSequence();
    }
  }, [isLoading]);

  // Phase 1: High-fidelity, smooth floating idle sequence
  const startIdleLoop = () => {
    isLooping.current = true;

    const bobSequence = Animated.sequence([
      Animated.timing(bobAnim, {
        toValue: -14,
        duration: 1600,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(bobAnim, {
        toValue: 0,
        duration: 1600,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]);

    Animated.loop(bobSequence).start(() => {
      if (isLooping.current) startIdleLoop();
    });
  };

  // Phase 2 & 3: Settle positioning, execute native double-blink timeline, fade out
  const triggerCompletionSequence = () => {
    isLooping.current = false;
    bobAnim.stopAnimation();

    // Smoothly ground the asset to its base alignment vector before firing the micro-interaction
    Animated.timing(bobAnim, {
      toValue: 0,
      duration: 250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      // Execute standard character double-blink execution
      Animated.sequence([
        // Blink 1
        Animated.timing(eyeRadiusY, { toValue: 0.5, duration: 80, useNativeDriver: false }),
        Animated.timing(eyeRadiusY, { toValue: 9, duration: 100, useNativeDriver: false }),

        // Organic micro-delay between blinks
        Animated.delay(120),

        // Blink 2
        Animated.timing(eyeRadiusY, { toValue: 0.5, duration: 80, useNativeDriver: false }),
        Animated.timing(eyeRadiusY, { toValue: 9, duration: 100, useNativeDriver: false }),

        // Hold expression briefly for polish
        Animated.delay(200),
      ]).start(() => {
        // Trigger structural app success haptic response
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        // Phase 3: Premium cinematic fade transition out
        Animated.timing(containerFade, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start(() => {
          onAnimationComplete();
        });
      });
    });
  };

  // Dynamically map specular catch-light reflections to match the blink layout constraints
  const highlightRadiusY = eyeRadiusY.interpolate({
    inputRange: [0.5, 9],
    outputRange: [0.1, 3.5],
  });

  return (
    <Animated.View style={[styles.container, { opacity: containerFade }]}>
      <Animated.View
        style={{
          transform: [{ translateY: bobAnim }],
          alignItems: 'center',
        }}
      >
        {/* ThinkTrip Editorial Vector Canvas */}
        <Svg width={width * 0.5} height={width * 0.5} viewBox="0 0 200 200" fill="none">
          {/* Main Dolphin Head Dome Structure (Primary Blue #5c7ce5) */}
          <Path
            d="M35 125C35 70 65 35 100 35C135 35 165 70 165 125C165 150 152 165 135 165C120 165 112 153 100 153C88 153 80 165 65 165C48 165 35 150 35 125Z"
            fill={lightTheme.primary}
          />

          {/* Premium High-Arching Secondary Belly Muzzle Plate (#eff6ff) */}
          <Path
            d="M44 132C44 105 60 92 100 92C140 92 156 105 156 132C156 156 142 165 135 165C120 165 112 153 100 153C88 153 80 165 65 165C58 165 44 156 44 132Z"
            fill={lightTheme.secondary}
          />

          {/* Snout Contour Definition Bridge Line */}
          <Path
            d="M72 102C82 96 118 96 128 102"
            stroke={lightTheme.text}
            strokeWidth="3"
            strokeLinecap="round"
            opacity={0.15}
          />

          {/* Left Eye Setup (Centric anchor point maps to cx=76, cy=82) */}
          <AnimatedEllipse cx="76" cy="82" rx="7" ry={eyeRadiusY} fill={lightTheme.text} />
          <AnimatedEllipse cx="74" cy="79" rx="2.5" ry={highlightRadiusY} fill="#ffffff" />

          {/* Right Eye Setup (Centric anchor point maps to cx=124, cy=82) */}
          <AnimatedEllipse cx="124" cy="82" rx="7" ry={eyeRadiusY} fill={lightTheme.text} />
          <AnimatedEllipse cx="122" cy="79" rx="2.5" ry={highlightRadiusY} fill="#ffffff" />

          {/* Centered Minimalist Editorial Smile */}
          <Path
            d="M93 124Q100 129 107 124"
            stroke={lightTheme.text}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff', // Clean white background mask synchronization
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999, // Layer constraint overlay positioning
  },
});