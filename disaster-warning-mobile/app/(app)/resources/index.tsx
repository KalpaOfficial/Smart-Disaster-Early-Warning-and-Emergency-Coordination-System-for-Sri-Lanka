/**
 * Resource Coordination Overview — UC03 Combined Operational Picture.
 * Aggregates real-time telemetry across shelters, rescue units, and relief distribution.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { MobileNavBar } from '@/components/MobileNavBar';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/colors';
import { getActiveEvents } from '@/services/hazardEventService';
import { getShelters } from '@/services/shelterService';
import { getTeams } from '@/services/rescueTeamService';
import { getSupplies } from '@/services/reliefSupplyService';
import type { HazardEvent, Shelter, RescueTeam, ReliefSupply } from '@/types/resources';

export default function ResourceOverviewScreen() {
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
      if (evts.length > 0 && !selectedEvent) {
        setSelectedEvent(evts[0]);
      }

      const [s, t, sup] = await Promise.all([
        getShelters(),
        getTeams(),
        getSupplies(),
      ]);
      setShelters(s);
      setTeams(t);
      setSupplies(sup);
    } catch (_error) {
      Alert.alert('Connection Notice', 'Could not refresh live operational telemetry. Please check network.');
    }
  }, [selectedEvent]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Computed metrics
  const activeShelters = shelters.filter((s) => s.status === 'active' || s.status === 'over_capacity');
  const totalCapacity = activeShelters.reduce((acc, s) => acc + s.capacity, 0);
  const totalOccupancy = activeShelters.reduce((acc, s) => acc + s.currentOccupancy, 0);
  const occupancyPercentage = totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0;

  const deployedTeams = teams.filter((t) => ['dispatched', 'en_route', 'on_site'].includes(t.status));
  const availableTeams = teams.filter((t) => t.status === 'available');

  const totalSupplyItems = supplies.reduce((acc, s) => acc + s.totalQuantity, 0);
  const remainingSupplyItems = supplies.reduce((acc, s) => acc + s.remainingQuantity, 0);

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
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerTextGroup}>
            <Text style={styles.headerTitle}>Combined Picture</Text>
            <Text style={styles.headerSubtitle}>UC03 Unified Resource Coordination</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(app)/resources/seed')}
            style={styles.syncBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color={Colors.accent.primary} />
          </TouchableOpacity>
        </View>

        {/* Active Hazard Event Banner */}
        {selectedEvent ? (
          <LinearGradient
            colors={['#1E2238', '#0F172A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.eventBanner}
          >
            <View style={styles.eventHeader}>
              <View style={styles.hazardBadge}>
                <Ionicons name="warning" size={12} color="#F59E0B" />
                <Text style={styles.hazardBadgeText}>
                  {selectedEvent.hazardType.toUpperCase()} EMERGENCY
                </Text>
              </View>
              <Text style={styles.eventStatusPill}>ACTIVE DISASTER</Text>
            </View>

            <Text style={styles.eventTitle}>{selectedEvent.title}</Text>
            <View style={styles.sectorRow}>
              <Ionicons name="location-sharp" size={13} color={Colors.accent.primary} />
              <Text style={styles.eventDistricts}>
                Sectors: {selectedEvent.affectedDistricts.join(' • ')}
              </Text>
            </View>
          </LinearGradient>
        ) : (
          <Card
            style={styles.noEventCard}
            onPress={() => router.push('/(app)/resources/seed')}
          >
            <Ionicons name="alert-circle-outline" size={32} color={Colors.warning} />
            <Text style={styles.noEventText}>No Active Hazard Event</Text>
            <Text style={styles.noEventHint}>Tap to seed live Sri Lankan disaster telemetry</Text>
          </Card>
        )}

        {/* Event Selector Chips */}
        {events.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eventSelector}>
            {events.map((evt) => (
              <TouchableOpacity
                key={evt.id}
                onPress={() => setSelectedEvent(evt)}
                style={[
                  styles.eventChip,
                  evt.id === selectedEvent?.id && styles.eventChipActive,
                ]}
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
        <Text style={styles.sectionTitle}>AGGREGATED CAPACITY TELEMETRY</Text>

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
              <View style={[styles.percentBadge, { backgroundColor: occupancyPercentage > 90 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)' }]}>
                <Text style={[styles.percentText, { color: occupancyPercentage > 90 ? '#EF4444' : '#10B981' }]}>
                  {occupancyPercentage}% Occupied
                </Text>
              </View>
            </View>
            <Text style={styles.telemetryBigVal}>{activeShelters.length} Shelters</Text>
            <Text style={styles.telemetrySub}>
              {totalOccupancy.toLocaleString()} evacuees in {totalCapacity.toLocaleString()} registered capacity
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
              Sri Lanka Army, Navy RABS, SLAF Helo & Red Cross DRT
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
                  {totalSupplyItems > 0 ? Math.round((remainingSupplyItems / totalSupplyItems) * 100) : 0}% In Stock
                </Text>
              </View>
            </View>
            <Text style={styles.telemetryBigVal}>{remainingSupplyItems.toLocaleString()} Units Remaining</Text>
            <Text style={styles.telemetrySub}>
              {(totalSupplyItems - remainingSupplyItems).toLocaleString()} units distributed across disaster zones
            </Text>
          </Card>
        </View>

        {/* Operational Modules Navigation */}
        <Text style={styles.sectionTitle}>ASSET COORDINATION DOMAINS</Text>

        <Card
          style={styles.navCard}
          onPress={() => router.push('/(app)/resources/shelters')}
        >
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
              <Text style={styles.navDesc}>Safe haven occupancy, facility telemetry & capacity management</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.text.tertiary} />
          </View>
        </Card>

        <Card
          style={styles.navCard}
          onPress={() => router.push('/(app)/resources/rescue-teams')}
        >
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
              <Text style={styles.navDesc}>Tri-forces & NGO tactical fleet dispatch & deployment status</Text>
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
              <Text style={styles.navDesc}>Inventory tracking, warehouse stocks & field distribution logs</Text>
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
    backgroundColor: '#0F172A',
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
    backgroundColor: '#0F172A',
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
    fontSize: 9,
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
    backgroundColor: '#0F172A',
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
    fontSize: FontSize.micro + 1,
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
    fontSize: FontSize.xs,
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
  },
  navTitleRow: {
    flexDirection: 'row',
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
    fontSize: 9,
    fontWeight: '800',
  },
  navDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    lineHeight: 16,
  },
});
