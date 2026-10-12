import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScreenContainer } from './ScreenContainer';
import { ReportScreenHero } from './ReportScreenHero';
import { MobileNavBar } from './MobileNavBar';
import { FormModal } from './FormModal';
import { EmptyState } from './EmptyState';
import { Input } from './Input';
import { Select } from './Select';
import { LightColors, MobileTypography } from '@/constants/colors';
import { SRI_LANKAN_DISTRICTS } from '@/constants/districts';
import { useAuth } from '@/hooks/useAuth';
import { subscribeToActiveWarnings } from '@/services/warningService';
import { filterCommunityWarnings, warningDistricts } from '@/utils/communityWarnings';
import type { HazardWarning, WarningSeverity } from '@/types/warning';

const LEVELS = {
  evacuation: {
    label: 'Evacuation',
    color: '#C52D3E',
    background: '#FFF0F2',
    icon: 'exit-outline',
  },
  warning: { label: 'Warning', color: '#946000', background: '#FFF2D4', icon: 'warning-outline' },
  advisory: {
    label: 'Advisory',
    color: '#0066CC',
    background: '#EAF2FF',
    icon: 'information-circle-outline',
  },
} as const;

export function CommunityWarnings() {
  const { state } = useAuth();
  const router = useRouter();
  const [warnings, setWarnings] = useState<HazardWarning[]>([]);
  const [district, setDistrict] = useState(state.user?.district || 'all');
  const [severity, setSeverity] = useState<WarningSeverity | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    setLoading(true);
    setFailed(false);
    return subscribeToActiveWarnings(
      items => {
        setWarnings(items);
        setLoading(false);
        setFailed(false);
      },
      () => {
        setFailed(true);
        setLoading(false);
      }
    );
  }, [retry]);
  const displayed = filterCommunityWarnings(warnings, district, severity, search);
  const selected = warnings.find(w => w.id === selectedId);
  const pill = (warning: HazardWarning) => {
    const level = LEVELS[warning.severity] || LEVELS.warning;
    return (
      <View style={[styles.pill, { backgroundColor: level.background }]}>
        <Ionicons name={level.icon} size={16} color={level.color} />
        <Text style={[styles.pillText, { color: level.color }]}>{level.label}</Text>
      </View>
    );
  };
  const date = (warning: HazardWarning) =>
    new Date(warning.dispatchedAt || warning.createdAt).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  return (
    <ScreenContainer style={styles.screen} contentStyle={styles.shell}>
      <StatusBar style="light" />
      <FlatList
        data={failed ? [] : displayed}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <ReportScreenHero
              title="Official warnings"
              caption="Community safety"
              description="Stay informed with hazard warnings issued by the Disaster Management Centre."
              icon="notifications-outline"
              onBack={() => router.push('/(app)')}
            />
            <View style={styles.filters}>
              <Input
                appearance="light"
                placeholder="Search warnings or affected areas"
                value={search}
                onChangeText={setSearch}
                icon={<Ionicons name="search-outline" size={18} color={LightColors.mutedText} />}
              />
              <Select
                appearance="light"
                label="District"
                value={district}
                onSelect={setDistrict}
                options={[
                  { label: 'All districts', value: 'all' },
                  ...SRI_LANKAN_DISTRICTS.map(d => ({ label: d, value: d })),
                ]}
              />
              <View style={styles.tabs}>
                {(['all', 'evacuation', 'warning', 'advisory'] as const).map(level => (
                  <TouchableOpacity
                    key={level}
                    accessibilityRole="button"
                    accessibilityState={{ selected: severity === level }}
                    onPress={() => setSeverity(level)}
                    style={[styles.tab, severity === level && styles.activeTab]}
                  >
                    <Text style={[styles.tabText, severity === level && styles.activeText]}>
                      {level === 'all' ? 'All warnings' : LEVELS[level].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.heading}>
              <Text style={styles.sectionTitle}>Issued warnings</Text>
              <Text style={styles.caption}>
                {loading ? 'Updating...' : `${displayed.length} listed`}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`View warning: ${item.headline}`}
            onPress={() => setSelectedId(item.id)}
            style={styles.card}
          >
            <View style={styles.cardTop}>
              {pill(item)}
              <Text style={styles.official}>DMC official</Text>
            </View>
            <Text style={styles.title}>{item.headline}</Text>
            <Text style={styles.body} numberOfLines={3}>
              {item.instructions}
            </Text>
            <View style={styles.area}>
              <Ionicons name="location-outline" size={16} color={LightColors.primary} />
              <Text style={styles.caption}>
                {item.targetAreas.join(', ') || warningDistricts(item).join(', ')}
              </Text>
            </View>
            <Text style={styles.caption}>Issued {date(item)}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.link}>View warning</Text>
              <Ionicons name="chevron-forward" size={18} color={LightColors.primary} />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={LightColors.primary} size="large" />
          ) : (
            <EmptyState
              appearance="light"
              iconName={failed ? 'cloud-offline-outline' : 'notifications-outline'}
              title={failed ? 'Warnings unavailable' : 'No warnings to show'}
              message={
                failed
                  ? 'We could not load the latest official warnings. Check your connection and try again.'
                  : 'No issued warnings match your filters. You can check other districts or warning levels.'
              }
              actionTitle={failed ? 'Try again' : 'Show all warnings'}
              onAction={() =>
                failed
                  ? setRetry(n => n + 1)
                  : (setDistrict('all'), setSeverity('all'), setSearch(''))
              }
            />
          )
        }
      />
      <MobileNavBar appearance="light" />
      <FormModal
        visible={!!selectedId}
        onClose={() => setSelectedId(null)}
        title="Official warning"
        appearance="light"
      >
        {selected ? (
          <View>
            {pill(selected)}
            <Text style={styles.detailTitle}>{selected.headline}</Text>
            <Text style={styles.sectionTitle}>What you need to do</Text>
            <View style={styles.instructions}>
              <Text style={styles.body}>
                {selected.instructions || 'Follow instructions from your local authorities.'}
              </Text>
            </View>
            <Text style={styles.sectionTitle}>Affected areas</Text>
            <Text style={styles.detailBody}>{selected.targetAreas.join(', ')}</Text>
            <Text style={styles.detailBody}>{warningDistricts(selected).join(', ')}</Text>
            <Text style={styles.sectionTitle}>Issued by</Text>
            <Text style={styles.detailBody}>
              {selected.issuedByName || 'DMC Duty Officer'}
              {'\n'}Disaster Management Centre{'\n'}
              {date(selected)}
            </Text>
          </View>
        ) : (
          <EmptyState
            appearance="light"
            title="Warning no longer active"
            message="This warning has been updated or withdrawn. Check the latest warnings in the list."
          />
        )}
      </FormModal>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  screen: { backgroundColor: '#0855D9' },
  shell: {
    backgroundColor: LightColors.background,
    borderColor: LightColors.border,
    shadowOpacity: 0.06,
  },
  list: { paddingBottom: 110 },
  filters: {
    marginHorizontal: 18,
    marginTop: -24,
    borderRadius: 20,
    backgroundColor: LightColors.surface,
    padding: 14,
    borderWidth: 1,
    borderColor: LightColors.border,
    marginBottom: 18,
    shadowColor: '#154893',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: '#F6F9FD',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  activeTab: { backgroundColor: LightColors.primarySoft },
  tabText: { ...MobileTypography.caption, color: LightColors.secondaryText, fontWeight: '600' },
  activeText: { color: LightColors.primary },
  heading: {
    marginHorizontal: 18,
    marginVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    ...MobileTypography.section,
    color: LightColors.text,
    fontWeight: '700',
    flexShrink: 1,
  },
  caption: { ...MobileTypography.caption, color: LightColors.secondaryText, flexShrink: 1 },
  card: {
    backgroundColor: LightColors.surface,
    marginHorizontal: 18,
    marginBottom: 13,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7EEF8',
  },
  cardTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  pillText: { ...MobileTypography.badge, fontWeight: '700' },
  official: { ...MobileTypography.badge, color: LightColors.primary, fontWeight: '600' },
  title: {
    ...MobileTypography.section,
    fontWeight: '700',
    color: LightColors.text,
    marginBottom: 8,
  },
  body: { ...MobileTypography.body, color: LightColors.text },
  area: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 14, marginBottom: 8 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: LightColors.border,
    paddingTop: 12,
    marginTop: 14,
  },
  link: { ...MobileTypography.label, color: LightColors.primary, fontWeight: '700' },
  loading: { padding: 40 },
  detailTitle: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '800',
    color: LightColors.text,
    marginTop: 16,
    marginBottom: 24,
  },
  instructions: {
    backgroundColor: LightColors.primarySoft,
    padding: 16,
    borderRadius: 14,
    marginTop: 12,
    marginBottom: 24,
  },
  detailBody: {
    ...MobileTypography.body,
    color: LightColors.secondaryText,
    marginTop: 8,
    marginBottom: 20,
  },
});
