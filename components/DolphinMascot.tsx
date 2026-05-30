import React, { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Path, Ellipse, Circle, G } from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G) as any;
const AnimatedCircle = Animated.createAnimatedComponent(Circle) as any;

export function DolphinMascot({ size = 160, accent = '#5c7ce5', accentDark = '#4361c4', belly = '#eff6ff', ink = '#1e293b', spark = '#f5b962' }: {
  size?: number; accent?: string; accentDark?: string; belly?: string; ink?: string; spark?: string;
}) {
  const float = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const spk1 = useRef(new Animated.Value(0)).current;
  const spk2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatAnim = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    floatAnim.start();

    const blinkAnim = Animated.loop(Animated.sequence([
      Animated.delay(2200),
      Animated.timing(blink, { toValue: 0.05, duration: 90, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]));
    blinkAnim.start();

    const waveAnim = Animated.loop(Animated.sequence([
      Animated.timing(wave, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(wave, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    waveAnim.start();

    const spk1Anim = Animated.loop(Animated.sequence([
      Animated.timing(spk1, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(spk1, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    spk1Anim.start();

    const spk2Anim = Animated.loop(Animated.sequence([
      Animated.delay(500),
      Animated.timing(spk2, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(spk2, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    spk2Anim.start();

    return () => {
      floatAnim.stop();
      blinkAnim.stop();
      waveAnim.stop();
      spk1Anim.stop();
      spk2Anim.stop();
    };
  }, []);

  const floatDistance = - (size / 20); // Scale the float distance relative to the mascot size
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, floatDistance] });
  const waveDeg = wave.interpolate({ inputRange: [0, 1], outputRange: [-15, 20] });

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ translateY: floatY }] }}>
      <Svg viewBox="0 0 200 200" width={size} height={size}>
        {/* shadow */}
        {/* <Ellipse cx="100" cy="180" rx="58" ry="5" fill={accentDark} opacity={0.18} /> */}

        {/* body */}
        <Path
          d="M35 125C35 70 65 35 100 35C135 35 165 70 165 125C165 150 152 165 135 165C120 165 112 153 100 153C88 153 80 165 65 165C48 165 35 150 35 125Z"
          fill={accent}
        />
        {/* belly */}
        <Path
          d="M44 132C44 105 60 92 100 92C140 92 156 105 156 132C156 156 142 165 135 165C120 165 112 153 100 153C88 153 80 165 65 165C58 165 44 156 44 132Z"
          fill={belly}
        />
        {/* highlight */}
        <Ellipse cx="68" cy="62" rx="14" ry="6" fill="rgba(255,255,255,0.5)" transform="rotate(-30 68 62)" />

        {/* brows */}
        <Path d="M 68 68 Q 76 64 84 68" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
        <Path d="M 116 68 Q 124 64 132 68" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* eyes */}
        <AnimatedG scaleY={blink} originX={76} originY={82}>
          <Ellipse cx="76" cy="82" rx="8.5" ry="8.5" fill="#fff" />
          <Ellipse cx="76" cy="82" rx="5" ry="5" fill="#1e293b" />
          <Ellipse cx="74.5" cy="80.5" rx="1.8" ry="1.8" fill="#fff" />
        </AnimatedG>
        <AnimatedG scaleY={blink} originX={124} originY={82}>
          <Ellipse cx="124" cy="82" rx="8.5" ry="8.5" fill="#fff" />
          <Ellipse cx="124" cy="82" rx="5" ry="5" fill="#1e293b" />
          <Ellipse cx="122.5" cy="80.5" rx="1.8" ry="1.8" fill="#fff" />
        </AnimatedG>

        {/* warm smile + blush */}
        <Path d="M91 122 Q 100 134 109 122" stroke={ink} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <Ellipse cx="62" cy="115" rx="7" ry="3.5" fill="#f9a8a8" opacity={0.55} />
        <Ellipse cx="138" cy="115" rx="7" ry="3.5" fill="#f9a8a8" opacity={0.55} />

        {/* fin wave */}
        <AnimatedG rotation={waveDeg} originX={150} originY={95}>
          <Path d="M 150 95 Q 178 70 172 45 Q 160 58 150 78 Q 142 90 150 95 Z" fill={accentDark} />
        </AnimatedG>

        {/* sparkles */}
        <AnimatedCircle cx="42" cy="58" r="3" fill={spark} opacity={spk1} />
        <AnimatedCircle cx="34" cy="82" r="2" fill={spark} opacity={spk2} />
        <AnimatedCircle cx="178" cy="38" r="2.5" fill={spark} opacity={spk2} />
      </Svg>
    </Animated.View>
  );
}
