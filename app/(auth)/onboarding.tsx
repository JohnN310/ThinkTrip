import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../../hooks/useColors';
import AsyncStorage from '@react-native-async-storage/async-storage';


const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
    {
        id: 'baseline',
        eyebrow: 'YOUR IDENTITY',
        title: 'Biometric Baseline',
        description: 'ThinkTrip tunes your travel to your biological baseline including skin type, dietary needs, and travel activity levels.',
        icon: 'person-outline',
        color: '#5c7ce5',
    },
    {
        id: 'weather',
        eyebrow: 'LIVE ADAPTATION',
        title: 'Adaptive Planning',
        description: 'Pack ahead with precision weather forecasts, and watch your dashboard adapt in real-time to local air quality, UV, and humidity.',
        icon: 'cloud-outline',
        color: '#075985',
    },
    {
        id: 'scan',
        eyebrow: 'VISION AI',
        title: 'Scene Intelligence',
        description: 'Scan menus, signs, or receipts. Our AI decodes cultural nuances by cross-referencing with your health profile while keeping it secure.',
        icon: 'scan-outline',
        color: '#312e81',
    },
    {
        id: 'privacy',
        eyebrow: 'SECURE TRANSIT',
        title: 'Privacy First',
        description: 'Your identity stays local. We only share an anonymous health profile with the AI to ensure your safety.',
        icon: 'shield-checkmark-outline',
        color: '#1e293b',
    },
];

export default function OnboardingScreen() {
    const colors = useColors();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [activeIndex, setActiveIndex] = useState(0);
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;

    const transition = (nextIndex: number) => {
        if (Platform.OS !== 'web') Haptics.selectionAsync();

        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            setActiveIndex(nextIndex);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        });
    };

    const handleNext = async () => {
        if (activeIndex < SLIDES.length - 1) {
            transition(activeIndex + 1);
        } else {
            // Mark onboarding as complete so they never see it again
            await AsyncStorage.setItem('hasSeenOnboarding', 'true');
            router.replace('/login');
        }
    };

    const handlePrev = () => {
        if (activeIndex > 0) {
            transition(activeIndex - 1);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 30 }}>

                {/* Animated Visual Component */}
                <Animated.View style={[styles.visualContainer, { opacity: fadeAnim }]}>
                    <VisualMockup type={SLIDES[activeIndex].id} accent={SLIDES[activeIndex].color} />
                </Animated.View>

                {/* Text Content */}
                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
                    <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{SLIDES[activeIndex].eyebrow}</Text>
                    <Text style={[styles.title, { color: colors.foreground }]}>{SLIDES[activeIndex].title}</Text>
                    <Text style={[styles.description, { color: colors.mutedForeground }]}>{SLIDES[activeIndex].description}</Text>
                </Animated.View>
            </View>

            {/* Footer Navigation */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
                <View style={styles.pagination}>
                    {SLIDES.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                { backgroundColor: i === activeIndex ? '#5c7ce5' : colors.border, width: i === activeIndex ? 20 : 6 }
                            ]}
                        />
                    ))}
                </View>

                <View style={styles.buttonRow}>
                    <TouchableOpacity onPress={handlePrev} disabled={activeIndex === 0}>
                        <Text style={[styles.navText, { color: activeIndex === 0 ? 'transparent' : colors.mutedForeground }]}>Prev</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.nextBtn, { backgroundColor: '#5c7ce5' }]} onPress={handleNext}>
                        <Text style={styles.nextBtnText}>{activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}</Text>
                        <Feather name="arrow-right" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

// ─── UI Visual Mockups (Simulating App Screens) ───

function VisualMockup({ type, accent }: { type: string, accent: string }) {
    if (type === 'baseline') {
        return (
            <View style={styles.mockCard}>
                <View style={[styles.mockAvatar, { backgroundColor: accent }]} />
                <View style={styles.mockLine} />
                <View style={[styles.mockLine, { width: '60%' }]} />
                <View style={styles.mockToggleRow}>
                    <View style={[styles.mockToggle, { backgroundColor: accent }]} />
                    <View style={styles.mockLineSm} />
                </View>
            </View>
        );
    }
    if (type === 'weather') {
        return (
            <LinearGradient colors={[accent, '#1e293b']} style={styles.mockHero}>
                <Feather name="sun" size={40} color="#FDE047" />
                <Text style={styles.mockHeroTemp}>24°</Text>
                <View style={styles.mockHeroStats}>
                    <View style={styles.mockStatBox} />
                    <View style={styles.mockStatBox} />
                    <View style={styles.mockStatBox} />
                </View>
            </LinearGradient>
        );
    }
    if (type === 'scan') {
        return (
            <View style={styles.mockScanner}>
                <View style={[styles.mockReticle, { borderColor: accent }]} />
                <Text style={styles.mockDolphin}>🐬</Text>
                <View style={styles.mockScanLabel}>
                    <ActivityIndicator size="small" color={accent} />
                    <Text style={{ marginLeft: 8, fontSize: 10, color: '#64748b' }}>ANALYZING MENU...</Text>
                </View>
            </View>
        );
    }
    return (
        <View style={styles.mockPrivacy}>
            <Ionicons name="shield-checkmark" size={60} color={accent} />
            <View style={styles.mockDataCloud}>
                <View style={styles.mockBit} />
                <View style={styles.mockBit} />
                <View style={styles.mockBit} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    visualContainer: { height: 260, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
    eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 12, letterSpacing: 1.5, marginBottom: 8 },
    title: { fontFamily: 'Inter_700Bold', fontSize: 32, letterSpacing: -0.8, marginBottom: 16 },
    description: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24 },
    footer: { paddingHorizontal: 30 },
    pagination: { flexDirection: 'row', gap: 6, marginBottom: 30 },
    dot: { height: 6, borderRadius: 3 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    navText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
    nextBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, gap: 8 },
    nextBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },

    // Mockup Styles
    mockCard: { width: 200, backgroundColor: '#fff', borderRadius: 18, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 5 },
    mockAvatar: { width: 50, height: 50, borderRadius: 25, marginBottom: 12 },
    mockLine: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, marginBottom: 8, width: '100%' },
    mockLineSm: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, width: 80 },
    mockToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
    mockToggle: { width: 30, height: 16, borderRadius: 8 },

    mockHero: { width: 220, height: 160, borderRadius: 24, padding: 20, alignItems: 'center', justifyContent: 'center' },
    mockHeroTemp: { color: '#fff', fontSize: 40, fontFamily: 'Inter_700Bold' },
    mockHeroStats: { flexDirection: 'row', gap: 10, marginTop: 20 },
    mockStatBox: { width: 40, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6 },

    mockScanner: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
    mockReticle: { width: 160, height: 160, borderStyle: 'dashed', borderWidth: 2, borderRadius: 20 },
    mockDolphin: { fontSize: 40, position: 'absolute' },
    mockScanLabel: { position: 'absolute', bottom: -10, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 8, borderRadius: 10 },

    mockPrivacy: { alignItems: 'center', gap: 20 },
    mockDataCloud: { flexDirection: 'row', gap: 8 },
    mockBit: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e2e8f0' }
});