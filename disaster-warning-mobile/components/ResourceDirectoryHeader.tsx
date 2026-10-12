import { MobileTypography } from '@/constants/colors';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LightColors } from '@/constants/colors';
import { Input } from './ResourceComponents';

interface Props {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  children: React.ReactNode;
  action?: { title: string; onPress: () => void };
  secondaryAction?: { title: string; onPress: () => void };
  directoryTitle: string;
  count: number;
  loading: boolean;
}

/** Matches the shelter directory's hero, overlapping filters and list actions. */
export function ResourceDirectoryHeader(props: Props) {
  const router = useRouter();
  return (
    <View>
      <LinearGradient colors={['#0855D9', '#1265D9', '#2475D5']} style={styles.hero}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.push('/(app)')}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerCaption}>Resource coordination</Text>
          <Ionicons name={props.icon} size={25} color="#FFFFFF" />
        </View>
        <Text style={styles.heroTitle}>{props.title}</Text>
        <Text style={styles.heroDescription}>{props.description}</Text>
      </LinearGradient>
      <View style={styles.filters}>
        <Input
          placeholder={props.placeholder}
          value={props.search}
          onChangeText={props.onSearch}
          accessibilityLabel={props.placeholder}
          icon={<Ionicons name="search-outline" size={18} color={LightColors.mutedText} />}
          containerStyle={styles.search}
        />
        {props.children}
      </View>
      <View style={styles.body}>
        {props.action && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={props.action.onPress}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>{props.action.title}</Text>
          </TouchableOpacity>
        )}
        {props.secondaryAction && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={props.secondaryAction.onPress}
            accessibilityRole="button"
          >
            <Ionicons name="receipt-outline" size={17} color={LightColors.primary} />
            <Text style={styles.secondaryButtonText}>{props.secondaryAction.title}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.listHeading}>
          <Text style={styles.sectionTitle}>{props.directoryTitle}</Text>
          <Text style={styles.caption}>{props.loading ? '' : `${props.count} listed`}</Text>
        </View>
      </View>
    </View>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCaption: { flex: 1, color: '#DCEBFF', ...MobileTypography.caption, fontWeight: '600' },
  heroTitle: { color: '#FFFFFF', fontSize: 29, fontWeight: '800', letterSpacing: -0.8 },
  heroDescription: { color: '#E4F0FF', ...MobileTypography.body, marginTop: 10 },
  filters: {
    marginHorizontal: 18,
    marginTop: -24,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderWidth: 1,
    borderColor: LightColors.border,
    shadowColor: '#154893',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
    marginBottom: 18,
  },
  search: { marginBottom: 12 },
  body: { paddingHorizontal: 18 },
  primaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LightColors.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', ...MobileTypography.button },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: LightColors.border,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  secondaryButtonText: {
    flexShrink: 1,
    textAlign: 'center',
    color: LightColors.primary,
    ...MobileTypography.button,
    fontWeight: '600',
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    flexShrink: 1,
    ...MobileTypography.section,
    fontWeight: '700',
    color: LightColors.text,
    marginBottom: 8,
  },
  caption: { ...MobileTypography.caption, color: LightColors.secondaryText },
});
