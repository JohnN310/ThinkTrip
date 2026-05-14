import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet, Text, useWindowDimensions } from 'react-native';
import Svg, { Path, G, Ellipse, Defs, LinearGradient, Stop } from 'react-native-svg';

const WAVE_SEGMENT_WIDTH = 400;

// ─── THINKTRIP BRANDED PALETTE ───
const THEME = {
  primary: '#5c7ce5',
  secondary: '#64748b',
  whiteGlow: '#f8fafc',
  deepIndigo: '#1e293b',
};

// ─── BACKGROUND DIGITAL PARTICLES ───
const FloatingSquares = () => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [squares] = useState(() =>
    Array.from({ length: 15 }).map(() => ({
      x: Math.random() * screenWidth,
      y: Math.random() * screenHeight,
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
const AnimatedDolphin = ({ scale, screenWidth }: { scale: number; screenWidth: number }) => {
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
      const delay = Math.random() * 2000;

      // Calculate duration dynamically based on screen width to maintain constant perceived speed
      const distance = screenWidth + 300;
      const duration = distance * (Math.random() * 5 + 6);

      if (isJumping) {
        const startY = Math.random() * 20 - 50;
        const peakY = -(Math.random() * 50 + 15);
        const endY = Math.random() * 40 - 50;

        y.setValue(startY);
        pitch.setValue(-1);

        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(x, { toValue: screenWidth + 150, duration, easing: Easing.linear, useNativeDriver: true }),
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
            Animated.timing(x, { toValue: screenWidth + 150, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
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
  }, [x, y, bob, pitch, screenWidth]);

  const wiggleY = bob.interpolate({ inputRange: [-1, 1], outputRange: [-1.5, 1.5] });
  const wiggleRotate = bob.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] });
  const squish = bob.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.98, 1.03, 0.98] });
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
          { scale: scale },
          { scaleX: squish },
          { scaleY: squish },
        ]
      }
    ]}>
      <Svg width="120" height="70" viewBox="0 0 120 70">
        <Defs>
          <LinearGradient id="dolphinBody" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#b8d8ff" />
            <Stop offset="45%" stopColor="#7ab8ff" />
            <Stop offset="100%" stopColor="#4f7cff" />
          </LinearGradient>
          <LinearGradient id="dolphinBelly" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <Stop offset="100%" stopColor="#dbeafe" stopOpacity="0.9" />
          </LinearGradient>
          <LinearGradient id="shine" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <G>
          <Path d="M20 34 Q4 18 2 28 Q10 36 2 44 Q4 54 20 38 Q14 36 20 34" fill="#7ab8ff" />
          <Ellipse cx="58" cy="35" rx="38" ry="18" fill="url(#dolphinBody)" />
          <Ellipse cx="60" cy="42" rx="24" ry="9" fill="url(#dolphinBelly)" opacity={0.95} />
          <Path d="M90 31 Q108 32 110 35 Q108 38 90 39" fill="#6aa8ff" />
          <Path d="M52 18 Q60 2 70 18 Q62 15 52 18" fill="#5d8fff" />
          <Path d="M58 47 Q50 62 64 55 Q66 50 58 47" fill="#5d8fff" />
          <Ellipse cx="82" cy="30" rx="4.5" ry="4.5" fill="white" />
          <Ellipse cx="83" cy="31" rx="2" ry="2.5" fill="#0f172a" />
          <Ellipse cx="84" cy="30" rx="0.8" ry="0.8" fill="white" />
          <Path d="M86 39 Q92 43 98 38" stroke="#1e3a8a" strokeWidth="2" fill="none" strokeLinecap="round" />
          <Ellipse cx="78" cy="40" rx="4" ry="2" fill="#ffc1d6" opacity={0.45} />
          <Path d="M38 23 Q58 12 82 22" stroke="url(#shine)" strokeWidth="6" strokeLinecap="round" opacity={0.75} fill="none" />
        </G>
      </Svg>
    </Animated.View>
  );
};

// ─── MAIN LOADER COMPONENT ───
export default function OceanLoader() {
  const { width: screenWidth } = useWindowDimensions();
  const [dolphins, setDolphins] = useState<{ scale: number }[]>([]);

  const [captionIndex, setCaptionIndex] = useState(0);
  const CAPTIONS = [
    'Translating from whale noises...',
    'Math is really hard today...',
    'Hang on tight bud...',
    'Teaching the dolphins to read...',
    'Uhhhh...',
    'I should have majored in marine biology..',
    'Almost there...'
  ];

  useEffect(() => {
    const captionTimer = setInterval(() => {
      setCaptionIndex((prevIndex) => {
        if (prevIndex < CAPTIONS.length - 1) {
          return prevIndex + 1;
        } else {
          clearInterval(captionTimer);
          return prevIndex;
        }
      });
    }, 2500);

    return () => clearInterval(captionTimer);
  }, []);

  const waveAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const podSize = Math.floor(Math.random() * 3) + 4;

    // Dynamically reduce the base scale for narrow screens (like standard Androids)
    const baseScale = screenWidth < 390 ? 0.75 : 1;

    const generatedDolphins = Array.from({ length: podSize }).map(() => ({
      scale: (0.5 + (Math.random() * 0.45)) * baseScale,
    }));
    setDolphins(generatedDolphins);

    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 4500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [waveAnim, pulseAnim, screenWidth]);

  const waveTranslateX = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -WAVE_SEGMENT_WIDTH],
  });

  const wavePath1 = `M 0 60 Q 100 20 200 60 T 400 60 T 600 60 T 800 60 T 1000 60 T 1200 60 T 1400 60 T 1600 60`;
  const wavePath2 = `M 0 70 Q 100 110 200 70 T 400 70 T 600 70 T 800 70 T 1000 70 T 1200 70 T 1400 70 T 1600 70`;
  const wavePath3 = `M 0 50 Q 100 0 200 50 T 400 50 T 600 50 T 800 50 T 1000 50 T 1200 50 T 1400 50 T 1600 50`;

  return (
    <View style={styles.container}>
      <FloatingSquares />

      {/* ─── DIGITAL PARTICLE WAVES ─── */}
      <View style={styles.oceanContainer}>
        <Animated.View style={[styles.waveLayer, { transform: [{ translateX: waveTranslateX }] }]}>
          <Svg width={1600} height="150" viewBox="0 0 1600 150">
            <Path d={wavePath3} stroke={THEME.secondary} strokeWidth={3} fill="none" opacity={0.2} transform="translate(0, -10)" strokeDasharray="1 10" strokeLinecap="round" />
            <Path d={wavePath2} stroke={THEME.secondary} strokeWidth={2} fill="none" opacity={0.1} transform="translate(50, -25)" strokeDasharray="1 14" strokeLinecap="round" />
            <Path d={wavePath1} stroke={THEME.primary} strokeWidth={4} fill="none" opacity={0.4} transform="translate(-100, 0)" strokeDasharray="1 8" strokeLinecap="round" />
            <Path d={wavePath2} stroke={THEME.whiteGlow} strokeWidth={4} fill="none" opacity={0.7} transform="translate(-200, 25)" strokeDasharray="1 7" strokeLinecap="round" />
          </Svg>
        </Animated.View>
      </View>

      {/* ─── DYNAMIC DOLPHIN POD ─── */}
      {dolphins.map((dolphin, index) => (
        <AnimatedDolphin
          key={index}
          scale={dolphin.scale}
          screenWidth={screenWidth}
        />
      ))}

      {/* ─── PULSING CAPTION ─── */}
      <Animated.Text style={[styles.caption, { opacity: pulseAnim }]}>
        {CAPTIONS[captionIndex]}
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
  oceanContainer: {
    position: 'absolute',
    bottom: '45%',
    width: '100%',
    height: 150,
    overflow: 'hidden',
    alignItems: 'flex-start', // Fix: Anchor to left edge so the 400px loop aligns perfectly
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
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  caption: {
    position: 'absolute',
    bottom: '42%',
    width: '100%',             // Fix: Confine text to the screen bounds
    textAlign: 'center',       // Fix: Center the text inside the full-width bounds
    paddingHorizontal: 20,     // Fix: Add a buffer so it never hits the absolute edges
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    letterSpacing: 1.4,
    color: '#f8fafc',
  },
});