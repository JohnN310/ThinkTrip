import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

// --- ☀️ Pulsing Sun Animation ---
const SunEffect = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 3000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <Animated.View style={[styles.sunCore, { transform: [{ scale: pulseAnim }], opacity: 0.8 }]} />
      <Animated.View style={[styles.sunGlow, { transform: [{ scale: pulseAnim }], opacity: 0.4 }]} />
    </View>
  );
};

// --- 🌙 Clear Night Moon Animation ---
const MoonEffect = () => {
  return (
    <View style={StyleSheet.absoluteFillObject}>
      <View style={styles.moonCore} />
      <View style={styles.moonGlow} />
    </View>
  );
};

// --- 🌧️ Procedural Rain Animation ---
const RainEffect = () => {
  const drops = useRef(
    Array.from({ length: 30 }).map(() => ({
      animY: new Animated.Value(-50),
      startX: Math.random() * width,
      delay: Math.random() * 1500,
      duration: 600 + Math.random() * 300, // Fast fall speed
    }))
  ).current;

  useEffect(() => {
    drops.forEach((drop) => {
      Animated.loop(
        Animated.timing(drop.animY, {
          toValue: 300,
          duration: drop.duration,
          delay: drop.delay,
          useNativeDriver: true,
        })
      ).start();
    });
  }, []);

  return (
    <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}>
      {drops.map((drop, i) => (
        <Animated.View
          key={i}
          style={[styles.raindrop, { left: drop.startX, transform: [{ translateY: drop.animY }] }]}
        />
      ))}
    </View>
  );
};

// --- ⚡ Lightning Animation (Used with Rain) ---
const LightningEffect = () => {
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const triggerLightning = () => {
      const nextStrike = 3000 + Math.random() * 6000; // Random interval between 3-9s
      Animated.sequence([
        Animated.delay(nextStrike),
        Animated.timing(flashAnim, { toValue: 0.6, duration: 50, useNativeDriver: true }), // Flash on
        Animated.timing(flashAnim, { toValue: 0, duration: 50, useNativeDriver: true }),   // Flash off
        Animated.timing(flashAnim, { toValue: 0.3, duration: 50, useNativeDriver: true }), // Secondary flicker
        Animated.timing(flashAnim, { toValue: 0, duration: 200, useNativeDriver: true }),  // Fade out
      ]).start(() => triggerLightning()); // Loop endlessly
    };
    triggerLightning();
  }, []);

  return <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#ffffff', opacity: flashAnim }]} />;
};

// --- ❄️ Procedural Snow Animation ---
const SnowEffect = () => {
  const flakes = useRef(
    Array.from({ length: 40 }).map(() => ({
      animY: new Animated.Value(-20),
      startX: Math.random() * width,
      delay: Math.random() * 1000,
      duration: 3000 + Math.random() * 3000, // Slow, varying fall speed
      size: 2 + Math.random() * 4, // Varying flake sizes
      opacity: 0.3 + Math.random() * 0.7,
    }))
  ).current;

  useEffect(() => {
    flakes.forEach((flake) => {
      Animated.loop(
        Animated.timing(flake.animY, {
          toValue: 300,
          duration: flake.duration,
          delay: flake.delay,
          useNativeDriver: true,
        })
      ).start();
    });
  }, []);

  return (
    <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}>
      {flakes.map((flake, i) => (
        <Animated.View
          key={i}
          style={[
            styles.snowflake,
            {
              left: flake.startX,
              width: flake.size,
              height: flake.size,
              borderRadius: flake.size / 2,
              opacity: flake.opacity,
              transform: [{ translateY: flake.animY }]
            }
          ]}
        />
      ))}
    </View>
  );
};

// --- ☁️ Drifting Clouds / Fog Animation ---
const CloudEffect = () => {
  const driftAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(driftAnim, { toValue: 1, duration: 25000, useNativeDriver: true }), // Drift right slowly
        Animated.timing(driftAnim, { toValue: 0, duration: 25000, useNativeDriver: true }), // Drift left slowly
      ])
    ).start();
  }, []);

  const translateX1 = driftAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 80] });
  const translateX2 = driftAnim.interpolate({ inputRange: [0, 1], outputRange: [40, -60] });

  // Helper component to draw the physical cloud shape
  const CloudShape = ({ style, opacity = 0.4 }: any) => (
    <Animated.View style={[styles.cloudContainer, style, { opacity }]}>
      <View style={styles.cloudBump1} />
      <View style={styles.cloudBump2} />
      <View style={styles.cloudBase} />
    </Animated.View>
  );

  return (
    <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}>
      {/* Background, smaller, slower cloud */}
      <CloudShape
        style={{ top: 20, left: -20, transform: [{ translateX: translateX1 }, { scale: 0.8 }] }}
        opacity={0.3}
      />
      {/* Foreground, larger cloud drifting the opposite way */}
      <CloudShape
        style={{ top: 80, right: -40, transform: [{ translateX: translateX2 }] }}
        opacity={0.5}
      />
    </View>
  );
};

// --- Main Wrapper Component ---
export const WeatherBackground = ({ condition }: { condition?: string }) => {
  if (!condition) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {(condition === 'Sunny' || condition === 'Clear') && <SunEffect />}
      {condition === 'Clear Night' && <MoonEffect />}

      {['Rain', 'Drizzle'].includes(condition) && <RainEffect />}

      {condition === 'Thunderstorm' && (
        <>
          <LightningEffect />
          <RainEffect />
        </>
      )}

      {condition === 'Snow' && <SnowEffect />}

      {['Clouds', 'Mist', 'Fog', 'Haze'].includes(condition) && <CloudEffect />}
    </View>
  );
};

const styles = StyleSheet.create({
  // Sun
  sunCore: { position: 'absolute', top: -40, right: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: '#FDE047' },
  sunGlow: { position: 'absolute', top: -60, right: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: '#FEF08A' },

  // Moon
  moonCore: { position: 'absolute', top: -20, right: -10, width: 100, height: 100, borderRadius: 50, backgroundColor: '#E2E8F0', opacity: 0.9 },
  moonGlow: { position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: '#F8FAFC', opacity: 0.2 },

  // Rain
  raindrop: { position: 'absolute', top: -20, width: 2, height: 24, backgroundColor: 'rgba(255, 255, 255, 0.4)', borderRadius: 1 },

  // Snow
  snowflake: { position: 'absolute', top: -20, backgroundColor: '#ffffff' },

  // --- Clouds ---
  cloudContainer: {
    width: 160,
    height: 80,
    position: 'absolute'
  },
  cloudBase: {
    position: 'absolute',
    bottom: 0,
    width: 160,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff'
  },
  cloudBump1: {
    position: 'absolute',
    bottom: 20,
    left: 25,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ffffff'
  },
  cloudBump2: {
    position: 'absolute',
    bottom: 25,
    right: 30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff'
  },
});