/**
 * Rescue Teams Coordination Screen — UC03 Steps 51–56 + Alternate/Exception Flows.
 * Armed forces & NGO SAR dispatch, multi-stage mission telemetry, and real-time status transitions.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { TeamStatusBadge, OrganisationBadge } from '@/components/Badge';
import { FormModal } from '@/components/FormModal';
import { EmptyState } from '@/components/EmptyState';
import { MobileNavBar } from '@/components/MobileNavBar';
import { useAuth } from '@/hooks/useAuth';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/colors';
import { SRI_LANKAN_DISTRICTS, ORGANISATION_TYPES } from '@/constants/districts';
import {
  getTeams,
  createTeam,
  dispatchTeam,
  updateTeamStatus,
} from '@/services/rescueTeamService';
import { getActiveEvents } from '@/services/hazardEventService';
import type {
  RescueTeam,
  CreateRescueTeamData,
  HazardEvent,
  TeamStatus,
  OrganisationType,
} from '@/types/resources';

const STATUS_FILTERS: { label: string; value: TeamStatus | 'all' }[] = [
  { label: 'All Units', value: 'all' },
  { label: 'Available', value: 'available' },
  { label: 'Dispatched', value: 'dispatched' },
  { label: 'En Route', value: 'en_route' },
  { label: 'On Site', value: 'on_site' },
  { label: 'Completed', value: 'completed' },
];

const SPECIALISATION_OPTIONS = [
  { label: 'Water / Swift Flood Rescue', value: 'Water / Flood Rescue' },
  { label: 'Landslide Search & Rescue (USAR)', value: 'Landslide Search & Rescue' },
  { label: 'Medical Evacuation & Field Triage', value: 'Medical Evacuation & Triage' },
  { label: 'Helicopter Air-Sea SAR', value: 'Helicopter SAR' },
  { label: 'General Emergency Relief Logistics', value: 'General Disaster Relief' },
];

const STATUS_TRANSITIONS: { [key in TeamStatus]?: { next: TeamStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] } = {
  available: [
    { next: 'dispatched', label: 'Dispatch to Sector', icon: 'paper-plane-outline' },
    { next: 'unavailable', label: 'Flag Maintenance / Rest', icon: 'pause-circle-outline' },
  ],
  dispatched: [
    { next: 'en_route', label: 'Confirm En Route to Site', icon: 'navigate-outline' },
    { next: 'on_site', label: 'Confirm Arrival On Site', icon: 'location-outline' },
    { next: 'available', label: 'Abort & Return to Base', icon: 'return-down-back-outline' },
  ],
  en_route: [
    { next: 'on_site', label: 'Confirm Unit On Site', icon: 'location-outline' },
    { next: 'available', label: 'Mission Cancelled', icon: 'close-circle-outline' },
  ],
  on_site: [
    { next: 'completed', label: 'Mission Accomplished', icon: 'checkmark-done-circle-outline' },
    { next: 'available', label: 'Stand Down & Rest', icon: 'home-outline' },
  ],
  completed: [
    { next: 'available', label: 'Reset to Available Pool', icon: 'refresh-outline' },
  ],
  unavailable: [
    { next: 'available', label: 'Restore Unit Availability', icon: 'play-circle-outline' },
  ],
};

export default function RescueTeamsScreen() {
  const router = useRouter();
  const { state: authState } = useAuth();
  const [teams, setTeams] = useState<RescueTeam[]>([]);
  const [events, setEvents] = useState<HazardEvent[]>([]);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<TeamStatus | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showRegister, setShowRegister] = useState(false);
  const [showDispatch, setShowDispatch] = useState<RescueTeam | null>(null);
  const [showStatusUpdate, setShowStatusUpdate] = useState<RescueTeam | null>(null);

  // Forms
  const [form, setForm] = useState({
    name: '',
    organisationName: '',
    organisationType: 'armed_forces' as OrganisationType,
    memberCount: '',
    specialisation: 'Water / Flood Rescue',
    district: 'Ratnapura',
  });
  const [dispatchLocation, setDispatchLocation] = useState('');
  const [dispatchHazardEventId, setDispatchHazardEventId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [t, e] = await Promise.all([getTeams(), getActiveEvents()]);
      setTeams(t);
      setEvents(e);
      if (e.length > 0 && !dispatchHazardEventId) {
        setDispatchHazardEventId(e[0].id);
      }
    } catch (_error) {
      Alert.alert('Notice', 'Could not refresh rescue units. Please check network.');
    } finally {
      setLoading(false);
    }
  }, [dispatchHazardEventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const resetForm = () => {
    setForm({
      name: '',
      organisationName: '',
      organisationType: 'armed_forces',
      memberCount: '',
      specialisation: 'Water / Flood Rescue',
      district: 'Ratnapura',
    });
  };

  const handleRegister = async () => {
    if (!form.name || !form.organisationName || !form.memberCount || !form.specialisation || !form.district) {
      Alert.alert('Validation Error', 'Please complete all mandatory unit credentials.');
      return;
    }

    const members = parseInt(form.memberCount, 10);
    if (isNaN(members) || members <= 0) {
      Alert.alert('Validation Error', 'Crew personnel count must be a positive number.');
      return;
    }

    setSubmitting(true);
    try {
      const teamData: CreateRescueTeamData = {
        name: form.name.trim(),
        organisationName: form.organisationName.trim(),
        organisationType: form.organisationType,
        memberCount: members,
        specialisation: form.specialisation,
        district: form.district,
      };

      await createTeam(teamData, authState.user?.id || 'officer');
      Alert.alert('SAR Unit Registered', `"${form.name}" has been registered in the response grid.`);
      setShowRegister(false);
      resetForm();
      loadData();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispatch = async () => {
    if (!showDispatch) return;
    if (!dispatchLocation.trim()) {
      Alert.alert('Validation Error', 'Please specify target operational sector.');
      return;
    }

    setSubmitting(true);
    try {
      await dispatchTeam(
        showDispatch.id,
        dispatchLocation.trim(),
        dispatchHazardEventId || (events.length > 0 ? events[0].id : 'event-monsoon-2026'),
      );
      Alert.alert(
        'Unit Dispatched',
        `"${showDispatch.name}" dispatched to "${dispatchLocation.trim()}". Status updated to Dispatched.`,
      );
      setShowDispatch(null);
      setDispatchLocation('');
      loadData();
    } catch (error) {
      Alert.alert('Dispatch Error', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransitionStatus = async (nextStatus: TeamStatus) => {
    if (!showStatusUpdate) return;

    setSubmitting(true);
    try {
      await updateTeamStatus(
        showStatusUpdate.id,
        nextStatus,
      );
      Alert.alert('Status Logged', `Unit status advanced to "${nextStatus.replace('_', ' ').toUpperCase()}".`);
      setShowStatusUpdate(null);
      loadData();
    } catch (error) {
      Alert.alert('Transition Error', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTeams = teams.filter((t) => {
    if (selectedStatusFilter === 'all') return true;
    return t.status === selectedStatusFilter;
  });

  return (
    <ScreenContainer>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Rescue Teams (SAR)</Text>
          <Text style={styles.headerSubtitle}>
            {teams.filter((t) => ['dispatched', 'en_route', 'on_site'].includes(t.status)).length} Active Deployments • Tactical Board
          </Text>
        </View>
        <Button
          title="Add Unit"
          variant="primary"
          size="sm"
          icon={<Ionicons name="add" size={16} color="#FFFFFF" />}
          onPress={() => setShowRegister(true)}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {STATUS_FILTERS.map((tab) => {
            const count = tab.value === 'all'
              ? teams.length
              : teams.filter((t) => t.status === tab.value).length;
            const active = selectedStatusFilter === tab.value;

            return (
              <TouchableOpacity
                key={tab.value}
                onPress={() => setSelectedStatusFilter(tab.value)}
                style={[styles.filterChip, active && styles.filterChipActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {tab.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Teams List */}
      <FlatList
        data={filteredTeams}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent.primary}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              iconName="shield-outline"
              title="No Rescue Units Found"
              message={
                selectedStatusFilter !== 'all'
                  ? `No teams currently with status "${selectedStatusFilter}".`
                  : 'Register a rescue team from Armed Forces or Red Cross.'
              }
              actionTitle="Register SAR Unit"
              onAction={() => setShowRegister(true)}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.teamCard}>
            <View style={styles.cardHeader}>
              <View style={styles.headerLeft}>
                <Text style={styles.teamName}>{item.name}</Text>
                <View style={styles.badgeRow}>
                  <TeamStatusBadge status={item.status} size="sm" />
                  <OrganisationBadge type={item.organisationType} size="sm" />
                </View>
              </View>
              <View style={styles.crewBadge}>
                <Ionicons name="people-outline" size={14} color={Colors.accent.primary} />
                <Text style={styles.crewCount}>{item.memberCount}</Text>
                <Text style={styles.crewLabel}>CREW</Text>
              </View>
            </View>

            {/* Spec & Station Meta */}
            <View style={styles.metaBox}>
              <View style={styles.metaRow}>
                <Ionicons name="business-outline" size={13} color={Colors.text.tertiary} />
                <Text style={styles.metaItem}>
                  Authority: <Text style={styles.metaVal}>{item.organisationName}</Text>
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="location-sharp" size={13} color={Colors.accent.primary} />
                <Text style={styles.metaItem}>
                  Home Depot: <Text style={styles.metaVal}>{item.district} District</Text>
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="flash-outline" size={13} color="#F59E0B" />
                <Text style={styles.metaItem}>
                  Specialisation: <Text style={styles.metaVal}>{item.specialisation}</Text>
                </Text>
              </View>

              {item.assignedLocation ? (
                <View style={styles.deployedSectorBox}>
                  <View style={styles.sectorHeader}>
                    <Ionicons name="navigate" size={12} color={Colors.accent.primary} />
                    <Text style={styles.sectorLabel}>ACTIVE DEPLOYMENT SECTOR</Text>
                  </View>
                  <View style={styles.sectorTargetRow}>
                    <Ionicons name="locate" size={14} color={Colors.accent.primary} />
                    <Text style={styles.sectorTarget}>{item.assignedLocation}</Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* Tactical Actions */}
            <View style={styles.cardActions}>
              {item.status === 'available' ? (
                <Button
                  title="Dispatch Unit to Sector"
                  variant="primary"
                  size="sm"
                  icon={<Ionicons name="paper-plane" size={15} color="#FFFFFF" />}
                  onPress={() => setShowDispatch(item)}
                  style={styles.actionBtn}
                />
              ) : (
                <Button
                  title="Advance Mission Status"
                  variant="outline"
                  size="sm"
                  icon={<Ionicons name="git-branch" size={15} color={Colors.accent.primary} />}
                  onPress={() => setShowStatusUpdate(item)}
                  style={styles.actionBtn}
                />
              )}
            </View>
          </Card>
        )}
      />

      {/* Register Team Modal */}
      <FormModal
        visible={showRegister}
        title="Commission SAR Rescue Unit"
        onClose={() => setShowRegister(false)}
      >
        <Input
          label="Unit Call Sign / Name *"
          placeholder="e.g. SL Army 58th Division Swift Flood Unit"
          value={form.name}
          onChangeText={(v) => setForm({ ...form, name: v })}
          icon={<Ionicons name="shield-outline" size={18} color={Colors.accent.primary} />}
        />
        <Select
          label="Controlling Organization Type *"
          placeholder="Select organisation type"
          value={form.organisationType}
          options={ORGANISATION_TYPES}
          onValueChange={(v) => setForm({ ...form, organisationType: v as OrganisationType })}
        />
        <Input
          label="Organisation Name *"
          placeholder="e.g. Sri Lanka Army / Sri Lanka Navy / Red Cross"
          value={form.organisationName}
          onChangeText={(v) => setForm({ ...form, organisationName: v })}
          icon={<Ionicons name="business-outline" size={18} color={Colors.accent.primary} />}
        />
        <Input
          label="Deployable Personnel (Crew Count) *"
          placeholder="e.g. 18"
          keyboardType="numeric"
          value={form.memberCount}
          onChangeText={(v) => setForm({ ...form, memberCount: v })}
          icon={<Ionicons name="people-outline" size={18} color={Colors.accent.primary} />}
        />
        <Select
          label="Stationing Base District *"
          placeholder="Select home district"
          value={form.district}
          options={SRI_LANKAN_DISTRICTS.map((d) => ({ label: d, value: d }))}
          onValueChange={(v) => setForm({ ...form, district: v })}
        />
        <Select
          label="Operational Specialisation *"
          placeholder="Select specialisation"
          value={form.specialisation}
          options={SPECIALISATION_OPTIONS}
          onValueChange={(v) => setForm({ ...form, specialisation: v })}
        />
        <Button
          title="Commission Unit"
          variant="primary"
          loading={submitting}
          onPress={handleRegister}
          style={styles.modalSubmit}
        />
      </FormModal>

      {/* Dispatch Modal */}
      <FormModal
        visible={!!showDispatch}
        title={`Dispatch: ${showDispatch?.name}`}
        onClose={() => {
          setShowDispatch(null);
          setDispatchLocation('');
        }}
      >
        <View style={styles.dispatchHeaderBox}>
          <Text style={styles.dispatchBoxTitle}>UNIT READINESS</Text>
          <Text style={styles.dispatchBoxVal}>
            {showDispatch?.memberCount} Crew Personnel • {showDispatch?.specialisation}
          </Text>
        </View>

        <Input
          label="Target Deployment Sector / Map Coordinates *"
          placeholder="e.g. Kalu Ganga Ayagama River Bank, Sector 4"
          value={dispatchLocation}
          onChangeText={setDispatchLocation}
          icon={<Ionicons name="location-outline" size={18} color={Colors.accent.primary} />}
        />

        <Select
          label="Designated Hazard Event Association"
          value={dispatchHazardEventId}
          options={events.map((e) => ({
            value: e.id,
            label: e.title,
            description: `${e.affectedDistricts.join(', ')} • ${e.hazardType.toUpperCase()}`,
          }))}
          onSelect={(val) => setDispatchHazardEventId(val)}
        />

        <Button
          title="Confirm Dispatch Order"
          variant="primary"
          loading={submitting}
          onPress={handleDispatch}
          style={styles.modalSubmit}
        />
      </FormModal>

      {/* Advance Status Modal */}
      <FormModal
        visible={!!showStatusUpdate}
        title={`Advance Mission: ${showStatusUpdate?.name}`}
        onClose={() => setShowStatusUpdate(null)}
      >
        <View style={styles.statusCurrentCard}>
          <Text style={styles.statusCurrentLabel}>CURRENT OPERATIONAL STATUS</Text>
          <View style={styles.currentBadgeWrap}>
            {showStatusUpdate && <TeamStatusBadge status={showStatusUpdate.status} size="md" />}
          </View>
          {showStatusUpdate?.assignedLocation && (
            <Text style={styles.currentLocText}>
              Sector: {showStatusUpdate.assignedLocation}
            </Text>
          )}
        </View>

        <Text style={styles.transitionTitle}>SELECT NEXT OPERATIONAL STAGE</Text>

        <View style={styles.transitionList}>
          {showStatusUpdate &&
            STATUS_TRANSITIONS[showStatusUpdate.status]?.map((item) => (
              <TouchableOpacity
                key={item.next}
                onPress={() => handleTransitionStatus(item.next)}
                disabled={submitting}
                style={styles.transitionBtn}
                activeOpacity={0.7}
              >
                <View style={styles.transitionIconBox}>
                  <Ionicons name={item.icon} size={20} color={Colors.accent.primary} />
                </View>
                <View style={styles.transitionContent}>
                  <Text style={styles.transitionLabel}>{item.label}</Text>
                  <Text style={styles.transitionSub}>Advance state to {item.next.toUpperCase()}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.text.tertiary} />
              </TouchableOpacity>
            ))}
        </View>
      </FormModal>

      {/* Floating Bottom Dock */}
      <MobileNavBar />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
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
  headerTitleGroup: {
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
  filterSection: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: '#0F172A',
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: Colors.accent.primary,
  },
  filterChipText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 110,
    gap: Spacing.md,
  },
  teamCard: {
    marginBottom: Spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  teamName: {
    fontSize: FontSize.md + 1,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  crewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  crewCount: {
    fontSize: FontSize.xs,
    fontWeight: '900',
    color: Colors.accent.primary,
  },
  crewLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.text.tertiary,
  },
  metaBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 5,
    marginBottom: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaItem: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    flex: 1,
  },
  metaVal: {
    fontWeight: '700',
    color: Colors.text.primary,
  },
  deployedSectorBox: {
    marginTop: Spacing.xs,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  sectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  sectorLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.accent.primary,
    letterSpacing: 0.5,
  },
  sectorTargetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectorTarget: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  modalSubmit: {
    marginTop: Spacing.lg,
  },
  dispatchHeaderBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    marginBottom: Spacing.md,
  },
  dispatchBoxTitle: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.accent.primary,
    letterSpacing: 0.5,
  },
  dispatchBoxVal: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 2,
  },
  statusCurrentCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  statusCurrentLabel: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  currentBadgeWrap: {
    marginBottom: Spacing.xs,
  },
  currentLocText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },
  transitionTitle: {
    fontSize: FontSize.micro + 1,
    fontWeight: '800',
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  transitionList: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  transitionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  transitionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  transitionContent: {
    flex: 1,
  },
  transitionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  transitionSub: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
});
