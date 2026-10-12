import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MobileTypography } from '@/constants/colors';

export function ReportScreenHero({
  title,
  description,
  caption,
  icon,
  onBack,
  action,
}: {
  title: string;
  description: string;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
  onBack: () => void;
  action?: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void };
}) {
  return (
    <LinearGradient colors={['#0855D9', '#1265D9', '#2475D5']} style={styles.hero}>
      <View style={styles.row}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.caption}>{caption}</Text>
        {action ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={styles.back}
          >
            <Ionicons name={action.icon} size={22} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <Ionicons name={icon} size={25} color="#FFFFFF" />
        )}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 44,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { flex: 1, color: '#DCEBFF', ...MobileTypography.caption, fontWeight: '600' },
  title: { color: '#FFFFFF', fontSize: 29, fontWeight: '800', letterSpacing: -0.8 },
  description: { color: '#E4F0FF', ...MobileTypography.body, marginTop: 10 },
});
