import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet, Text } from 'react-native';
import Svg, { Path, G, Ellipse, Circle, Rect, Line, Text as SvgText } from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G) as any;
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse) as any;
const AnimatedSvgText = Animated.createAnimatedComponent(SvgText) as any;

interface ParticleDef {
  x: string;
  y: string;
  delay: number;
  duration: number;
}

const AmbientParticle = ({ p }: { p: ParticleDef }) => {
  const pAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.timing(pAnim, { toValue: 1, duration: p.duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pAnim, { toValue: 0, duration: p.duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const pY = pAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
  const pOp = pAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <Animated.View
      style={[
        styles.particle,
        { left: p.x as any, top: p.y as any, transform: [{ translateY: pY }], opacity: pOp }
      ]}
    />
  );
};

// ─── ThinkTrip Palette ───
const PRIMARY = "#5c7ce5";
const PRIMARY_DARK = "#4361c4";
const SECONDARY = "#eff6ff";
const TEXT = "#1e293b";
const ACCENT = "#f5b962";
const CAPTION_COLOR = "#f8fafc";

type Scene = "think" | "search" | "calc" | "idea";

interface SceneDef {
  caption: string;
  pupil: { x: number; y: number };
  openness: number;
  brow: { tilt: number; lift: number };
  mouth: string;
}

const SCENES: Record<Scene, SceneDef> = {
  think: {
    caption: "Hmm, let me think…",
    pupil: { x: -2, y: 3 }, // Changed from x: -2.5, y: -3 so it looks down-left at the paper!
    openness: 1,
    brow: { tilt: -8, lift: -2 },
    mouth: "M93 124 Q 100 122 107 124",
  },
  search: {
    caption: "Searching the currents…",
    pupil: { x: -3, y: 3.5 },
    openness: 1,
    brow: { tilt: 6, lift: 0 },
    mouth: "M93 126 Q 100 124 107 126",
  },
  calc: {
    caption: "Crunching the numbers…",
    pupil: { x: 0, y: 3.5 },
    openness: 0.6,
    brow: { tilt: 0, lift: 2 },
    mouth: "M95 126 L 105 126",
  },
  idea: {
    caption: "Got it! ✨",
    pupil: { x: 0, y: -1 },
    openness: 1.15,
    brow: { tilt: 0, lift: -4 },
    mouth: "M91 122 Q 100 134 109 122",
  },
};

const SCENE_ORDER: Scene[] = ["think", "search", "calc", "idea"];

// ─── SCENE OVERLAY COMPONENTS ───

const ThinkOverlay = ({ opacity }: { opacity: Animated.Value }) => {
  const write = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fast, tight looping animation to simulate rapid scribbling/writing
    Animated.loop(
      Animated.sequence([
        Animated.timing(write, { toValue: 1, duration: 160, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(write, { toValue: 0, duration: 160, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Animate the hand doing small horizontal strokes with a tiny vertical bob
  const writeX = write.interpolate({ inputRange: [0, 1], outputRange: [0, 14] });
  const writeY = write.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -3, 0] });
  const writeRot = write.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '4deg'] });

  return (
    <AnimatedG style={{ opacity }}>
      {/* ─── NOTEPAD ─── */}
      <G transform="translate(60, 130)">
        {/* Paper base */}
        <Rect x="0" y="0" width="70" height="50" rx="4" fill={CAPTION_COLOR} opacity={0.95} />
        {/* Drawn text lines */}
        <Rect x="10" y="12" width="30" height="3" rx="1.5" fill={PRIMARY_DARK} opacity={0.3} />
        <Rect x="10" y="22" width="50" height="3" rx="1.5" fill={PRIMARY_DARK} opacity={0.3} />
        <Rect x="10" y="32" width="40" height="3" rx="1.5" fill={PRIMARY_DARK} opacity={0.3} />
      </G>

      {/* ─── FIN HOLDING PENCIL ─── */}
      <AnimatedG
        originX={100}
        originY={150}
        style={{ transform: [{ translateX: Animated.add(writeX, 20) }, { translateY: writeY }, { rotate: writeRot }] }}
      >
        {/* Pencil Body */}
        <Path d="M 86 152 L 112 115 L 118 119 L 92 156 Z" fill={ACCENT} />
        {/* Pencil Tip (Graphite & Wood) */}
        <Path d="M 86 152 L 92 156 L 82 160 Z" fill="#e2e8f0" />
        <Path d="M 84 156 L 87 158 L 82 160 Z" fill={TEXT} />

        {/* Fin overlapping the pencil */}
        <Path d="M 135 145 Q 115 165 95 148 Q 115 135 145 135 Z" fill={PRIMARY_DARK} />
      </AnimatedG>
    </AnimatedG>
  );
};

const SearchOverlay = ({ opacity }: { opacity: Animated.Value }) => {
  const magnify = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(magnify, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(magnify, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const mx = magnify.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
  const my = magnify.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const mRot = magnify.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] });

  return (
    <AnimatedG style={{ opacity }}>
      <AnimatedG originX={55} originY={145} style={{ transform: [{ translateX: mx }, { translateY: my }, { rotate: mRot }] }}>
        <Rect x="50" y="155" width="28" height="5" rx="2.5" fill="#3a3a3a" transform="rotate(-35 64 157)" />
        <Circle cx="38" cy="140" r="20" fill="rgba(245,185,98,0.15)" stroke={ACCENT} strokeWidth="4" />
        <Path d="M 26 132 Q 32 128 42 130" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity={0.8} />
      </AnimatedG>
    </AnimatedG>
  );
};

const CalcOverlay = ({ opacity }: { opacity: Animated.Value }) => {
  const tap = useRef(new Animated.Value(0)).current;
  const numAnims = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Tapping Fins
    Animated.loop(
      Animated.sequence([
        Animated.timing(tap, { toValue: 1, duration: 250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(tap, { toValue: 0, duration: 250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Floating Numbers
    numAnims.forEach((anim, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 350),
          Animated.timing(anim, { toValue: 1, duration: 2400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  const tapL = tap.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '2deg'] });
  const tapR = tap.interpolate({ inputRange: [0, 1], outputRange: ['2deg', '-4deg'] });

  const chars = [{ x: 55, c: "7" }, { x: 85, c: "+" }, { x: 110, c: "3" }, { x: 140, c: "=" }, { x: 160, c: "10" }];

  return (
    <AnimatedG style={{ opacity }}>
      {/* Left Fin */}
      <AnimatedG originX={75} originY={158} style={{ transform: [{ rotate: tapL }] }}>
        <Path d="M 65 150 Q 55 165 65 178 Q 82 172 88 160 Z" fill={PRIMARY_DARK} />
      </AnimatedG>
      {/* Right Fin */}
      <AnimatedG originX={125} originY={158} style={{ transform: [{ rotate: tapR }] }}>
        <Path d="M 135 150 Q 145 165 135 178 Q 118 172 112 160 Z" fill={PRIMARY_DARK} />
      </AnimatedG>

      {/* Floating Math Characters */}
      {chars.map((n, i) => {
        const translateY = numAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, -45] });
        const numOpacity = numAnims[i].interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] });

        return (
          <AnimatedSvgText
            key={n.x}
            x={n.x}
            y={28}
            fontSize={16}
            fontWeight="700"
            fill={ACCENT}
            textAnchor="middle"
            style={{ transform: [{ translateY }], opacity: numOpacity }}
          >
            {n.c}
          </AnimatedSvgText>
        );
      })}
    </AnimatedG>
  );
};

const IdeaOverlay = ({ opacity }: { opacity: Animated.Value }) => {
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, {
      toValue: 1,
      friction: 4,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, []);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const translateY = pop.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <AnimatedG style={{ opacity }}>
      <AnimatedG originX={100} originY={30} style={{ transform: [{ scale }, { translateY }] }}>
        <Circle cx="100" cy="28" r="18" fill={ACCENT} opacity={0.25} />
        <Path d="M 92 32 Q 92 18 100 18 Q 108 18 108 32 L 106 38 L 94 38 Z" fill={ACCENT} />
        <Rect x="95" y="38" width="10" height="3" fill={TEXT} />
        <Rect x="96" y="42" width="8" height="2" fill={TEXT} />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <Line key={deg} x1="100" y1="0" x2="100" y2="6" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${deg} 100 28)`} />
        ))}
      </AnimatedG>
    </AnimatedG>
  );
};

interface OceanLoaderProps {
  size?: number;
  isFinished?: boolean;
  onFinishComplete?: () => void;
}

export default function OceanLoader({ size = 280, isFinished = false, onFinishComplete }: OceanLoaderProps) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const sceneKey = SCENE_ORDER[sceneIdx];
  const s = SCENES[sceneKey];

  // ── Master Animation Nodes ──
  const floatAnim = useRef(new Animated.Value(0)).current;
  const sceneFade = useRef(new Animated.Value(0)).current;

  // ── Face Transition Nodes ──
  const pupilX = useRef(new Animated.Value(s.pupil.x)).current;
  const pupilY = useRef(new Animated.Value(s.pupil.y)).current;
  const openness = useRef(new Animated.Value(s.openness)).current;

  // Background Particles
  const [particles] = useState(() => Array.from({ length: 10 }).map((_, i) => ({
    x: `${(i * 47) % 100}%`,
    y: `${(i * 59) % 95}%`,
    delay: i * 300,
    duration: 3000 + (i % 4) * 1000
  })));

  useEffect(() => {
    // Gentle Master Float
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    if (isFinished) return;

    // Scene Interval - loops through index 0, 1, 2 only
    const id = setInterval(() => {
      setSceneIdx((i) => (i + 1) % 3);
    }, 2500);
    return () => clearInterval(id);
  }, [isFinished]);

  // Handle final completion sequence transition
  useEffect(() => {
    if (isFinished) {
      setSceneIdx(3); // Jump to "idea" scene

      const timer = setTimeout(() => {
        if (onFinishComplete) {
          onFinishComplete();
        }
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [isFinished, onFinishComplete]);

  // Trigger smooth transitions when scene changes
  useEffect(() => {
    // Face Morphing
    Animated.parallel([
      Animated.timing(pupilX, { toValue: s.pupil.x, duration: 600, easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: true }),
      Animated.timing(pupilY, { toValue: s.pupil.y, duration: 600, easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: true }),
      Animated.timing(openness, { toValue: s.openness, duration: 600, easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: true }),
    ]).start();

    // Fade Cycle for overlays and caption
    sceneFade.setValue(0);
    Animated.sequence([
      Animated.timing(sceneFade, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(1900),
      Animated.timing(sceneFade, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

  }, [sceneIdx]);

  // ── Explicit Radius Mapping to bypass SVG scaling bugs ──
  // By converting "openness" scaling into raw radius manipulation, the eyes 
  // perfectly anchor to their center (cy) regardless of bezier overshoot values.
  const whiteRy = openness.interpolate({ inputRange: [0, 1, 2], outputRange: [0.1, 8.5, 17] });
  const pupilRy = openness.interpolate({ inputRange: [0, 1, 2], outputRange: [0.1, 5, 10] });
  const highlightRy = openness.interpolate({ inputRange: [0, 1, 2], outputRange: [0.1, 1.8, 3.6] });

  const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const rotate = floatAnim.interpolate({ inputRange: [0, 1], outputRange: ['-1deg', '1deg'] });
  const captionTranslateY = sceneFade.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });

  return (
    <View style={styles.container}>
      <View style={[styles.canvasWrapper, { width: size, height: size }]}>

        {/* Background Ambient Particles */}
        <View style={StyleSheet.absoluteFill}>
          {particles.map((p, i) => (
            <AmbientParticle key={i} p={p} />
          ))}
        </View>

        {/* Floating Dolphin Canvas */}
        <Animated.View style={{ width: size, height: size, transform: [{ translateY }, { rotate }] }}>
          <Svg viewBox="0 0 200 200" width={size} height={size} style={{ overflow: "visible" }}>

            {/* Base Shadow */}
            <Ellipse cx="100" cy="180" rx="60" ry="6" fill={PRIMARY_DARK} opacity={0.15} />

            {/* Main Head Structure */}
            <Path d="M35 125C35 70 65 35 100 35C135 35 165 70 165 125C165 150 152 165 135 165C120 165 112 153 100 153C88 153 80 165 65 165C48 165 35 150 35 125Z" fill={PRIMARY} />
            <Path d="M44 132C44 105 60 92 100 92C140 92 156 105 156 132C156 156 142 165 135 165C120 165 112 153 100 153C88 153 80 165 65 165C58 165 44 156 44 132Z" fill={SECONDARY} />
            <Path d="M72 102C82 96 118 96 128 102" stroke={TEXT} strokeWidth="3" strokeLinecap="round" opacity={0.15} />
            <Ellipse cx="68" cy="62" rx="14" ry="6" fill="rgba(255,255,255,0.45)" transform="rotate(-30 68 62)" />

            {/* Dynamic Eyebrows */}
            <Path d={`M 68 ${70 + s.brow.lift} Q 76 ${67 + s.brow.lift + s.brow.tilt} 84 ${70 + s.brow.lift}`} stroke={TEXT} strokeWidth="3" strokeLinecap="round" fill="none" />
            <Path d={`M 116 ${70 + s.brow.lift} Q 124 ${67 + s.brow.lift - s.brow.tilt} 132 ${70 + s.brow.lift}`} stroke={TEXT} strokeWidth="3" strokeLinecap="round" fill="none" />

            {/* ── LEFT EYE ── */}
            {/* Directly bind `ry` instead of wrapping in a scale matrix */}
            <AnimatedEllipse cx="76" cy="82" rx="8.5" ry={whiteRy} fill="#fff" />

            {/* The pupil group only handles X/Y translation logic */}
            <AnimatedG style={{ transform: [{ translateX: pupilX }, { translateY: pupilY }] }}>
              <AnimatedEllipse cx="76" cy="82" rx="5" ry={pupilRy} fill={TEXT} />
              <AnimatedEllipse cx="74.5" cy="80.5" rx="1.8" ry={highlightRy} fill="#fff" />
            </AnimatedG>

            {/* ── RIGHT EYE ── */}
            <AnimatedEllipse cx="124" cy="82" rx="8.5" ry={whiteRy} fill="#fff" />

            <AnimatedG style={{ transform: [{ translateX: pupilX }, { translateY: pupilY }] }}>
              <AnimatedEllipse cx="124" cy="82" rx="5" ry={pupilRy} fill={TEXT} />
              <AnimatedEllipse cx="122.5" cy="80.5" rx="1.8" ry={highlightRy} fill="#fff" />
            </AnimatedG>

            {/* Mouth & Expressions */}
            <Path d={s.mouth} stroke={TEXT} strokeWidth="3.5" strokeLinecap="round" fill="none" />

            {sceneKey === "idea" && (
              <>
                <Ellipse cx="62" cy="115" rx="8" ry="4" fill="#f9a8a8" opacity={0.6} />
                <Ellipse cx="138" cy="115" rx="8" ry="4" fill="#f9a8a8" opacity={0.6} />
              </>
            )}

            {/* Render Active Overlays */}
            {sceneKey === "think" && <ThinkOverlay opacity={sceneFade} />}
            {sceneKey === "search" && <SearchOverlay opacity={sceneFade} />}
            {sceneKey === "calc" && <CalcOverlay opacity={sceneFade} />}
            {sceneKey === "idea" && <IdeaOverlay opacity={sceneFade} />}

          </Svg>
        </Animated.View>
      </View>

      {/* Synchronized Caption */}
      {/* <Animated.Text style={[styles.caption, { opacity: sceneFade, transform: [{ translateY: captionTranslateY }] }]}>
        {s.caption}
      </Animated.Text> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  canvasWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  particle: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: PRIMARY,
  },
  caption: {
    color: CAPTION_COLOR,
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    letterSpacing: 0.2,
    minHeight: 24,
    textAlign: "center",
  }
});