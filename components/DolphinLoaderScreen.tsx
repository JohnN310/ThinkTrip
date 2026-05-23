import React, { useRef, useEffect } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import Svg, { Path, Ellipse, Circle, G } from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G) as any;
const AnimatedCircle = Animated.createAnimatedComponent(Circle) as any;
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse) as any;

interface DolphinLoaderProps {
    size?: number;
    accent?: string;
    accentDark?: string;
    belly?: string;
    ink?: string;
    isFinished?: boolean;
    onFinishComplete?: () => void;
}

export function DolphinLoader({
    size = 180,
    accent = '#5c7ce5',
    accentDark = '#4361c4',
    belly = '#eff6ff',
    ink = '#1e293b',
    isFinished = false,
    onFinishComplete,
}: DolphinLoaderProps) {

    // Animation Values
    const jump = useRef(new Animated.Value(0)).current;
    const blink = useRef(new Animated.Value(1)).current;
    const ripple1 = useRef(new Animated.Value(0)).current;
    const ripple2 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // 1. Exaggerated jumping motion
        const jumpAnim = Animated.loop(
            Animated.sequence([
                Animated.timing(jump, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                Animated.timing(jump, { toValue: 0, duration: 800, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            ])
        );
        jumpAnim.start();

        // 2. Faster blinking for a more active/playful look
        const blinkAnim = Animated.loop(
            Animated.sequence([
                Animated.delay(1500),
                Animated.timing(blink, { toValue: 0.05, duration: 80, useNativeDriver: true }),
                Animated.timing(blink, { toValue: 1, duration: 100, useNativeDriver: true }),
                Animated.delay(200),
                Animated.timing(blink, { toValue: 0.05, duration: 80, useNativeDriver: true }),
                Animated.timing(blink, { toValue: 1, duration: 100, useNativeDriver: true }),
            ])
        );
        blinkAnim.start();

        // 3. Continuous outward water ripples
        const startRipple = (anim: Animated.Value, delay: number) => {
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(anim, { toValue: 1, duration: 1600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                ])
            ).start();
        };

        startRipple(ripple1, 0);
        startRipple(ripple2, 800); // Stagger the second ring

        return () => {
            jumpAnim.stop();
            blinkAnim.stop();
            ripple1.stopAnimation();
            ripple2.stopAnimation();
        };
    }, []);

    useEffect(() => {
        if (isFinished) {
            // Wait for a short time to finish the animation gracefully
            const timer = setTimeout(() => {
                if (onFinishComplete) {
                    onFinishComplete();
                }
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [isFinished, onFinishComplete]);

    // Interpolations
    const jumpY = jump.interpolate({ inputRange: [0, 1], outputRange: [5, -25] });
    const jumpRotation = jump.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '8deg'] });

    // Ripple scaling and fading
    const getRippleStyle = (anim: Animated.Value) => ({
        scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.5] }),
        opacity: anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.8, 0.4, 0] })
    });

    return (
        <View style={{ width: size, height: size + 40, alignItems: 'center', justifyContent: 'center' }}>

            {/* Background Water Ripples */}
            <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 20 }]}>
                <Animated.View style={{ transform: [{ scale: getRippleStyle(ripple1).scale }, { scaleY: 0.3 }], opacity: getRippleStyle(ripple1).opacity, position: 'absolute' }}>
                    <View style={[styles.rippleRing, { borderColor: accentDark }]} />
                </Animated.View>
                <Animated.View style={{ transform: [{ scale: getRippleStyle(ripple2).scale }, { scaleY: 0.3 }], opacity: getRippleStyle(ripple2).opacity, position: 'absolute' }}>
                    <View style={[styles.rippleRing, { borderColor: accentDark }]} />
                </Animated.View>
            </View>

            {/* Jumping Mascot */}
            <Animated.View style={{ width: size, height: size, transform: [{ translateY: jumpY }, { rotate: jumpRotation as any }] }}>
                <Svg viewBox="0 0 200 200" width="100%" height="100%">

                    {/* Main Body */}
                    <Path
                        d="M35 125C35 70 65 35 100 35C135 35 165 70 165 125C165 150 152 165 135 165C120 165 112 153 100 153C88 153 80 165 65 165C48 165 35 150 35 125Z"
                        fill={accent}
                    />
                    {/* Belly */}
                    <Path
                        d="M44 132C44 105 60 92 100 92C140 92 156 105 156 132C156 156 142 165 135 165C120 165 112 153 100 153C88 153 80 165 65 165C58 165 44 156 44 132Z"
                        fill={belly}
                    />
                    {/* Highlight */}
                    <Ellipse cx="68" cy="62" rx="14" ry="6" fill="rgba(255,255,255,0.5)" transform="rotate(-30 68 62)" />

                    {/* Happy Brows (Arching up) */}
                    <Path d="M 66 60 Q 76 52 86 60" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
                    <Path d="M 114 60 Q 124 52 134 60" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />

                    {/* Blinking Eyes */}
                    <AnimatedG scaleY={blink} originX={76} originY={76}>
                        <Ellipse cx="76" cy="76" rx="9" ry="10" fill="#fff" />
                        <Ellipse cx="76" cy="76" rx="5.5" ry="6.5" fill={ink} />
                        <Ellipse cx="74" cy="73" rx="2" ry="2" fill="#fff" />
                    </AnimatedG>
                    <AnimatedG scaleY={blink} originX={124} originY={76}>
                        <Ellipse cx="124" cy="76" rx="9" ry="10" fill="#fff" />
                        <Ellipse cx="124" cy="76" rx="5.5" ry="6.5" fill={ink} />
                        <Ellipse cx="122" cy="73" rx="2" ry="2" fill="#fff" />
                    </AnimatedG>

                    {/* Open Mouth (Happy/Laughing) */}
                    <Path d="M 90 110 Q 100 130 110 110" fill="#f9a8a8" stroke={ink} strokeWidth="3" strokeLinecap="round" />
                    <Path d="M 90 110 Q 100 115 110 110" fill="#fff" />

                    {/* Dynamic Fin Wave */}
                    <AnimatedG rotation={jumpRotation} originX={150} originY={95}>
                        <Path d="M 150 95 Q 185 60 178 35 Q 160 55 150 78 Q 142 90 150 95 Z" fill={accentDark} />
                    </AnimatedG>

                    {/* Splash Droplets */}
                    <Circle cx="40" cy="150" r="4" fill="#a8c2c0" />
                    <Circle cx="25" cy="130" r="2.5" fill="#a8c2c0" />
                    <Circle cx="160" cy="160" r="5" fill="#a8c2c0" />
                    <Circle cx="175" cy="145" r="3" fill="#a8c2c0" />

                </Svg>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    rippleRing: {
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 6,
        backgroundColor: 'transparent',
    }
});

export default DolphinLoader;