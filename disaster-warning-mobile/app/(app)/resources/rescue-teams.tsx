import { AppAlert } from '@/utils/appNotice';
import { useFormFeedback } from '@/hooks/useFormFeedback';
import {
  requiredFields,
  positiveQuantityError,
  officerDistrictError,
} from '@/utils/formValidation';
import { FormError } from '@/components/FormError';
import { MobileTypography } from '@/constants/colors';
import { ResourceColors as Colors } from '@/components/ResourceComponents';
import { ResourceDirectoryHeader } from '@/components/ResourceDirectoryHeader';
import { canCoordinateResources } from '@/constants/resourcePermissions';
/**
 * Rescue Teams Coordination Screen — UC03 Steps 51–56 + Alternate/Exception Flows.
 * Armed forces & NGO SAR dispatch, multi-stage mission telemetry, and real-time status transitions.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ResourceComponents';
import { Card } from '@/components/ResourceComponents';
import { Button } from '@/components/ResourceComponents';
import { Input } from '@/components/ResourceComponents';
import { Select } from '@/components/ResourceComponents';
import { StatusBar } from 'expo-status-bar';
import { FormModal } from '@/components/ResourceComponents';
import { EmptyState } from '@/components/ResourceComponents';
import { MobileNavBar } from '@/components/ResourceComponents';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius } from '@/constants/colors';
import { SRI_LANKAN_DISTRICTS, ORGANISATION_TYPES } from '@/constants/districts';
import { getTeams, createTeam, dispatchTeam, updateTeamStatus } from '@/services/rescueTeamService';
import { getActiveEvents } from '@/services/hazardEventService';
import { filterRescueTeams, registeredTeamFilters } from '@/utils/rescueTeamDirectory';
import type {
  RescueTeam,
  CreateRescueTeamData,
  HazardEvent,
  TeamStatus,
  OrganisationType,
} from '@/types/resources';

const STATUS_FILTERS: { label: string; value: TeamStatus | 'all' }[] = [
  { label: 'All teams', value: 'all' },
  { label: 'Available', value: 'available' },
  { label: 'Dispatched', value: 'dispatched' },
  { label: 'En Route', value: 'en_route' },
  { label: 'On Site', value: 'on_site' },
  { label: 'Completed', value: 'completed' },
  { label: 'Unavailable', value: 'unavailable' },
];

const TEAM_STATUS_THEME: Record<TeamStatus, { label: string; color: string; background: string }> =
  {
    available: { label: 'Available', color: '#07834B', background: '#E5F7ED' },
    dispatched: { label: 'Dispatched', color: '#075ADB', background: '#EAF2FF' },
    en_route: { label: 'En route', color: '#A85E00', background: '#FFF4DF' },
    on_site: { label: 'On site', color: '#087E99', background: '#E4F6FA' },
    completed: { label: 'Completed', color: '#07834B', background: '#E5F7ED' },
    unavailable: { label: 'Unavailable', color: '#B43545', background: '#FFF0F2' },
  };

function TeamStatusPill({ status }: { status: TeamStatus }) {
  const theme = TEAM_STATUS_THEME[status];
  return (
    <View style={[styles.statusPill, { backgroundColor: theme.background }]}>
      <View style={[styles.statusDot, { backgroundColor: theme.color }]} />
      <Text style={[styles.statusText, { color: theme.color }]}>{theme.label}</Text>
    </View>
  );
}

const SPECIALISATION_OPTIONS = [
  { label: 'Water / Swift Flood Rescue', value: 'Water / Flood Rescue' },
  { label: 'Landslide Search & Rescue (USAR)', value: 'Landslide Search & Rescue' },
  { label: 'Medical Evacuation & Field Triage', value: 'Medical Evacuation & Triage' },
  { label: 'Helicopter Air-Sea SAR', value: 'Helicopter SAR' },
  { label: 'General Emergency Relief Logistics', value: 'General Disaster Relief' },
];

const STATUS_TRANSITIONS: {
  [key in TeamStatus]?: { next: TeamStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[];
} = {
  available: [
    { next: 'dispatched', label: 'Dispatch team', icon: 'paper-plane-outline' },
    { next: 'unavailable', label: 'Mark unavailable', icon: 'pause-circle-outline' },
  ],
  dispatched: [
    { next: 'en_route', label: 'Mark en route', icon: 'navigate-outline' },
    { next: 'on_site', label: 'Confirm arrival', icon: 'location-outline' },
    { next: 'available', label: 'Cancel deployment', icon: 'return-down-back-outline' },
    { next: 'unavailable', label: 'Withdraw team', icon: 'pause-circle-outline' },
  ],
  en_route: [
    { next: 'on_site', label: 'Confirm arrival', icon: 'location-outline' },
    { next: 'available', label: 'Cancel deployment', icon: 'close-circle-outline' },
    { next: 'unavailable', label: 'Withdraw team', icon: 'pause-circle-outline' },
  ],
  on_site: [
    { next: 'completed', label: 'Complete mission', icon: 'checkmark-done-circle-outline' },
    { next: 'available', label: 'Return to available', icon: 'home-outline' },
    { next: 'unavailable', label: 'Withdraw team', icon: 'pause-circle-outline' },
  ],
  completed: [
    { next: 'available', label: 'Mark available', icon: 'refresh-outline' },
    { next: 'unavailable', label: 'Withdraw team', icon: 'pause-circle-outline' },
  ],
  unavailable: [{ next: 'available', label: 'Mark available', icon: 'play-circle-outline' }],
};

export default function RescueTeamsScreen() {
  const compact = useWindowDimensions().width < 380;
  const { state: authState } = useAuth();
  const canManage = canCoordinateResources(authState.user?.role);
  const scopeDistrict = canManage ? authState.user?.district : undefined;
  const [teams, setTeams] = useState<RescueTeam[]>([]);
  const [events, setEvents] = useState<HazardEvent[]>([]);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<TeamStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState(authState.user?.district || '');
  const [organisationFilter, setOrganisationFilter] = useState('');
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
    district: authState.user?.district || '',
  });
  const [dispatchLocation, setDispatchLocation] = useState('');
  const [dispatchHazardEventId, setDispatchHazardEventId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const registrationLock = useRef(false);
  const loadRequest = useRef(0);
  const registration = useFormFeedback(form, showRegister);
  const { error: registerError, setError: setRegisterError } = registration;
  const dispatch = useFormFeedback(
    { location: dispatchLocation, eventId: dispatchHazardEventId },
    showDispatch?.id
  );
  const statusFeedback = useFormFeedback({}, showStatusUpdate?.id);
  const [loadError, setLoadError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!success) return;
    const timeout = setTimeout(() => setSuccess(''), 5000);
    return () => clearTimeout(timeout);
  }, [success]);

  const loadData = useCallback(async () => {
    const request = ++loadRequest.current;
    try {
      const [teamResult, eventResult] = await Promise.allSettled([getTeams(), getActiveEvents()]);
      if (request !== loadRequest.current) return;
      if (teamResult.status === 'fulfilled') {
        setTeams(teamResult.value);
        setLoadError('');
      } else {
        setLoadError('Could not refresh rescue teams. Pull down to retry.');
      }
      if (eventResult.status === 'fulfilled') {
        const districtEvents = eventResult.value.filter(
          event => !scopeDistrict || event.affectedDistricts.includes(scopeDistrict)
        );
        setEvents(districtEvents);
        setDispatchHazardEventId(current =>
          districtEvents.some(event => event.id === current) ? current : districtEvents[0]?.id || ''
        );
      } else {
        setEvents([]);
        setDispatchHazardEventId('');
        setLoadError(
          current =>
            current ||
            'Teams loaded. Hazard events could not be refreshed; pull down to retry before dispatching.'
        );
      }
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  }, [scopeDistrict]);

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
      district: authState.user?.district || '',
    });
  };

  const handleRegister = async () => {
    if (!canManage || !authState.user || registrationLock.current) return;
    setRegisterError('');
    const errors = requiredFields(form, {
      name: 'Team name',
      organisationName: 'Organisation name',
      memberCount: 'Number of members',
      specialisation: 'Specialisation',
      district: 'District',
      organisationType: 'Organisation type',
    });
    const countError = positiveQuantityError(form.memberCount, 'Number of members');
    if (countError) errors.memberCount = countError;
    const districtError = officerDistrictError(form.district, scopeDistrict);
    if (districtError) errors.district = districtError;
    registration.setErrors(errors);
    if (Object.keys(errors).length) return;
    const members = Number(form.memberCount);

    registrationLock.current = true;
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

      const id = await createTeam(teamData, authState.user.id);
      const savedTeam: RescueTeam = {
        ...teamData,
        id,
        status: 'available',
        createdBy: authState.user.id,
        createdAt: new Date().toISOString(),
        assignedLocation: '',
        hazardEventId: '',
        lastStatusUpdate: '',
      };
      setTeams(current => [savedTeam, ...current.filter(team => team.id !== id)]);
      const filters = registeredTeamFilters(savedTeam);
      setSearch(filters.search);
      setDistrictFilter(filters.district);
      setOrganisationFilter(filters.organisation);
      setSelectedStatusFilter(filters.status);
      setSuccess(`"${teamData.name}" registered and available in ${teamData.district}.`);
      setShowRegister(false);
      resetForm();
      await loadData();
    } catch (error) {
      setRegisterError(
        error instanceof Error ? error.message : 'Could not register the team. Please try again.'
      );
    } finally {
      registrationLock.current = false;
      setSubmitting(false);
    }
  };

  const handleDispatch = async () => {
    if (!canManage || submitting) return;
    if (!showDispatch) return;
    dispatch.setError('');
    const errors = requiredFields(
      { location: dispatchLocation, eventId: dispatchHazardEventId },
      { location: 'Response location', eventId: 'Active hazard event' }
    );
    const event = events.find(event => event.id === dispatchHazardEventId);
    if (!event) errors.eventId = `Select an active hazard event covering ${showDispatch.district}.`;
    else if (!event.affectedDistricts.includes(showDispatch.district))
      errors.eventId = `This event covers ${event.affectedDistricts.join(', ')}, but this rescue team belongs to ${showDispatch.district}. Select an event covering ${showDispatch.district}.`;
    dispatch.setErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      await dispatchTeam(showDispatch.id, dispatchLocation.trim(), dispatchHazardEventId);
      AppAlert.alert(
        'Unit Dispatched',
        `"${showDispatch.name}" dispatched to "${dispatchLocation.trim()}". Status updated to Dispatched.`
      );
      setShowDispatch(null);
      setDispatchLocation('');
      loadData();
    } catch (error) {
      dispatch.setError(
        (error as Error).message || 'Could not dispatch the team. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransitionStatus = async (nextStatus: TeamStatus) => {
    if (!canManage || submitting) return;
    if (!showStatusUpdate) return;
    if (nextStatus === 'dispatched') {
      setShowDispatch(showStatusUpdate);
      setShowStatusUpdate(null);
      return;
    }

    setSubmitting(true);
    try {
      await updateTeamStatus(showStatusUpdate.id, nextStatus);
      AppAlert.alert(
        'Status Logged',
        `Unit status advanced to "${nextStatus.replace('_', ' ').toUpperCase()}".`
      );
      setShowStatusUpdate(null);
      loadData();
    } catch (error) {
      statusFeedback.setError((error as Error).message || 'Could not update the team status.');
    } finally {
      setSubmitting(false);
    }
  };

  const scopedTeams = filterRescueTeams(teams, {
    search,
    district: districtFilter,
    organisation: organisationFilter,
    status: 'all',
  });
  const filteredTeams = scopedTeams.filter(
    team => selectedStatusFilter === 'all' || team.status === selectedStatusFilter
  );

  return (
    <ScreenContainer>
      <StatusBar style="light" />
      {/* Teams List */}
      <FlatList
        showsVerticalScrollIndicator={false}
        data={filteredTeams}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          <ResourceDirectoryHeader
            title={canManage ? 'Manage rescue teams' : 'Rescue teams'}
            description="Register, dispatch and monitor rescue teams."
            icon="shield-outline"
            search={search}
            onSearch={setSearch}
            placeholder="Search team, organisation or response location"
            action={
              canManage
                ? {
                    title: 'Register rescue team',
                    onPress: () => {
                      setRegisterError('');
                      setShowRegister(true);
                    },
                  }
                : undefined
            }

            directoryTitle="Rescue team directory"
            count={filteredTeams.length}
            loading={loading}
          >
            {!!success && (
              <Text style={styles.successMessage} accessibilityLiveRegion="polite">
                {success}
              </Text>
            )}
            {!!loadError && (
              <Text style={styles.errorMessage} accessibilityLiveRegion="polite">
                {loadError}
              </Text>
            )}
            <View style={[styles.filterRow, compact && { flexDirection: 'column' }]}>
              <Select
                value={districtFilter}
                onSelect={setDistrictFilter}
                options={[
                  { value: '', label: 'All districts' },
                  ...SRI_LANKAN_DISTRICTS.map(d => ({ value: d, label: d })),
                ]}
                containerStyle={styles.filterSelect}
              />
              <Select
                value={organisationFilter}
                onSelect={setOrganisationFilter}
                options={[{ value: '', label: 'Any organisation' }, ...ORGANISATION_TYPES]}
                containerStyle={styles.filterSelect}
              />
            </View>
            <View style={styles.tabs}>
              {STATUS_FILTERS.map(tab => {
                const count =
                  tab.value === 'all'
                    ? scopedTeams.length
                    : scopedTeams.filter(item => item.status === tab.value).length;
                const active = selectedStatusFilter === tab.value;
                return (
                  <TouchableOpacity
                    key={tab.value}
                    onPress={() => setSelectedStatusFilter(tab.value)}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {tab.label} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ResourceDirectoryHeader>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent.primary}
          />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 30 }} color={Colors.accent.primary} />
          ) : (
            <EmptyState
              iconName="shield-outline"
              title="No rescue teams yet"
              message={
                selectedStatusFilter !== 'all'
                  ? `No teams currently with status "${selectedStatusFilter}".`
                  : canManage
                    ? 'Add a team to start coordinating rescue operations.'
                    : 'Registered rescue teams will appear here.'
              }
              actionTitle={canManage ? 'Add team' : undefined}
              onAction={canManage ? () => setShowRegister(true) : undefined}
            />
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.teamCard}>
            <View style={styles.cardHeader}>
              <View style={styles.resourceIcon}>
                <Ionicons name="shield-outline" size={23} color={Colors.accent.primary} />
              </View>
              <View style={styles.headerLeft}>
                <Text style={styles.teamName}>{item.name}</Text>
                <Text style={styles.cardCaption}>{item.district}</Text>
              </View>
            </View>
            <View style={styles.badgeRow}>
              <View style={styles.crewBadge}>
                <Ionicons name="people-outline" size={14} color={Colors.accent.primary} />
                <Text style={styles.crewCount}>{item.memberCount}</Text>
                <Text style={styles.crewLabel}>members</Text>
              </View>
              <TeamStatusPill status={item.status} />
              <View style={styles.organisationPill}>
                <Text style={styles.organisationText}>
                  {ORGANISATION_TYPES.find(type => type.value === item.organisationType)?.label ||
                    item.organisationType}
                </Text>
              </View>
            </View>

            {/* Spec & Station Meta */}
            <View style={styles.metaBox}>
              <View style={styles.metaRow}>
                <Ionicons name="business-outline" size={13} color={Colors.text.tertiary} />
                <Text style={styles.metaItem}>
                  Organisation: <Text style={styles.metaVal}>{item.organisationName}</Text>
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="location-sharp" size={13} color={Colors.accent.primary} />
                <Text style={styles.metaItem}>
                  District: <Text style={styles.metaVal}>{item.district}</Text>
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
                    <Text style={styles.sectorLabel}>Response location</Text>
                  </View>
                  <View style={styles.sectorTargetRow}>
                    <Ionicons name="locate" size={14} color={Colors.accent.primary} />
                    <Text style={styles.sectorTarget}>{item.assignedLocation}</Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* Tactical Actions */}
            {canManage && (
              <View style={styles.cardActions}>
                {item.status === 'available' ? (
                  <Button
                    title="Dispatch team"
                    variant="primary"
                    size="sm"
                    icon={<Ionicons name="paper-plane" size={15} color="#FFFFFF" />}
                    onPress={() => setShowDispatch(item)}
                    style={styles.actionBtn}
                  />
                ) : (
                  <Button
                    title="Update team status"
                    variant="outline"
                    size="sm"
                    icon={<Ionicons name="git-branch" size={15} color={Colors.accent.primary} />}
                    onPress={() => setShowStatusUpdate(item)}
                    style={styles.actionBtn}
                  />
                )}
                {item.status === 'available' && (
                  <Button
                    title="Update status"
                    variant="outline"
                    size="sm"
                    onPress={() => setShowStatusUpdate(item)}
                    style={styles.actionBtn}
                  />
                )}
              </View>
            )}
          </Card>
        )}
      />

      {/* Register Team Modal */}
      <FormModal
        visible={canManage && showRegister}
        title="Add rescue team"
        feedbackKey={registration.attempt}
        onClose={() => setShowRegister(false)}
      >
        {!!registerError && (
          <Text style={styles.errorMessage} accessibilityRole="alert">
            {registerError}
          </Text>
        )}
        <Input
          label="Team name *"
          error={registration.errors.name}
          placeholder="e.g. SL Army 58th Division Swift Flood Unit"
          value={form.name}
          onChangeText={v => setForm({ ...form, name: v })}
          icon={<Ionicons name="shield-outline" size={18} color={Colors.accent.primary} />}
        />
        <Select
          label="Organisation type *"
          error={registration.errors.organisationType}
          placeholder="Select organisation type"
          value={form.organisationType}
          options={ORGANISATION_TYPES}
          onValueChange={v => setForm({ ...form, organisationType: v as OrganisationType })}
        />
        <Input
          label="Organisation Name *"
          error={registration.errors.organisationName}
          placeholder="e.g. Sri Lanka Army / Sri Lanka Navy / Red Cross"
          value={form.organisationName}
          onChangeText={v => setForm({ ...form, organisationName: v })}
          icon={<Ionicons name="business-outline" size={18} color={Colors.accent.primary} />}
        />
        <Input
          label="Number of members *"
          error={registration.errors.memberCount}
          placeholder="e.g. 18"
          keyboardType="numeric"
          value={form.memberCount}
          onChangeText={v => setForm({ ...form, memberCount: v })}
          icon={<Ionicons name="people-outline" size={18} color={Colors.accent.primary} />}
        />
        <Select
          label="District *"
          error={registration.errors.district || officerDistrictError(form.district, scopeDistrict)}
          placeholder="Select home district"
          value={form.district}
          options={SRI_LANKAN_DISTRICTS.map(d => ({ label: d, value: d }))}
          onValueChange={v => setForm({ ...form, district: v })}
        />
        <Select
          label="Specialisation *"
          error={registration.errors.specialisation}
          placeholder="Select specialisation"
          value={form.specialisation}
          options={SPECIALISATION_OPTIONS}
          onValueChange={v => setForm({ ...form, specialisation: v })}
        />
        <Button
          title="Add team"
          variant="primary"
          loading={submitting}
          onPress={handleRegister}
          style={styles.modalSubmit}
        />
      </FormModal>

      {/* Dispatch Modal */}
      <FormModal
        visible={canManage && !!showDispatch}
        title={`Dispatch: ${showDispatch?.name}`}
        feedbackKey={dispatch.attempt}
        onClose={() => {
          setShowDispatch(null);
          setDispatchLocation('');
        }}
      >
        <View style={styles.dispatchHeaderBox}>
          <Text style={styles.dispatchBoxTitle}>Team details</Text>
          <Text style={styles.dispatchBoxVal}>
            {showDispatch?.memberCount} members • {showDispatch?.specialisation}
          </Text>
        </View>
        <FormError message={dispatch.error} />

        <Input
          label="Response location *"
          error={dispatch.errors.location}
          placeholder="e.g. Kalu Ganga Ayagama River Bank, Sector 4"
          value={dispatchLocation}
          onChangeText={setDispatchLocation}
          icon={<Ionicons name="location-outline" size={18} color={Colors.accent.primary} />}
        />

        <Select
          label="Active hazard event *"
          error={dispatch.errors.eventId}
          value={dispatchHazardEventId}
          options={events.map(e => ({
            value: e.id,
            label: e.title,
            description: `${e.affectedDistricts.join(', ')} • ${e.hazardType.toUpperCase()}`,
          }))}
          onSelect={val => setDispatchHazardEventId(val)}
        />

        <Button
          title="Dispatch team"
          variant="primary"
          loading={submitting}
          onPress={handleDispatch}
          style={styles.modalSubmit}
        />
      </FormModal>

      {/* Advance Status Modal */}
      <FormModal
        visible={canManage && !!showStatusUpdate}
        title="Update team status"
        feedbackKey={statusFeedback.attempt}
        onClose={() => setShowStatusUpdate(null)}
      >
        <View style={styles.statusCurrentCard}>
          <Text style={styles.statusCurrentLabel}>{showStatusUpdate?.name}</Text>
          <View style={styles.currentBadgeWrap}>
            {showStatusUpdate && <TeamStatusPill status={showStatusUpdate.status} />}
          </View>
          {!!showStatusUpdate?.assignedLocation && (
            <Text style={styles.currentLocText}>Sector: {showStatusUpdate.assignedLocation}</Text>
          )}
        </View>

        <Text style={styles.transitionTitle}>Choose the next status</Text>
        <FormError message={statusFeedback.error} />

        <View style={styles.transitionList}>
          {showStatusUpdate &&
            STATUS_TRANSITIONS[showStatusUpdate.status]?.map(item => (
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
                  <Text style={styles.transitionSub}>{TEAM_STATUS_THEME[item.next].label}</Text>
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
  successMessage: {
    ...MobileTypography.caption,
    color: '#07834B',
    backgroundColor: '#E5F7ED',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  errorMessage: {
    ...MobileTypography.caption,
    color: '#B43545',
    backgroundColor: '#FFF0F2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterSelect: { flex: 1, marginBottom: 10 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    minHeight: 44,
    maxWidth: '100%',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#F6F9FD',
  },
  filterChipActive: { backgroundColor: '#EAF2FF' },
  filterChipText: {
    ...MobileTypography.caption,
    color: Colors.text.secondary,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  filterChipTextActive: { color: Colors.accent.primary },
  listContent: {
    paddingBottom: 110,
  },
  teamCard: {
    marginHorizontal: 18,
    marginBottom: 13,
    padding: 16,
    borderColor: '#E7EEF8',
    shadowOpacity: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  headerLeft: {
    flex: 1,
  },
  resourceIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCaption: { ...MobileTypography.caption, color: Colors.text.secondary },
  teamName: {
    ...MobileTypography.body,

    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...MobileTypography.badge, fontWeight: '700' },
  organisationPill: {
    backgroundColor: '#F1F5FA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  organisationText: { ...MobileTypography.badge, fontWeight: '600', color: Colors.text.secondary },
  crewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF2FF',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  crewCount: {
    ...MobileTypography.caption,
    fontWeight: '900',
    color: Colors.accent.primary,
  },
  crewLabel: {
    ...MobileTypography.badge,
    fontWeight: '500',
    color: Colors.text.tertiary,
  },
  metaBox: {
    backgroundColor: 'transparent',
    padding: 0,
    borderRadius: BorderRadius.md,
    gap: 12,
    marginBottom: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  metaItem: {
    ...MobileTypography.caption,
    color: Colors.text.secondary,
    flex: 1,
  },
  metaVal: {
    fontWeight: '700',
    color: Colors.text.primary,
  },
  deployedSectorBox: {
    marginTop: Spacing.xs,
    backgroundColor: '#EAF2FF',
    padding: 12,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#D6E5FF',
  },
  sectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  sectorLabel: {
    ...MobileTypography.caption,
    fontWeight: '600',
    color: Colors.accent.primary,
  },
  sectorTargetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectorTarget: {
    ...MobileTypography.caption,
    fontWeight: '700',
    color: Colors.text.primary,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
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
    ...MobileTypography.body,
    fontWeight: '800',
    color: Colors.accent.primary,
    letterSpacing: 0.5,
  },
  dispatchBoxVal: {
    ...MobileTypography.caption,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 2,
  },
  statusCurrentCard: {
    backgroundColor: '#F6F9FD',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#DFE7F1',
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  statusCurrentLabel: {
    ...MobileTypography.caption,
    fontWeight: '800',
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  currentBadgeWrap: {
    marginBottom: Spacing.xs,
  },
  currentLocText: {
    ...MobileTypography.caption,
    color: Colors.text.secondary,
  },
  transitionTitle: {
    ...MobileTypography.body,
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
    backgroundColor: '#FFFFFF',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#DFE7F1',
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
    ...MobileTypography.caption,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  transitionSub: {
    ...MobileTypography.caption,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
});
