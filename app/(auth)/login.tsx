import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Animated,
  Keyboard,
  Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useColors } from '../../hooks/useColors';

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // The animation engine: 0 means Sign In (collapsed), 1 means Sign Up (expanded)
  const expandAnim = useRef(new Animated.Value(0)).current;

  const toggleAuthMode = () => {
    Keyboard.dismiss(); // Prevent keyboard fighting during animation

    const nextModeIsLogin = !isLogin;
    setIsLogin(nextModeIsLogin);
    setErrorMsg('');
    setSuccessMsg('');

    // Smoothly ease the fields open or closed
    Animated.timing(expandAnim, {
      toValue: nextModeIsLogin ? 0 : 1,
      duration: 350,
      useNativeDriver: false, // Height animations must run on the JS thread
    }).start();
  };

  const handleAuth = async () => {
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!displayName) {
          setErrorMsg('Please enter a display name.');
          setLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        await setDoc(doc(db, 'profiles', userCredential.user.uid), {
          displayName,
          homeCity,
          email: userCredential.user.email,
        }, { merge: true });
      }
    } catch (err: any) {
      let msg = err.message || 'An error occurred';
      if (msg.includes('auth/invalid-credential')) msg = 'Invalid email or password.';
      else if (msg.includes('auth/email-already-in-use')) msg = 'Email is already registered.';
      else if (msg.includes('auth/weak-password')) msg = 'Password should be at least 6 characters.';
      else if (msg.includes('auth/invalid-email')) msg = 'Invalid email address.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setErrorMsg('Please enter your email address to reset your password.');
      setSuccessMsg('');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg('Password reset link sent! Check your inbox.');
    } catch (err: any) {
      let msg = err.message || 'An error occurred';
      if (msg.includes('auth/invalid-email')) msg = 'Invalid email address.';
      else if (msg.includes('auth/user-not-found')) msg = 'No account found with this email.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={{ width: 64, height: 64, borderRadius: 18 }}
            />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>ThinkTrip</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {isLogin ? 'Sign in to access your profile.' : 'Create an account to get started.'}
          </Text>
        </View>

        <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {errorMsg ? (
            <View style={[styles.errorBox, { backgroundColor: colors.isDark ? 'rgba(225, 29, 72, 0.1)' : '#fff1f2', borderColor: colors.destructive + '33' }]}>
              <Feather name="alert-triangle" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{errorMsg}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={[styles.errorBox, { backgroundColor: colors.isDark ? 'rgba(92, 124, 229, 0.15)' : '#eff6ff', borderColor: colors.primary + '33' }]}>
              <Feather name="check-circle" size={16} color={colors.primary} />
              <Text style={[styles.errorText, { color: colors.primary }]}>{successMsg}</Text>
            </View>
          ) : null}

          {/* Animated Container for Sign Up Fields */}
          <Animated.View style={{
            height: expandAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 170], // The exact pixel height needed for the two inputs and gaps
            }),
            opacity: expandAnim.interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [0, 0, 1], // Wait until partially open to fade text in
            }),
            overflow: 'hidden',
          }}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>DISPLAY NAME</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                placeholder="Your name"
                placeholderTextColor={colors.muted}
                value={displayName}
                onChangeText={setDisplayName}
                editable={!loading}
              />
            </View>

            <View style={[styles.inputGroup, { marginTop: 20 }]}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>HOME CITY (OPTIONAL)</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                placeholder="e.g. San Francisco"
                placeholderTextColor={colors.muted}
                value={homeCity}
                onChangeText={setHomeCity}
                editable={!loading}
              />
            </View>
          </Animated.View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>EMAIL</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>PASSWORD</Text>
              {isLogin && (
                <TouchableOpacity onPress={handleForgotPassword} disabled={loading}>
                  <Text style={[styles.inputLabel, { color: colors.primary, letterSpacing: 0, textTransform: 'none' }]}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={handleAuth}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
                {isLogin ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
          </Text>
          <TouchableOpacity onPress={toggleAuthMode} disabled={loading}>
            <Text style={[styles.footerAction, { color: colors.primary }]}>
              {isLogin ? 'Sign up' : 'Sign in'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  iconContainer: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, textAlign: 'center' },

  form: { padding: 24, borderRadius: 20, borderWidth: 1, gap: 20 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },

  inputGroup: { gap: 8 },
  inputLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Inter_500Medium', fontSize: 15 },

  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  footerAction: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});