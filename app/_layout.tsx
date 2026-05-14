import React, { useEffect } from 'react';
import { View, useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ProfileProvider } from '../contexts/ProfileContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { StatusBar } from 'expo-status-bar';
// import * as Notifications from 'expo-notifications';
import { useColors } from '../hooks/useColors';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import '../lib/backgroundWeather';

// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldShowBanner: true,
//     shouldShowList: true,
//     shouldPlaySound: true,
//     shouldSetBadge: true,
//   }),
// });

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

import { useRouter, useSegments, Stack } from 'expo-router';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colors = useColors();

  const [isNavigationReady, setIsNavigationReady] = React.useState(false);
  const [isFirstLaunch, setIsFirstLaunch] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    // 1. Check local storage for onboarding status
    async function checkOnboarding() {
      try {
        const hasSeen = await AsyncStorage.getItem('hasSeenOnboarding');
        setIsFirstLaunch(hasSeen !== 'true');
      } catch {
        setIsFirstLaunch(false); // Default to login if storage fails
      }
    }
    checkOnboarding();

    // 2. Wait for root layout to mount
    const timer = setTimeout(() => setIsNavigationReady(true), 1);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    // Don't route until everything is loaded
    if (loading || !isNavigationReady || isFirstLaunch === null) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {

      AsyncStorage.getItem('hasSeenOnboarding').then(hasSeen => {
        const isActuallyFirstLaunch = hasSeen !== 'true';

        setIsFirstLaunch(isActuallyFirstLaunch);

        router.replace(isActuallyFirstLaunch ? '/onboarding' : '/login');
      });

    } else if (user && inAuthGroup) {
      router.replace('/');
    }
  }, [user, loading, segments, isNavigationReady]);

  if (loading || isFirstLaunch === null) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return <>{children}</>;
}

function ThemedStatusBar() {
  const colors = useColors();
  return <StatusBar style={colors.isDark ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <View style={{ flex: 1 }}>
            <AuthProvider>
              <ProfileProvider>
                <AuthGuard>
                  <ThemedStatusBar />
                  <Stack screenOptions={{ animation: 'fade', animationDuration: 400 }}>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                    <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
                  </Stack>
                </AuthGuard>
              </ProfileProvider>
            </AuthProvider>
          </View>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
