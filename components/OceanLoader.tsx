import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet, Dimensions, Text } from 'react-native';
import Svg, { Path, G, Ellipse, Defs, LinearGradient, Stop } from 'react-native-svg';

const WAVE_SEGMENT_WIDTH = 400;
const SCREEN_WIDTH = Dimensions.get('window').width;

const SCREEN_HEIGHT = Dimensions.get('window').height;

// ─── THINKTRIP BRANDED PALETTE ───
const THEME = {
  // Using Periwinkle Blue (#5c7ce5) as the primary brand color
  primary: '#5c7ce5',
  // Using Slate 500 (#64748b) for muted secondary elements
  secondary: '#64748b',
  // White for high-contrast glows
  whiteGlow: '#f8fafc',
  // Deep background for the dolphin gradients
  deepIndigo: '#1e293b',
};

// ─── BACKGROUND DIGITAL PARTICLES ───
const FloatingSquares = () => {
  const [squares] = useState(() =>
    Array.from({ length: 15 }).map(() => ({
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * SCREEN_HEIGHT,
      size: Math.random() * 4 + 2,
      opacity: Math.random() * 0.5 + 0.1,
      duration: Math.random() * 4000 + 3000,
      delay: Math.random() * 2000,
    }))
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      {squares.map((sq, i) => {
        const animY = useRef(new Animated.Value(sq.y)).current;
        const animOpacity = useRef(new Animated.Value(sq.opacity)).current;

        useEffect(() => {
          Animated.loop(
            Animated.sequence([
              Animated.parallel([
                Animated.timing(animY, { toValue: sq.y - 40, duration: sq.duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(animOpacity, { toValue: 0, duration: sq.duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
              ]),
              Animated.parallel([
                Animated.timing(animY, { toValue: sq.y, duration: 0, useNativeDriver: true }),
                Animated.timing(animOpacity, { toValue: sq.opacity, duration: 0, useNativeDriver: true })
              ])
            ])
          ).start();
        }, []);

        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: sq.x,
              top: 0,
              transform: [{ translateY: animY }],
              width: sq.size,
              height: sq.size,
              borderWidth: 1,
              borderColor: THEME.primary,
              backgroundColor: sq.size > 4 ? THEME.primary : 'transparent',
              opacity: animOpacity,
              shadowColor: THEME.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 4,
            }}
          />
        );
      })}
    </View>
  );
};

// ─── INDEPENDENT DOLPHIN COMPONENT ───
const AnimatedDolphin = ({ scale }: { scale: number }) => {
  const x = useRef(new Animated.Value(-150)).current;
  const y = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const pitch = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isActive = true;

    Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: -1, duration: 450, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    const triggerSwim = () => {
      if (!isActive) return;
      x.setValue(-150);

      const isJumping = Math.random() > 0.40;
      const duration = Math.random() * 3500 + 3500;
      const delay = Math.random() * 2000;

      if (isJumping) {
        const startY = Math.random() * 20 - 50;
        const peakY = -(Math.random() * 50 + 15);
        const endY = Math.random() * 40 - 50;

        y.setValue(startY);
        pitch.setValue(-1);

        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(x, { toValue: SCREEN_WIDTH + 150, duration, easing: Easing.linear, useNativeDriver: true }),
            Animated.sequence([
              Animated.parallel([
                Animated.timing(y, { toValue: peakY, duration: duration * 0.45, easing: Easing.out(Easing.sin), useNativeDriver: true }),
                Animated.timing(pitch, { toValue: 0, duration: duration * 0.45, easing: Easing.out(Easing.sin), useNativeDriver: true })
              ]),
              Animated.parallel([
                Animated.timing(y, { toValue: endY, duration: duration * 0.55, easing: Easing.in(Easing.sin), useNativeDriver: true }),
                Animated.timing(pitch, { toValue: 1, duration: duration * 0.55, easing: Easing.in(Easing.sin), useNativeDriver: true })
              ])
            ])
          ])
        ]).start(({ finished }) => finished && triggerSwim());

      } else {
        const startY = (Math.random() * 60) - 80;
        const endY = (Math.random() * 60) - 80;

        y.setValue(startY);
        pitch.setValue(0);

        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(x, { toValue: SCREEN_WIDTH + 150, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(y, { toValue: endY, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(pitch, { toValue: -0.15, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
              Animated.timing(pitch, { toValue: 0.15, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ])
          ])
        ]).start(({ finished }) => finished && triggerSwim());
      }
    };

    triggerSwim();
    return () => { isActive = false; };
  }, [x, y, bob, pitch]);

  const wiggleY = bob.interpolate({ inputRange: [-1, 1], outputRange: [-1.5, 1.5] });
  const wiggleRotate = bob.interpolate({ inputRange: [-1, 1], outputRange: ['-2deg', '2deg'] });
  const jumpRotate = pitch.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-25deg', '0deg', '35deg'] });

  return (
    <Animated.View style={[
      styles.dolphinContainer,
      {
        transform: [
          { translateX: x },
          { translateY: y },
          { translateY: wiggleY },
          { rotate: jumpRotate },
          { rotate: wiggleRotate },
          { scale: scale }
        ]
      }
    ]}>
      <Svg width="90" height="45" viewBox="0 0 90 45">
        <Defs>
          <LinearGradient id="dolphinGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={THEME.whiteGlow} stopOpacity="0.9" />
            <Stop offset="0.5" stopColor={THEME.primary} stopOpacity="1" />
            <Stop offset="1" stopColor={THEME.deepIndigo} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <G>
          <Path d="M 18 22 Q 5 5 0 12 Q 8 22 0 32 Q 5 39 18 22 Z" fill="url(#dolphinGrad)" />
          <Ellipse cx="46" cy="22" rx="30" ry="10" fill="url(#dolphinGrad)" />
          <Path d="M 72 20 Q 86 20 86 23 Q 86 26 72 26 Z" fill="url(#dolphinGrad)" />
          <Path d="M 38 13 Q 45 0 55 12 Q 48 12 38 13 Z" fill={THEME.whiteGlow} opacity={0.5} />
          <Path d="M 48 31 Q 38 45 43 45 Q 48 38 53 31 Z" fill={THEME.deepIndigo} />
        </G>
      </Svg>
    </Animated.View>
  );
};

// ─── MAIN LOADER COMPONENT ───
export default function OceanLoader() {
  const [dolphins, setDolphins] = useState<{ scale: number }[]>([]);
  const waveAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const podSize = Math.floor(Math.random() * 3) + 4;
    const generatedDolphins = Array.from({ length: podSize }).map(() => ({
      scale: 0.5 + (Math.random() * 0.45),
    }));
    setDolphins(generatedDolphins);

    // Wave animation loop
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 4500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Pulsing text animation loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [waveAnim, pulseAnim]);

  const waveTranslateX = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -WAVE_SEGMENT_WIDTH],
  });

  const wavePath1 = `M 0 60 Q 100 20 200 60 T 400 60 T 600 60 T 800 60 T 1000 60 T 1200 60 T 1400 60 T 1600 60`;
  const wavePath2 = `M 0 70 Q 100 110 200 70 T 400 70 T 600 70 T 800 70 T 1000 70 T 1200 70 T 1400 70 T 1600 70`;
  const wavePath3 = `M 0 50 Q 100 0 200 50 T 400 50 T 600 50 T 800 50 T 1000 50 T 1200 50 T 1400 50 T 1600 50`;

  return (
    <View style={styles.container}>

      {/* <FloatingSquares /> */}

      {/* ─── DIGITAL PARTICLE WAVES ─── */}
      <View style={styles.oceanContainer}>
        <Animated.View style={[styles.waveLayer, { transform: [{ translateX: waveTranslateX }] }]}>
          <Svg width={1600} height="150" viewBox="0 0 1600 150">
            {/* Background faint particle waves */}
            <Path d={wavePath3} stroke={THEME.secondary} strokeWidth={3} fill="none" opacity={0.2} transform="translate(0, -10)" strokeDasharray="1 10" strokeLinecap="round" />
            <Path d={wavePath2} stroke={THEME.secondary} strokeWidth={2} fill="none" opacity={0.1} transform="translate(50, -25)" strokeDasharray="1 14" strokeLinecap="round" />

            {/* Mid interconnected mesh waves */}
            <Path d={wavePath1} stroke={THEME.primary} strokeWidth={4} fill="none" opacity={0.4} transform="translate(-100, 0)" strokeDasharray="1 8" strokeLinecap="round" />

            {/* Foreground bright dot waves */}
            <Path d={wavePath2} stroke={THEME.whiteGlow} strokeWidth={4} fill="none" opacity={0.7} transform="translate(-200, 25)" strokeDasharray="1 7" strokeLinecap="round" />
          </Svg>
        </Animated.View>
      </View>

      {/* ─── DYNAMIC DOLPHIN POD ─── */}
      {dolphins.map((dolphin, index) => (
        <AnimatedDolphin
          key={index}
          scale={dolphin.scale}
        />
      ))}

      {/* ─── PULSING CAPTION ─── */}
      <Animated.Text style={[styles.caption, { opacity: pulseAnim }]}>
        Analyzing...
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    overflow: 'hidden',
  },
  header: {
    position: 'absolute',
    top: 50,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    zIndex: 20,
  },
  hudItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hudIcon: {
    fontSize: 16,
  },
  hudText: {
    color: THEME.whiteGlow,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    letterSpacing: 2,
  },
  oceanContainer: {
    position: 'absolute',
    bottom: '45%',
    width: '100%',
    height: 150,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveLayer: {
    width: 1600,
    flexDirection: 'row',
  },
  dolphinContainer: {
    position: 'absolute',
    left: 0,
    zIndex: 10,
    // Softened shadow to match the "Calm, premium" tone
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  caption: {
    position: 'absolute',
    bottom: '40%',
    fontFamily: 'Inter_600SemiBold', // Standardized font
    fontSize: 14, // Aligned with card titles
    letterSpacing: 1.4, // Aligned with section labels
    color: '#f8fafc',
    textTransform: 'uppercase', // Matches ThinkTrip's section title style
  },
});