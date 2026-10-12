import { MobileTypography } from '@/constants/colors';
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/components/ScreenContainer';
import { MobileNavBar } from '@/components/MobileNavBar';
import { useAuth } from '@/hooks/useAuth';
import { useLogoutConfirmation } from '@/components/LogoutConfirmation';
import { LightColors } from '@/constants/colors';
import { getShelters } from '@/services/shelterService';
import { getTeams } from '@/services/rescueTeamService';
import { getSupplies, getDistributions } from '@/services/reliefSupplyService';
import { getActiveEvents } from '@/services/hazardEventService';
import type {
  Shelter,
  RescueTeam,
  ReliefSupply,
  HazardEvent,
  Distribution,
} from '@/types/resources';

export function DistrictDashboard() {
  const { state } = useAuth();
  const signOut = useLogoutConfirmation();
  const user = state.user;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const requestId = useRef(0);
  const [data, setData] = useState<{
    shelters: Shelter[];
    teams: RescueTeam[];
    supplies: ReliefSupply[];
    events: HazardEvent[];
    distributions: Distribution[];
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    const request = ++requestId.current;
    try {
      const [shelters, teams, supplies, events, distributions] = await Promise.all([
        getShelters(),
        getTeams(),
        getSupplies(),
        getActiveEvents(),
        getDistributions(),
      ]);
      if (request !== requestId.current) return;
      const district = user?.district;
      setData({
        shelters: shelters.filter(s => !district || s.district === district),
        teams: teams.filter(t => !district || t.district === district),
        supplies: supplies.filter(s => !district || s.district === district),
        events: events.filter(e => !district || e.affectedDistricts.includes(district)),
        distributions: distributions.filter(d => !district || d.destinationDistrict === district),
      });
      setFailed(false);
    } catch {
      if (request === requestId.current) setFailed(true);
    }
  }, [user?.district]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        requestId.current += 1;
      };
    }, [load])
  );
  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };
  const actions = [
    {
      title: 'Manage shelters',
      description: 'Register, activate and track occupancy',
      icon: 'business-outline' as const,
      route: '/(app)/resources/shelters',
      color: '#0066FF',
      background: '#EAF2FF',
    },
    {
      title: 'Rescue teams',
      description: 'Dispatch teams and update their status',
      icon: 'shield-checkmark-outline' as const,
      route: '/(app)/resources/rescue-teams',
      color: '#0A9560',
      background: '#E6F7ED',
    },
    {
      title: 'Relief supplies',
      description: 'Manage stock and record distributions',
      icon: 'cube-outline' as const,
      route: '/(app)/resources/relief-supplies',
      color: '#A56A00',
      background: '#FFF2D5',
    },
  ];
  const metrics = [
    {
      label: 'Open shelters',
      value: data?.shelters.filter(s => s.status === 'active' && s.currentOccupancy < s.capacity)
        .length,
      icon: 'home-outline' as const,
      color: '#0066FF',
      route: actions[0].route,
    },
    {
      label: 'Shelter occupants',
      value: data?.shelters.reduce((total, s) => total + s.currentOccupancy, 0),
      icon: 'people-outline' as const,
      color: '#0A9560',
      route: actions[0].route,
    },
    {
      label: 'Available teams',
      value: data?.teams.filter(t => t.status === 'available').length,
      icon: 'shield-outline' as const,
      color: '#7655CF',
      route: actions[1].route,
    },
    {
      label: 'Stock items',
      value: data?.supplies.filter(s => s.remainingQuantity > 0 && s.availability !== 'withdrawn')
        .length,
      icon: 'cube-outline' as const,
      color: '#A56A00',
      route: actions[2].route,
    },
  ];
  return (
    <ScreenContainer style={styles.screen} contentStyle={styles.shell}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={LightColors.primary}
          />
        }
      >
        <LinearGradient colors={['#0855D9', '#1265D9', '#2475D5']} style={styles.hero}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.brand}>DisasterGuard</Text>
              <Text style={styles.caption}>
                District Officer / {user?.district || 'Resource coordination'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={signOut}
              style={styles.logout}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.welcome}>Hello, {user?.fullName?.split(' ')[0] || 'Officer'}</Text>
          <Text style={styles.title}>Coordinate your response.</Text>
          <Text style={styles.description}>
            Shelters, rescue teams and relief support for your district.
          </Text>
        </LinearGradient>
        <View style={styles.metrics}>
          {metrics.map(m => (
            <TouchableOpacity
              key={m.label}
              style={styles.metric}
              onPress={() => router.push(m.route as never)}
              accessibilityRole="button"
            >
              <View style={styles.metricTop}>
                <View style={styles.metricIcon}>
                  <Ionicons name={m.icon} size={22} color={m.color} />
                </View>
                <Text style={styles.value}>{failed ? '--' : (m.value ?? '--')}</Text>
              </View>
              <Text style={styles.metricLabel}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.body}>
          {failed && (
            <View style={styles.notice}>
              <Text style={styles.secondary}>
                Could not refresh resources. Pull down to try again.
              </Text>
            </View>
          )}
          {!data && !failed && <ActivityIndicator color={LightColors.primary} />}
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.actions}>
            {actions.map((a, index) => (
              <View key={a.title}>
                {index > 0 && <View style={styles.divider} />}
                <TouchableOpacity
                  style={styles.action}
                  onPress={() => router.push(a.route as never)}
                  accessibilityRole="button"
                >
                  <View style={[styles.actionIcon, { backgroundColor: a.background }]}>
                    <Ionicons name={a.icon} size={23} color={a.color} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.actionTitle}>{a.title}</Text>
                    <Text style={styles.secondary}>{a.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={LightColors.mutedText} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <Text style={styles.sectionTitle}>Active events</Text>
          <View style={styles.panel}>
            {data?.events.length ? (
              data.events.map(event => (
                <TouchableOpacity
                  key={event.id}
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/warnings/[eventId]',
                      params: { eventId: event.id },
                    })
                  }
                  style={styles.eventRow}
                  accessibilityRole="button"
                >
                  <View style={styles.actionIcon}>
                    <Ionicons name="warning-outline" size={22} color={LightColors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.actionTitle}>{event.title}</Text>
                    <Text style={styles.secondary}>{event.affectedDistricts.join(', ')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={LightColors.mutedText} />
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.secondary}>
                {failed
                  ? 'Event information unavailable.'
                  : data
                    ? 'No active events are listed for your district.'
                    : 'Loading events...'}
              </Text>
            )}
          </View>
          {!!data?.shelters.some(s => s.status === 'over_capacity') && (
            <TouchableOpacity
              style={styles.alert}
              onPress={() => router.push('/(app)/resources/shelters')}
              accessibilityRole="button"
            >
              <Ionicons name="alert-circle-outline" size={23} color={LightColors.danger} />
              <View style={styles.flex}>
                <Text style={styles.alertTitle}>Shelter capacity needs attention</Text>
                <Text style={styles.secondary}>Review occupancy and arrange additional space.</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={LightColors.danger} />
            </TouchableOpacity>
          )}
          <Text style={styles.sectionTitle}>Recent distributions</Text>
          <View style={styles.panel}>
            {data?.distributions.length ? (
              data.distributions.slice(0, 3).map(d => (
                <View key={d.id} style={styles.distribution}>
                  <Text style={styles.actionTitle}>{d.supplyName}</Text>
                  <Text style={styles.secondary}>
                    {d.quantity} {d.unit} / {d.destinationLocation}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.secondary}>
                {failed
                  ? 'Distribution history unavailable.'
                  : data
                    ? 'Your district distribution records will appear here.'
                    : 'Loading distributions...'}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
      <MobileNavBar appearance="light" />
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
  hero: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 56,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  caption: { color: '#DCEBFF', ...MobileTypography.caption, marginTop: 4 },
  logout: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  welcome: { color: '#DCEBFF', ...MobileTypography.caption, marginBottom: 7 },
  title: { color: '#FFFFFF', fontSize: 27, fontWeight: '800', letterSpacing: -0.7 },
  description: { color: '#E4F0FF', ...MobileTypography.body, marginTop: 10 },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 20,
    marginTop: -32,
    marginBottom: 26,
  },
  metric: {
    flexBasis: '46%',
    flexGrow: 1,
    minHeight: 112,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7EEF8',
    shadowColor: '#154893',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  metricIcon: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
  metricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  value: { color: LightColors.text, fontSize: 24, fontWeight: '800' },
  metricLabel: { color: LightColors.secondaryText, ...MobileTypography.caption, marginTop: 3 },
  body: { paddingHorizontal: 20 },
  sectionTitle: {
    color: LightColors.text,
    ...MobileTypography.section,
    fontWeight: '700',
    marginBottom: 12,
  },
  actions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LightColors.border,
    marginBottom: 26,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 86 },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: LightColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    color: LightColors.text,
    ...MobileTypography.body,
    fontWeight: '700',
    marginBottom: 4,
  },
  secondary: { color: LightColors.secondaryText, ...MobileTypography.caption },
  divider: { height: 1, backgroundColor: '#EDF2F8', marginHorizontal: 16 },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LightColors.border,
    padding: 16,
    marginBottom: 24,
  },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  distribution: { paddingVertical: 9 },
  notice: {
    backgroundColor: LightColors.primarySoft,
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: LightColors.dangerSoft,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  alertTitle: {
    color: LightColors.danger,
    ...MobileTypography.body,
    fontWeight: '700',
    marginBottom: 5,
  },
});
