import { MobileTypography } from '@/constants/colors';
/** Light-themed account sign-in for DisasterGuard. */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Input } from '@/components/Input';
import { AuthHero } from '@/components/AuthHero';
import { LightColors } from '@/constants/colors';

export default function LoginScreen() {
  const { login } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [signInError, setSignInError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      newErrors.email = 'Enter a valid email address.';
    if (!password) newErrors.password = 'Enter your password.';
    setErrors(newErrors);
    setSignInError(null);
    if (Object.keys(newErrors).length) return;

    setLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch (error) {
      setSignInError(
        error instanceof Error ? error.message : 'Unable to sign in. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer
      style={styles.screen}
      contentStyle={styles.shell}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.content}>
            <AuthHero />

            <View style={styles.card}>
              <View style={styles.heading}>
                <Text accessibilityRole="header" style={styles.title}>
                  Welcome back
                </Text>
                <Text style={styles.description}>Sign in to stay close to your community.</Text>
              </View>

              <Input
                label="Email address"
                placeholder="Enter your email address"
                appearance="light"
                value={email}
                editable={!loading}
                onChangeText={text => {
                  setEmail(text);
                  setErrors(current => ({ ...current, email: undefined }));
                  setSignInError(null);
                }}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="username"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordRef.current?.focus()}
                icon={<Ionicons name="mail-outline" size={19} color={LightColors.mutedText} />}
                containerStyle={styles.emailField}
              />

              <Input
                label="Password"
                placeholder="Enter your password"
                appearance="light"
                inputRef={passwordRef}
                value={password}
                editable={!loading}
                onChangeText={text => {
                  setPassword(text);
                  setErrors(current => ({ ...current, password: undefined }));
                  setSignInError(null);
                }}
                error={errors.password}
                isPassword
                autoComplete="current-password"
                textContentType="password"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                icon={
                  <Ionicons name="lock-closed-outline" size={19} color={LightColors.mutedText} />
                }
                containerStyle={styles.passwordField}
              />

              {signInError && (
                <View
                  style={styles.errorNotice}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                >
                  <Ionicons name="alert-circle-outline" size={19} color={LightColors.danger} />
                  <Text style={styles.errorText}>{signInError}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={loading ? 'Signing in' : 'Sign in'}
                accessibilityState={{ disabled: loading, busy: loading }}
                style={[styles.signInButton, loading && styles.buttonLoading]}
              >
                {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                <Text style={styles.signInButtonText}>{loading ? 'Signing in...' : 'Sign in'}</Text>
                {!loading && <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />}
              </TouchableOpacity>

              <View style={styles.divider} />
              <View style={styles.registration}>
                <Text style={styles.registrationText}>New to DisasterGuard?</Text>
                <Link href="/(auth)/signup" asChild>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    disabled={loading}
                    accessibilityRole="link"
                    style={styles.createAccountLink}
                  >
                    <Text style={styles.createAccountText}>Create a citizen account</Text>
                    <Ionicons name="chevron-forward" size={14} color={LightColors.primary} />
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { backgroundColor: '#0855D9' },
  shell: {
    backgroundColor: LightColors.background,
    borderColor: LightColors.border,
    shadowOpacity: 0.06,
  },
  scrollContent: { flexGrow: 1, paddingBottom: 28 },
  content: { width: '100%', alignSelf: 'center' },
  card: {
    backgroundColor: LightColors.surface,
    padding: 24,
    marginHorizontal: 20,
    marginTop: -28,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#EDF2FA',
    shadowColor: '#154893',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.09,
    shadowRadius: 24,
    elevation: 4,
  },
  heading: { marginBottom: 24 },
  title: {
    color: LightColors.text,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.7,
    marginBottom: 8,
  },
  description: { color: LightColors.secondaryText, ...MobileTypography.body },
  emailField: { marginBottom: 20 },
  passwordField: { marginBottom: 24 },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    backgroundColor: LightColors.dangerSoft,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { flex: 1, color: LightColors.danger, ...MobileTypography.caption },
  signInButton: {
    minHeight: 54,
    borderRadius: 16,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
    backgroundColor: LightColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  buttonLoading: { backgroundColor: LightColors.primaryPressed },
  signInButtonText: { color: '#FFFFFF', ...MobileTypography.button, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#EDF1F7', marginTop: 28, marginBottom: 16 },
  registration: { alignItems: 'center' },
  registrationText: { color: LightColors.secondaryText, ...MobileTypography.caption },
  createAccountLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  createAccountText: { color: LightColors.primary, ...MobileTypography.button, fontWeight: '600' },
});
