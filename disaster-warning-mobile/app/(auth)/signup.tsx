/**
 * Professional Mobile Signup Screen — Operator Registration.
 * Interactive visual role selection cards, 4-stage password strength gauge, and dynamic fields.
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Select } from '@/components/Select';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/colors';
import { SRI_LANKAN_DISTRICTS } from '@/constants/districts';
import type { UserRole } from '@/types/auth';

const ROLES_CONFIG: {
  value: UserRole;
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  {
    value: 'district_officer',
    label: 'District Officer',
    desc: 'Manage district shelters & dispatch teams',
    icon: 'business-outline',
    color: '#38BDF8',
  },
  {
    value: 'dmc_officer',
    label: 'DMC HQ Officer',
    desc: 'National command & combined operational picture',
    icon: 'shield-checkmark-outline',
    color: '#818CF8',
  },
  {
    value: 'volunteer',
    label: 'Relief Volunteer',
    desc: 'Assist in shelter ops & relief distribution',
    icon: 'heart-outline',
    color: '#10B981',
  },
  {
    value: 'citizen',
    label: 'Citizen',
    desc: 'View warnings & locate nearest shelters',
    icon: 'person-outline',
    color: '#F59E0B',
  },
];

export default function SignupScreen() {
  const router = useRouter();
  const { signup } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('district_officer');
  const [district, setDistrict] = useState('Ratnapura');
  const [phone, setPhone] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const showDistrict = role === 'district_officer' || role === 'volunteer';
  const showOrganisation = role === 'dmc_officer' || role === 'volunteer';

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) newErrors.fullName = 'Full official name is required';
    if (!email.trim()) {
      newErrors.email = 'Official email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (showDistrict && !district) newErrors.district = 'Operating district is required';
    if (showOrganisation && !organisation.trim()) {
      newErrors.organisation = 'Official organisation name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await signup({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        role,
        district: district || undefined,
        phone: phone || undefined,
        organisation: organisation.trim() || undefined,
      });
    } catch (error) {
      Alert.alert('Registration Failed', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const districtOptions = SRI_LANKAN_DISTRICTS.map((d) => ({
    value: d,
    label: d,
  }));

  // Password strength logic
  const getPasswordStrength = () => {
    if (!password) return { level: 0, text: '', color: Colors.border.default };
    if (password.length < 6) return { level: 1, text: 'Weak (min 6 chars)', color: Colors.danger };
    if (password.length < 10) return { level: 2, text: 'Moderate', color: Colors.warning };
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasNum = /\d/.test(password);
    if (hasSpecial && hasNum) return { level: 4, text: 'Strong Security', color: Colors.success };
    return { level: 3, text: 'Good', color: '#38BDF8' };
  };

  const strength = getPasswordStrength();

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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>New Operator Account</Text>
              <Text style={styles.headerSub}>Disaster Management Center National Registry</Text>
            </View>
          </View>

          {/* Section 1: Role Selection Cards */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>SELECT OPERATIONAL JURISDICTION</Text>
            <View style={styles.roleGrid}>
              {ROLES_CONFIG.map((r) => {
                const isSelected = role === r.value;
                return (
                  <TouchableOpacity
                    key={r.value}
                    onPress={() => setRole(r.value)}
                    style={[
                      styles.roleItem,
                      isSelected && {
                        borderColor: r.color,
                        backgroundColor: `${r.color}14`,
                      },
                    ]}
                    activeOpacity={0.75}
                  >
                    <View style={styles.roleTopRow}>
                      <View style={[styles.roleIconBox, { backgroundColor: `${r.color}25` }]}>
                        <Ionicons name={r.icon} size={20} color={r.color} />
                      </View>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={20} color={r.color} />
                      ) : (
                        <View style={styles.unselectedRadio} />
                      )}
                    </View>
                    <Text style={styles.roleLabel}>{r.label}</Text>
                    <Text style={styles.roleDesc}>{r.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 2: Personal & Contact Information */}
          <View style={styles.formCard}>
            <Text style={styles.sectionHeader}>OPERATOR CREDENTIALS</Text>

            <Input
              label="Full Name *"
              placeholder="e.g. Bandara Jayasinghe"
              value={fullName}
              onChangeText={(t) => {
                setFullName(t);
                if (errors.fullName) setErrors((e) => ({ ...e, fullName: undefined }));
              }}
              error={errors.fullName}
              icon={<Ionicons name="person-outline" size={18} color={Colors.accent.primary} />}
            />

            <Input
              label="Official Email *"
              placeholder="officer@dmc.gov.lk"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
              }}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              icon={<Ionicons name="mail-outline" size={18} color={Colors.accent.primary} />}
            />

            <Input
              label="Contact Phone"
              placeholder="+94 77 123 4567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              icon={<Ionicons name="call-outline" size={18} color={Colors.accent.primary} />}
            />

            {showDistrict && (
              <Select
                label="Assigned Operating District *"
                value={district}
                options={districtOptions}
                onSelect={(val) => {
                  setDistrict(val);
                  if (errors.district) setErrors((e) => ({ ...e, district: undefined }));
                }}
                error={errors.district}
              />
            )}

            {showOrganisation && (
              <Input
                label="Official Organisation *"
                placeholder="e.g. Sri Lanka Red Cross / DMC HQ"
                value={organisation}
                onChangeText={(t) => {
                  setOrganisation(t);
                  if (errors.organisation) setErrors((e) => ({ ...e, organisation: undefined }));
                }}
                error={errors.organisation}
                icon={<Ionicons name="business-outline" size={18} color={Colors.accent.primary} />}
              />
            )}

            <Input
              label="Security Password *"
              placeholder="Minimum 6 characters"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
              }}
              error={errors.password}
              isPassword
              icon={<Ionicons name="lock-closed-outline" size={18} color={Colors.accent.primary} />}
            />

            {password.length > 0 && (
              <View style={styles.strengthWrapper}>
                <View style={styles.strengthTrack}>
                  <View
                    style={[
                      styles.strengthBar,
                      {
                        width: `${(strength.level / 4) * 100}%`,
                        backgroundColor: strength.color,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.strengthText, { color: strength.color }]}>
                  {strength.text}
                </Text>
              </View>
            )}

            <Input
              label="Confirm Security Password *"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                if (errors.confirmPassword) setErrors((e) => ({ ...e, confirmPassword: undefined }));
              }}
              error={errors.confirmPassword}
              isPassword
              icon={<Ionicons name="lock-closed-outline" size={18} color={Colors.accent.primary} />}
            />

            <Button
              title="Register & Request Verification"
              onPress={handleSignup}
              loading={loading}
              fullWidth
              size="lg"
              icon={<Ionicons name="checkmark-done-outline" size={20} color="#FFFFFF" />}
              style={styles.submitBtn}
            />

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already registered in system? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')} activeOpacity={0.7}>
                <Text style={styles.loginLink}>Sign In Here</Text>
              </TouchableOpacity>
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
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl * 2,
    paddingTop: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    color: Colors.text.primary,
  },
  headerSub: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  sectionCard: {
    backgroundColor: '#0E172A',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: Spacing.xl,
  },
  formCard: {
    backgroundColor: '#0E172A',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    fontSize: FontSize.micro + 1,
    fontWeight: '800',
    color: Colors.text.tertiary,
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  roleGrid: {
    gap: Spacing.sm,
  },
  roleItem: {
    backgroundColor: '#131F38',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  roleTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  roleIconBox: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unselectedRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  roleLabel: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  roleDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    lineHeight: 16,
  },
  strengthWrapper: {
    marginBottom: Spacing.lg,
    marginTop: -Spacing.xs,
  },
  strengthTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  strengthBar: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: FontSize.micro,
    fontWeight: '700',
    textAlign: 'right',
  },
  submitBtn: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
  },
  loginLink: {
    fontSize: FontSize.sm,
    color: Colors.accent.primary,
    fontWeight: '800',
  },
});
