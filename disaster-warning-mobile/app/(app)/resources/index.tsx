import { AppAlert } from '@/utils/appNotice';
import { ReportScreenHero } from '@/components/ReportScreenHero';
/**
 * Resource Coordination Overview — UC03 Combined Operational Picture.
 * Aggregates real-time telemetry across shelters, rescue units, and relief distribution.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenContainer,
  Card,
  MobileNavBar,
  ResourceColors as Colors,
} from '@/components/ResourceComponents';
import { FontSize, Spacing, BorderRadius, LightColors, MobileTypography } from '@/constants/colors';
import { getActiveEvents } from '@/services/hazardEventService';
import { getShelters, onSheltersChanged } from '@/services/shelterService';
import { getTeams, onTeamsChanged } from '@/services/rescueTeamService';
import { getSupplies, onSuppliesChanged } from '@/services/reliefSupplyService';
import { resourceOverview } from '@/utils/resourceOverview';
import type { HazardEvent, Shelter, RescueTeam, ReliefSupply } from '@/types/resources';
import { useAuth } from '@/hooks/useAuth';
import { DistrictDashboard } from '@/components/DistrictDashboard';
import { ShelterDirectory } from '@/components/ShelterDirectory';

export default function ResourceOverviewScreen() {
  const {
    state: { user },
  } = useAuth();
  if (user?.role === 'district_officer') return <DistrictDashboard />;
  if (user?.role === 'citizen' || user?.role === 'volunteer') return <ShelterDirectory />;
  return <CombinedResourceOverview />;
}

function CombinedResourceOverview() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<HazardEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<HazardEvent | null>(null);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [teams, setTeams] = useState<RescueTeam[]>([]);
  const [supplies, setSupplies] = useState<ReliefSupply[]>([]);

  const loadData = useCallback(async () => {
    try {
      const evts = await getActiveEvents();
      setEvents(evts);
      setSelectedEvent(current => evts.find(event => event.id === current?.id) || evts[0] || null);

      const [s, t, sup] = await Promise.all([getShelters(), getTeams(), getSupplies()]);
      setShelters(s);
      setTeams(t);
      setSupplies(sup);
    } catch (_error) {
      AppAlert.alert(
        'Connection Notice',
        'Could not refresh live operational telemetry. Please check network.'
      );
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsubscribe = [
      onSheltersChanged(undefined, setShelters),
      onTeamsChanged(undefined, setTeams),
      onSuppliesChanged(undefined, setSupplies),
    ];
    return () => unsubscribe.forEach(stop => stop());
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Computed metrics
  const {
    activeShelters,
    totalCapacity,
    totalOccupancy,
    occupancyPercentage,
    deployedTeams,
    availableTeams,
    availableSupplyRecords,
    supplyBalances,
    invalidStockRecords,
  } = resourceOverview({ shelters, teams, supplies }, selectedEvent);

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent.primary}
          />
        }
      >
        {/* Screen Header */}
        <View style={{ marginHorizontal: -Spacing.xl, marginTop: -Spacing.sm, marginBottom: 20 }}>
          <ReportScreenHero
            title="Resource overview"
            caption="DMC Officer"
            icon="layers-outline"
            description="Review shelters, rescue teams and relief stock for active events."
            onBack={() => router.back()}
          />
        </View>

        {/* Active Hazard Event Banner */}
        {selectedEvent ? (
          <LinearGradient
            colors={['#EAF2FF', '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.eventBanner}
          >
            <View style={styles.eventHeader}>
              <View style={styles.hazardBadge}>
                <Ionicons name="warning" size={12} color="#F59E0B" />
                <Text style={styles.hazardBadgeText}>
                  {selectedEvent.hazardType.toUpperCase()} EVENT
                </Text>
              </View>
              <Text style={styles.eventStatusPill}>Active event</Text>
            </View>

            <Text style={styles.eventTitle}>{selectedEvent.title}</Text>
            <View style={styles.sectorRow}>
              <Ionicons name="location-sharp" size={13} color={Colors.accent.primary} />
              <Text style={styles.eventDistricts}>
                Districts: {selectedEvent.affectedDistricts.join(' • ')}
              </Text>
            </View>
          </LinearGradient>
        ) : (
          <Card style={styles.noEventCard} onPress={() => router.push('/(app)/warnings/events')}>
            <Ionicons name="alert-circle-outline" size={32} color={Colors.warning} />
            <Text style={styles.noEventText}>No Active Hazard Event</Text>
            <Text style={styles.noEventHint}>
              Create or activate a hazard event to coordinate resources.
            </Text>
          </Card>
        )}

        {/* Event Selector Chips */}
        {events.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.eventSelector}
          >
            {events.map(evt => (
              <TouchableOpacity
                key={evt.id}
                onPress={() => setSelectedEvent(evt)}
                style={[styles.eventChip, evt.id === selectedEvent?.id && styles.eventChipActive]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.eventChipText,
                    evt.id === selectedEvent?.id && styles.eventChipTextActive,
                  ]}
                >
                  {evt.title.split('—')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Aggregated Ops Telemetry Cards */}
        <Text style={styles.sectionTitle}>Resource summary</Text>

        <View style={styles.telemetryCards}>
          {/* Shelters Telemetry */}
          <Card
            style={styles.telemetryCard}
            onPress={() => router.push('/(app)/resources/shelters')}
          >
            <View style={styles.telemetryHeader}>
              <View style={[styles.telemetryIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="home" size={20} color="#10B981" />
              </View>
              <View
                style={[
                  styles.percentBadge,
                  {
                    backgroundColor:
                      occupancyPercentage > 90
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(16, 185, 129, 0.2)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.percentText,
                    { color: occupancyPercentage > 90 ? '#EF4444' : '#10B981' },
                  ]}
                >
                  {occupancyPercentage}% Occupied
                </Text>
              </View>
            </View>
            <Text style={styles.telemetryBigVal}>{activeShelters.length} Shelters</Text>
            <Text style={styles.telemetrySub}>
              {totalOccupancy.toLocaleString()} evacuees in {totalCapacity.toLocaleString()}{' '}
              registered capacity
            </Text>
          </Card>

          {/* Rescue Units Telemetry */}
          <Card
            style={styles.telemetryCard}
            onPress={() => router.push('/(app)/resources/rescue-teams')}
          >
            <View style={styles.telemetryHeader}>
              <View style={[styles.telemetryIcon, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                <Ionicons name="shield-checkmark" size={20} color="#38BDF8" />
              </View>
              <View style={styles.percentBadge}>
                <Text style={[styles.percentText, { color: '#38BDF8' }]}>
                  {availableTeams.length} Standby
                </Text>
              </View>
            </View>
            <Text style={styles.telemetryBigVal}>{deployedTeams.length} Deployed Units</Text>
            <Text style={styles.telemetrySub}>
              Rescue teams currently assigned to active missions.
            </Text>
          </Card>

          {/* Relief Supply Telemetry */}
          <Card
            style={styles.telemetryCard}
            onPress={() => router.push('/(app)/resources/relief-supplies')}
          >
            <View style={styles.telemetryHeader}>
              <View style={[styles.telemetryIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="cube" size={20} color="#F59E0B" />
              </View>
              <View style={styles.percentBadge}>
                <Text style={[styles.percentText, { color: '#F59E0B' }]}>
                  {availableSupplyRecords} Stock items
                </Text>
              </View>
            </View>
            <Text style={styles.telemetryBigVal}>Relief stock by unit</Text>
            {supplyBalances.map(balance => (
              <View key={balance.unit} style={{ paddingVertical: 8 }}>
                <Text style={styles.telemetrySub}>
                  {balance.remaining.toLocaleString()} / {balance.stocked.toLocaleString()}{' '}
                  {balance.unit} available
                </Text>
                <Text style={styles.telemetrySub}>
                  {balance.distributed.toLocaleString()} {balance.unit} distributed
                </Text>
              </View>
            ))}
            {!!invalidStockRecords && (
              <Text style={styles.telemetrySub}>
                {invalidStockRecords} invalid stock balance(s) excluded. Correct the inventory
                records.
              </Text>
            )}
          </Card>
        </View>

        {/* Operational Modules Navigation */}
        <Text style={styles.sectionTitle}>Resource directories</Text>

        <Card style={styles.navCard} onPress={() => router.push('/(app)/resources/shelters')}>
          <View style={styles.navRow}>
            <View style={[styles.navIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="home-outline" size={22} color="#10B981" />
            </View>
            <View style={styles.navContent}>
              <View style={styles.navTitleRow}>
                <Text style={styles.navTitle}>Emergency Shelters</Text>
                <View style={[styles.navBadgePill, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                  <Text style={[styles.navBadgeText, { color: '#10B981' }]}>
                    {shelters.length} REGISTERED
                  </Text>
                </View>
              </View>
              <Text style={styles.navDesc}>
                Safe haven occupancy, facility telemetry & capacity management
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.text.tertiary} />
          </View>
        </Card>

        <Card style={styles.navCard} onPress={() => router.push('/(app)/resources/rescue-teams')}>
          <View style={styles.navRow}>
            <View style={[styles.navIconBox, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
              <Ionicons name="shield-outline" size={22} color="#F43F5E" />
            </View>
            <View style={styles.navContent}>
              <View style={styles.navTitleRow}>
                <Text style={styles.navTitle}>Rescue Teams (SAR)</Text>
                <View style={[styles.navBadgePill, { backgroundColor: 'rgba(244, 63, 94, 0.2)' }]}>
                  <Text style={[styles.navBadgeText, { color: '#F43F5E' }]}>
                    {teams.length} UNITS
                  </Text>
                </View>
              </View>
              <Text style={styles.navDesc}>
                Tri-forces & NGO tactical fleet dispatch & deployment status
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.text.tertiary} />
          </View>
        </Card>

        <Card
          style={styles.navCard}
          onPress={() => router.push('/(app)/resources/relief-supplies')}
        >
          <View style={styles.navRow}>
            <View style={[styles.navIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Ionicons name="cube-outline" size={22} color="#F59E0B" />
            </View>
            <View style={styles.navContent}>
              <View style={styles.navTitleRow}>
                <Text style={styles.navTitle}>Relief Supplies</Text>
                <View style={[styles.navBadgePill, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                  <Text style={[styles.navBadgeText, { color: '#F59E0B' }]}>
                    {supplies.length} COMMODITIES
                  </Text>
                </View>
              </View>
              <Text style={styles.navDesc}>
                Inventory tracking, warehouse stocks & field distribution logs
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.text.tertiary} />
          </View>
        </Card>
      </ScrollView>

      {/* Floating Bottom Dock */}
      <MobileNavBar />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: 110,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: LightColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  syncBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: LightColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  eventBanner: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginBottom: Spacing.lg,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  hazardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hazardBadgeText: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  eventStatusPill: {
    ...MobileTypography.small,
    fontWeight: '800',
    color: Colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  eventTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  sectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventDistricts: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },
  noEventCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  noEventText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  noEventHint: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  eventSelector: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  eventChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  eventChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: Colors.accent.primary,
  },
  eventChipText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  eventChipTextActive: {
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  sectionTitle: {
    ...MobileTypography.section,
    fontWeight: '800',
    color: Colors.text.tertiary,
    letterSpacing: 1.2,
    marginBottom: Spacing.md,
    marginTop: Spacing.xs,
  },
  telemetryCards: {
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  telemetryCard: {
    padding: Spacing.lg,
  },
  telemetryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  telemetryIcon: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentBadge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  percentText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  telemetryBigVal: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  telemetrySub: {
    ...MobileTypography.caption,
    color: Colors.text.tertiary,
  },
  navCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  navIconBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navContent: {
    flex: 1,
    minWidth: 0,
  },
  navTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 2,
  },
  navTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  navBadgePill: {
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
  },
  navBadgeText: {
    ...MobileTypography.small,
    fontWeight: '800',
  },
  navDesc: {
    ...MobileTypography.caption,
    color: Colors.text.tertiary,
  },
});
