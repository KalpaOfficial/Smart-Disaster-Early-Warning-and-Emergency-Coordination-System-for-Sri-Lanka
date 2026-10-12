import { MobileTypography } from '@/constants/colors';
/** Public citizen registration in the shared light design. */
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
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Input } from '@/components/Input';
import { AuthHero } from '@/components/AuthHero';
import { Select } from '@/components/Select';
import { LightColors } from '@/constants/colors';
import { SRI_LANKAN_DISTRICTS } from '@/constants/districts';

const districtOptions = SRI_LANKAN_DISTRICTS.map(district => ({
  value: district,
  label: district,
}));

export default function SignupScreen() {
  const router = useRouter();
  const { signup } = useAuth();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [district, setDistrict] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clearError = (field: string) => {
    setErrors(current => ({ ...current, [field]: undefined }));
    setRegistrationError(null);
  };

  const handleSignup = async () => {
    if (loading) return;
    const nextErrors: Record<string, string> = {};
    if (!fullName.trim()) nextErrors.fullName = 'Enter your full name.';
    if (!email.trim()) nextErrors.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      nextErrors.email = 'Enter a valid email address.';
    if (!district) nextErrors.district = 'Select your district.';
    const normalizedPhone = phone.replace(/[\s()-]/g, '');
    if (normalizedPhone && !/^(?:0|\+94)\d{9}$/.test(normalizedPhone))
      nextErrors.phone = 'Enter a valid Sri Lankan phone number.';
    if (password.length < 6) nextErrors.password = 'Use at least 6 characters.';
    if (!confirmPassword) nextErrors.confirmPassword = 'Confirm your password.';
    else if (password !== confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.';
    setErrors(nextErrors);
    setRegistrationError(null);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      await signup({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        role: 'citizen',
        district,
        phone: normalizedPhone || undefined,
      });
    } catch (error) {
      setRegistrationError(
        error instanceof Error ? error.message : 'Unable to create your account. Please try again.'
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
            <AuthHero
              registration
              onBack={() => router.replace('/(auth)/login')}
              disabled={loading}
            />

            <View style={styles.card}>
              <View style={styles.heading}>
                <Text accessibilityRole="header" style={styles.title}>
                  Create an account
                </Text>
                <Text style={styles.description}>
                  Join as a citizen. Stay informed and help others.
                </Text>
              </View>

              <View style={styles.formSection}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="person-outline" size={16} color={LightColors.primary} />
                </View>
                <Text style={styles.sectionLabel}>Your details</Text>
              </View>
              <Input
                label="Full name"
                placeholder="Enter your full name"
                appearance="light"
                value={fullName}
                editable={!loading}
                onChangeText={value => {
                  setFullName(value);
                  clearError('fullName');
                }}
                error={errors.fullName}
                autoComplete="name"
                textContentType="name"
                autoCapitalize="words"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => emailRef.current?.focus()}
                icon={<Ionicons name="person-outline" size={19} color={LightColors.mutedText} />}
                containerStyle={styles.field}
              />
              <Input
                label="Email address"
                placeholder="Enter your email address"
                appearance="light"
                inputRef={emailRef}
                value={email}
                editable={!loading}
                onChangeText={value => {
                  setEmail(value);
                  clearError('email');
                }}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="done"
                icon={<Ionicons name="mail-outline" size={19} color={LightColors.mutedText} />}
                containerStyle={styles.field}
              />
              <Select
                label="District"
                placeholder="Select your district"
                appearance="light"
                value={district}
                options={districtOptions}
                disabled={loading}
                onSelect={value => {
                  setDistrict(value);
                  clearError('district');
                }}
                error={errors.district}
                containerStyle={styles.districtField}
              />
              <Text style={styles.fieldHint}>Used to show warnings relevant to your area.</Text>
              <Input
                label="Phone number (optional)"
                placeholder="e.g. 077 123 4567"
                appearance="light"
                value={phone}
                editable={!loading}
                onChangeText={value => {
                  setPhone(value);
                  clearError('phone');
                }}
                error={errors.phone}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                icon={<Ionicons name="call-outline" size={19} color={LightColors.mutedText} />}
                containerStyle={styles.field}
              />
              <View style={styles.formSection}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="lock-closed-outline" size={16} color={LightColors.primary} />
                </View>
                <Text style={styles.sectionLabel}>Account security</Text>
              </View>
              <Input
                label="Password"
                placeholder="At least 6 characters"
                appearance="light"
                inputRef={passwordRef}
                value={password}
                editable={!loading}
                onChangeText={value => {
                  setPassword(value);
                  clearError('password');
                  clearError('confirmPassword');
                }}
                error={errors.password}
                isPassword
                autoComplete="new-password"
                textContentType="newPassword"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => confirmRef.current?.focus()}
                icon={
                  <Ionicons name="lock-closed-outline" size={19} color={LightColors.mutedText} />
                }
                containerStyle={styles.field}
              />
              <Input
                label="Confirm password"
                placeholder="Re-enter your password"
                appearance="light"
                inputRef={confirmRef}
                value={confirmPassword}
                editable={!loading}
                onChangeText={value => {
                  setConfirmPassword(value);
                  clearError('confirmPassword');
                }}
                error={errors.confirmPassword}
                isPassword
                autoComplete="new-password"
                textContentType="newPassword"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleSignup}
                icon={
                  <Ionicons name="lock-closed-outline" size={19} color={LightColors.mutedText} />
                }
                containerStyle={styles.lastField}
              />

              {registrationError && (
                <View
                  style={styles.errorNotice}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                >
                  <Ionicons name="alert-circle-outline" size={19} color={LightColors.danger} />
                  <Text style={styles.errorText}>{registrationError}</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={handleSignup}
                disabled={loading}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={loading ? 'Creating your account' : 'Create citizen account'}
                accessibilityState={{ disabled: loading, busy: loading }}
                style={[styles.submitButton, loading && styles.buttonLoading]}
              >
                {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                <Text style={styles.submitText}>
                  {loading ? 'Creating account...' : 'Create account'}
                </Text>
                {!loading && <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />}
              </TouchableOpacity>
              <View style={styles.divider} />
              <View style={styles.registration}>
                <Text style={styles.registrationText}>Already have an account?</Text>
                <TouchableOpacity
                  onPress={() => router.replace('/(auth)/login')}
                  disabled={loading}
                  activeOpacity={0.7}
                  accessibilityRole="link"
                  style={styles.signInLink}
                >
                  <Text style={styles.signInText}>Sign in</Text>
                  <Ionicons name="chevron-forward" size={14} color={LightColors.primary} />
                </TouchableOpacity>
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
    fontSize: 26,
    lineHeight: 33,
    fontWeight: '700',
    letterSpacing: -0.7,
    marginBottom: 8,
  },
  description: { color: LightColors.secondaryText, ...MobileTypography.body },
  formSection: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: LightColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: { color: LightColors.text, ...MobileTypography.label, fontWeight: '700' },
  field: { marginBottom: 20 },
  districtField: { marginBottom: 7 },
  fieldHint: { color: LightColors.secondaryText, ...MobileTypography.caption, marginBottom: 20 },
  lastField: { marginBottom: 24 },
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
  submitButton: {
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
  submitText: { color: '#FFFFFF', ...MobileTypography.button, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#EDF1F7', marginTop: 28, marginBottom: 16 },
  registration: { alignItems: 'center' },
  registrationText: { color: LightColors.secondaryText, ...MobileTypography.caption },
  signInLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  signInText: { color: LightColors.primary, ...MobileTypography.button, fontWeight: '600' },
});
