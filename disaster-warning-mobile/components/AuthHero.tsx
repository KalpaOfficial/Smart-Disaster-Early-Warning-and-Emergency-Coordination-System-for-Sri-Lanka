import { MobileTypography } from '@/constants/colors';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export function AuthHero({
  registration = false,
  onBack,
  disabled = false,
}: {
  registration?: boolean;
  onBack?: () => void;
  disabled?: boolean;
}) {
  return (
    <LinearGradient
      colors={['#0855D9', '#1265D9', '#2475D5']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View pointerEvents="none" accessible={false} style={styles.orbit} />
      <View pointerEvents="none" accessible={false} style={styles.orbitInner} />
      <View style={styles.brandRow}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
            style={styles.back}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.logo}>
            <Ionicons name="shield-checkmark" size={23} color="#FFFFFF" />
          </View>
        )}
        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>DisasterGuard</Text>
          <Text style={styles.brandCaption}>Safer communities. Together.</Text>
        </View>
      </View>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>
          {registration ? 'JOIN YOUR COMMUNITY' : 'STAY CONNECTED. STAY PREPARED.'}
        </Text>
        <Text accessibilityRole="header" style={styles.title}>
          {registration ? 'A safer tomorrow\nstarts with you.' : 'Ready for what\ncomes next.'}
        </Text>
        <Text style={styles.description}>
          {registration
            ? 'Local alerts and support, right when you need them.'
            : 'Your community. Your updates.\nEverything you need, in one place.'}
        </Text>
      </View>
      <View style={styles.pills}>
        <View style={styles.pill}>
          <Ionicons name="notifications-outline" size={14} color="#FFFFFF" />
          <Text style={styles.pillText}>Local alerts</Text>
        </View>
        <View style={styles.pill}>
          <Ionicons name="people-outline" size={14} color="#FFFFFF" />
          <Text style={styles.pillText}>Community support</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 54,
    overflow: 'hidden',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  orbit: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    right: -160,
    top: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  orbitInner: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 35,
    borderColor: 'rgba(255,255,255,0.05)',
    right: -115,
    top: 86,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandCopy: { flex: 1 },
  brandName: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.6 },
  brandCaption: { color: '#DCEBFF', ...MobileTypography.caption, marginTop: 4 },
  heading: { marginTop: 34 },
  eyebrow: {
    color: '#DCEBFF',
    ...MobileTypography.caption,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 12,
  },
  title: { color: '#FFFFFF', fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1.2 },
  description: { color: '#E4F0FF', ...MobileTypography.body, marginTop: 12, maxWidth: 300 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 22 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  pillText: { color: '#FFFFFF', ...MobileTypography.badge, fontWeight: '500' },
});
