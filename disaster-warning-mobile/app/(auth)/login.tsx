/**
 * Professional Mobile Login Screen — Command Center Access.
 * Features live emergency ops indicator, rapid credential selector, and biometric-ready design.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/colors';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid official email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch (error) {
      Alert.alert('Authentication Failed', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Live Emergency Ops Ribbon */}
          <View style={styles.opsTicker}>
            <View style={styles.pulseDot} />
            <Text style={styles.opsTickerText}>
              DMC NATIONAL OPS • MONSOON FLOOD RESPONSE ACTIVE
            </Text>
          </View>

          {/* Hero Branding */}
          <View style={styles.heroSection}>
            <LinearGradient
              colors={['#0284C7', '#0F172A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoOrb}
            >
              <LinearGradient
                colors={['#38BDF8', '#2563EB']}
                style={styles.logoInner}
              >
                <Ionicons name="shield-half-outline" size={36} color="#FFFFFF" />
              </LinearGradient>
            </LinearGradient>

            <Text style={styles.appName}>DisasterGuard</Text>
            <Text style={styles.appSub}>
              Early-Warning & Emergency Operations Command
            </Text>
            <View style={styles.countryPill}>
              <Ionicons name="flag-outline" size={12} color="#38BDF8" />
              <Text style={styles.countryText}>
                Disaster Management Centre • Sri Lanka
              </Text>
            </View>
          </View>

          {/* Form Container */}
          <View style={styles.formContainer}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Operator Sign In</Text>
              <Text style={styles.formDescription}>
                Authenticate to access shelter, rescue, and relief operations
              </Text>
            </View>

            <Input
              label="Official Email"
              placeholder="officer@dmc.gov.lk"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
              }}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              icon={<Ionicons name="mail-outline" size={18} color={Colors.accent.primary} />}
            />

            <Input
              label="Password"
              placeholder="Enter secure password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
              }}
              error={errors.password}
              isPassword
              autoComplete="password"
              icon={<Ionicons name="lock-closed-outline" size={18} color={Colors.accent.primary} />}
            />

            <Button
              title="Authenticate & Enter Command"
              onPress={handleLogin}
              loading={loading}
              fullWidth
              size="lg"
              icon={<Ionicons name="log-in-outline" size={20} color="#FFFFFF" />}
              style={styles.submitBtn}
            />

            {/* Live Cloud Firebase Notice */}
            <View style={styles.firebaseNoticeBox}>
              <View style={styles.firebaseNoticeHeader}>
                <Ionicons name="shield-checkmark" size={15} color={Colors.accent.primary} />
                <Text style={styles.firebaseNoticeTitle}>SECURE FIREBASE AUTHENTICATION</Text>
              </View>
              <Text style={styles.firebaseNoticeDesc}>
                Authentication connects directly to Google Cloud Firebase &amp; Firestore. If you have not registered an officer account yet, create one below.
              </Text>
            </View>

            {/* Registration Footer */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Need official authorization? </Text>
              <Link href="/(auth)/signup" asChild>
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={styles.signupLink}>Create Account</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl * 2,
    paddingTop: Spacing.md,
  },
  opsTicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    alignSelf: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  opsTickerText: {
    fontSize: FontSize.micro + 1,
    fontWeight: '700',
    color: '#FCA5A5',
    letterSpacing: 0.6,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoOrb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.accent.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  logoInner: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: FontSize.xxxl,
    fontWeight: '900',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  appSub: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.10)',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.22)',
    gap: Spacing.xs,
  },
  countryText: {
    fontSize: FontSize.micro + 1,
    fontWeight: '700',
    color: Colors.accent.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  formContainer: {
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  formHeader: {
    marginBottom: Spacing.xl,
  },
  formTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  formDescription: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: 4,
    lineHeight: 18,
  },
  submitBtn: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  firebaseNoticeBox: {
    backgroundColor: '#0A1322',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.20)',
    marginBottom: Spacing.xl,
  },
  firebaseNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  firebaseNoticeTitle: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.accent.primary,
    letterSpacing: 0.8,
  },
  firebaseNoticeDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  footerText: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  signupLink: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.accent.primary,
  },
});
