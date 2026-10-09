/**
 * Emergency Shelters Management Screen — UC03 Steps 41–50 + Alternate/Exception Flows.
 * Real-time occupancy tracking, capacity warning guards, activation, and facility telemetry.
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
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { ShelterStatusBadge, OrganisationBadge } from '@/components/Badge';
import { ProgressBar } from '@/components/ProgressBar';
import { FormModal } from '@/components/FormModal';
import { EmptyState } from '@/components/EmptyState';
import { MobileNavBar } from '@/components/MobileNavBar';
import { useAuth } from '@/hooks/useAuth';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/colors';
import { SRI_LANKAN_DISTRICTS, FACILITY_TYPES, ORGANISATION_TYPES, SHELTER_FACILITIES } from '@/constants/districts';
import {
  getShelters,
  createShelter,
  activateShelter,
  updateOccupancy,
  deactivateShelter,
} from '@/services/shelterService';
import { getActiveEvents } from '@/services/hazardEventService';
import type {
  Shelter,
  CreateShelterData,
  HazardEvent,
  ShelterFacilityType,
  OrganisationType,
  ShelterStatus,
} from '@/types/resources';

const FILTER_TABS: { label: string; value: ShelterStatus | 'all' }[] = [
  { label: 'All Shelters', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Over Capacity', value: 'over_capacity' },
  { label: 'Registered', value: 'registered' },
  { label: 'Inactive', value: 'inactive' },
];

export default function SheltersScreen() {
  const router = useRouter();
  const { state: authState } = useAuth();
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [events, setEvents] = useState<HazardEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<ShelterStatus | 'all'>('all');

  // Modals
  const [showRegister, setShowRegister] = useState(false);
  const [showActivate, setShowActivate] = useState<Shelter | null>(null);
  const [showOccupancy, setShowOccupancy] = useState<Shelter | null>(null);

  // Form states
  const [form, setForm] = useState({
    name: '',
    facilityType: '' as ShelterFacilityType,
    address: '',
    district: '',
    capacity: '',
    managerName: '',
    managerContact: '',
    organisationType: '' as OrganisationType,
    organisationName: '',
  });
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [occupancyValue, setOccupancyValue] = useState('');
  const [activateEventId, setActivateEventId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([getShelters(), getActiveEvents()]);
      setShelters(s);
      setEvents(e);
      if (e.length > 0 && !activateEventId) {
        setActivateEventId(e[0].id);
      }
    } catch (_error) {
      Alert.alert('Notice', 'Could not refresh shelter data. Please check network.');
    } finally {
      setLoading(false);
    }
  }, [activateEventId]);

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
      facilityType: 'school',
      address: '',
      district: 'Ratnapura',
      capacity: '',
      managerName: '',
      managerContact: '',
      organisationType: 'government',
      organisationName: '',
    });
    setSelectedFacilities([]);
  };

  const handleRegister = async () => {
    if (!form.name || !form.facilityType || !form.address || !form.district || !form.capacity || !form.managerName || !form.managerContact || !form.organisationType || !form.organisationName) {
      Alert.alert('Validation Error', 'Please complete all required fields.');
      return;
    }

    const cap = parseInt(form.capacity, 10);
    if (isNaN(cap) || cap <= 0) {
      Alert.alert('Validation Error', 'Capacity must be a positive integer.');
      return;
    }

    setSubmitting(true);
    try {
      const shelterData: CreateShelterData = {
        name: form.name.trim(),
        facilityType: form.facilityType,
        address: form.address.trim(),
        district: form.district,
        latitude: 6.6828,
        longitude: 80.4035,
        capacity: cap,
        facilities: selectedFacilities,
        managerName: form.managerName.trim(),
        managerContact: form.managerContact.trim(),
        organisationType: form.organisationType,
        organisationName: form.organisationName.trim(),
      };

      await createShelter(shelterData, authState.user?.id || 'officer');
      Alert.alert('Shelter Registered', `"${form.name}" has been registered.`);
      setShowRegister(false);
      resetForm();
      loadData();
    } catch (error) {
      Alert.alert('Registration Error', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async () => {
    if (!showActivate) return;
    const eventIdToUse =
      activateEventId || (events.length > 0 ? events[0].id : 'event-monsoon-2026');

    setSubmitting(true);
    try {
      await activateShelter(showActivate.id, eventIdToUse);
      if (Platform.OS === 'web') {
        window.alert(`Safe Haven Activated: "${showActivate.name}" is now Active.`);
      } else {
        Alert.alert(
          'Safe Haven Activated',
          `"${showActivate.name}" is now Active in the combined picture.`,
        );
      }
      setShowActivate(null);
      loadData();
    } catch (error) {
      if (Platform.OS === 'web') {
        window.alert((error as Error).message);
      } else {
        Alert.alert('Activation Error', (error as Error).message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateOccupancy = async () => {
    if (!showOccupancy) return;

    const occ = parseInt(occupancyValue, 10);
    if (isNaN(occ) || occ < 0) {
      Alert.alert('Validation Error', 'Please enter a valid occupancy count.');
      return;
    }

    // UC03 Exception Flow: Over Capacity Warning
    if (occ > showOccupancy.capacity) {
      const recordOverCapacity = async () => {
        setSubmitting(true);
        try {
          await updateOccupancy(showOccupancy.id, occ, showOccupancy.capacity);
          if (Platform.OS === 'web') {
            window.alert('Occupancy Recorded: Shelter marked as Over Capacity.');
          } else {
            Alert.alert('Occupancy Recorded', 'Shelter marked as Over Capacity.');
          }
          setShowOccupancy(null);
          setOccupancyValue('');
          loadData();
        } catch (error) {
          if (Platform.OS === 'web') {
            window.alert((error as Error).message);
          } else {
            Alert.alert('Error', (error as Error).message);
          }
        } finally {
          setSubmitting(false);
        }
      };

      if (Platform.OS === 'web') {
        const confirmed = window.confirm(
          `Over Capacity Warning (UC03 Exception):\n\nThis occupancy (${occ}) exceeds registered shelter capacity (${showOccupancy.capacity}).\n\nProceed and flag this shelter as Over Capacity?`
        );
        if (confirmed) {
          recordOverCapacity();
        }
        return;
      }

      Alert.alert(
        'Over Capacity Warning (UC03 Exception)',
        `This occupancy (${occ}) exceeds registered shelter capacity (${showOccupancy.capacity}). The shelter will be flagged as Over Capacity and logged in the combined picture.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Record Truthful Value',
            onPress: recordOverCapacity,
          },
        ],
      );
      return;
    }

    setSubmitting(true);
    try {
      await updateOccupancy(showOccupancy.id, occ, showOccupancy.capacity);
      if (Platform.OS === 'web') {
        window.alert(`Occupancy Updated: Current occupants: ${occ} / ${showOccupancy.capacity}`);
      } else {
        Alert.alert('Occupancy Updated', `Current occupants: ${occ} / ${showOccupancy.capacity}`);
      }
      setShowOccupancy(null);
      setOccupancyValue('');
      loadData();
    } catch (error) {
      if (Platform.OS === 'web') {
        window.alert((error as Error).message);
      } else {
        Alert.alert('Error', (error as Error).message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (shelter: Shelter) => {
    const doDeactivate = async () => {
      try {
        await deactivateShelter(shelter.id);
        if (Platform.OS === 'web') {
          window.alert(`"${shelter.name}" is now marked as Inactive.`);
        } else {
          Alert.alert('Status Updated', `"${shelter.name}" is now marked as Inactive.`);
        }
        loadData();
      } catch (error) {
        if (Platform.OS === 'web') {
          window.alert((error as Error).message);
        } else {
          Alert.alert('Error', (error as Error).message);
        }
      }
    };

    if (shelter.currentOccupancy > 0) {
      const msg = `This shelter currently houses ${shelter.currentOccupancy} evacuees.\n\nDo you want to reassign occupants and proceed with deactivating "${shelter.name}"?`;
      if (Platform.OS === 'web') {
        const confirmForce = window.confirm(msg);
        if (confirmForce) {
          await doDeactivate();
        }
        return;
      } else {
        Alert.alert('Occupants Present', msg, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Force Deactivate',
            style: 'destructive',
            onPress: doDeactivate,
          },
        ]);
        return;
      }
    }

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Are you sure you want to deactivate "${shelter.name}"?`);
      if (confirmed) {
        await doDeactivate();
      }
    } else {
      Alert.alert('Deactivate Shelter', `Deactivate "${shelter.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: doDeactivate,
        },
      ]);
    }
  };

  const filteredShelters = shelters.filter((s) => {
    if (selectedFilter === 'all') return true;
    return s.status === selectedFilter;
  });

  return (
    <ScreenContainer>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Emergency Shelters</Text>
          <Text style={styles.headerSubtitle}>
            {shelters.filter((s) => s.status === 'active' || s.status === 'over_capacity').length} Active • Safe Haven Matrix
          </Text>
        </View>
        <Button
          title="Register"
          variant="primary"
          size="sm"
          icon={<Ionicons name="add" size={16} color="#FFFFFF" />}
          onPress={() => setShowRegister(true)}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTER_TABS.map((tab) => {
            const count = tab.value === 'all'
              ? shelters.length
              : shelters.filter((s) => s.status === tab.value).length;
            const active = selectedFilter === tab.value;

            return (
              <TouchableOpacity
                key={tab.value}
                onPress={() => setSelectedFilter(tab.value)}
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

      {/* Shelter Cards List */}
      <FlatList
        data={filteredShelters}
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
              iconName="home-outline"
              title="No Shelters Found"
              message={
                selectedFilter !== 'all'
                  ? `No shelters with status "${selectedFilter}".`
                  : 'Register a community center, school, or safe hall.'
              }
              actionTitle="Register Shelter"
              onAction={() => setShowRegister(true)}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const occupancyRate = item.capacity > 0 ? Math.round((item.currentOccupancy / item.capacity) * 100) : 0;
          const isOver = item.status === 'over_capacity' || item.currentOccupancy > item.capacity;

          return (
            <Card
              style={styles.shelterCard}
              glowColor={isOver ? Colors.danger : item.status === 'active' ? Colors.success : undefined}
            >
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                  <Text style={styles.shelterName}>{item.name}</Text>
                  <View style={styles.badgeRow}>
                    <ShelterStatusBadge status={item.status} size="sm" />
                    <OrganisationBadge type={item.organisationType} size="sm" />
                  </View>
                </View>
                <View style={styles.facilityTypePill}>
                  <Text style={styles.facilityTypeText}>
                    {item.facilityType.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Over Capacity Warning Pill */}
              {isOver && (
                <View style={styles.overCapacityBanner}>
                  <Ionicons name="warning" size={14} color="#EF4444" />
                  <Text style={styles.overCapacityText}>
                    OVER CAPACITY ({occupancyRate}%) • ESCALATION ACTIVE
                  </Text>
                </View>
              )}

              {/* Progress Bar & Capacity */}
              <View style={styles.occupancyBox}>
                <View style={styles.occupancyHeader}>
                  <Text style={styles.occupancyLabel}>Occupancy Load</Text>
                  <Text style={[styles.occupancyPercent, isOver && { color: Colors.danger }]}>
                    {item.currentOccupancy.toLocaleString()} / {item.capacity.toLocaleString()} ({occupancyRate}%)
                  </Text>
                </View>
                <ProgressBar
                  current={item.currentOccupancy}
                  total={item.capacity}
                  color={isOver ? Colors.danger : occupancyRate > 75 ? Colors.warning : Colors.success}
                />
              </View>

              {/* Location & Metadata */}
              <View style={styles.metaBox}>
                <View style={styles.metaRow}>
                  <Ionicons name="location-sharp" size={13} color={Colors.accent.primary} />
                  <Text style={styles.metaItem}>
                    <Text style={styles.metaVal}>{item.district}</Text> • {item.address}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="person-outline" size={13} color={Colors.text.tertiary} />
                  <Text style={styles.metaItem}>
                    Lead: <Text style={styles.metaVal}>{item.managerName}</Text> ({item.managerContact})
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="business-outline" size={13} color={Colors.text.tertiary} />
                  <Text style={styles.metaItem}>
                    Authority: <Text style={styles.metaVal}>{item.organisationName}</Text>
                  </Text>
                </View>
              </View>

              {/* Facilities Chips */}
              {item.facilities && item.facilities.length > 0 && (
                <View style={styles.facilitiesRow}>
                  {item.facilities.map((fac) => (
                    <View key={fac} style={styles.facilityChip}>
                      <Ionicons name="checkmark-circle" size={12} color={Colors.accent.primary} />
                      <Text style={styles.facilityChipText}>{fac}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.cardActions}>
                {(item.status === 'registered' || item.status === 'inactive') && (
                  <Button
                    title={item.status === 'inactive' ? 'Reactivate Safe Haven' : 'Activate Safe Haven'}
                    variant="primary"
                    size="sm"
                    icon={
                      <Ionicons
                        name={item.status === 'inactive' ? 'refresh-circle' : 'flash'}
                        size={15}
                        color="#FFFFFF"
                      />
                    }
                    onPress={() => setShowActivate(item)}
                    style={styles.actionBtn}
                  />
                )}

                {(item.status === 'active' || item.status === 'over_capacity') && (
                  <>
                    <Button
                      title="Update Occupants"
                      variant="primary"
                      size="sm"
                      icon={<Ionicons name="people" size={15} color="#FFFFFF" />}
                      onPress={() => {
                        setShowOccupancy(item);
                        setOccupancyValue(item.currentOccupancy.toString());
                      }}
                      style={styles.actionBtn}
                    />
                    <Button
                      title="Deactivate"
                      variant="outline"
                      size="sm"
                      onPress={() => handleDeactivate(item)}
                    />
                  </>
                )}
              </View>
            </Card>
          );
        }}
      />

      {/* Register Shelter Modal */}
      <FormModal
        visible={showRegister}
        title="Register Safe Haven Shelter"
        onClose={() => {
          setShowRegister(false);
          resetForm();
        }}
      >
        <Input
          label="Shelter Facility Name *"
          placeholder="e.g. Ratnapura Central College Safe Hall"
          value={form.name}
          onChangeText={(v) => setForm({ ...form, name: v })}
          icon={<Ionicons name="business-outline" size={18} color={Colors.accent.primary} />}
        />

        <Select
          label="Facility Infrastructure Type *"
          value={form.facilityType}
          options={FACILITY_TYPES}
          onSelect={(val) => setForm({ ...form, facilityType: val as ShelterFacilityType })}
        />

        <Input
          label="Physical Address / Access Route *"
          placeholder="e.g. Main Street, Ratnapura"
          value={form.address}
          onChangeText={(v) => setForm({ ...form, address: v })}
          icon={<Ionicons name="location-outline" size={18} color={Colors.accent.primary} />}
        />

        <Select
          label="District Jurisdiction *"
          value={form.district}
          options={SRI_LANKAN_DISTRICTS.map((d) => ({ value: d, label: d }))}
          onSelect={(val) => setForm({ ...form, district: val })}
        />

        <Input
          label="Total Safe Evacuee Capacity *"
          placeholder="e.g. 500"
          value={form.capacity}
          onChangeText={(v) => setForm({ ...form, capacity: v })}
          keyboardType="numeric"
          icon={<Ionicons name="people-outline" size={18} color={Colors.accent.primary} />}
        />

        <Input
          label="Designated Shelter Manager *"
          placeholder="e.g. Gamini Senanayake"
          value={form.managerName}
          onChangeText={(v) => setForm({ ...form, managerName: v })}
          icon={<Ionicons name="person-outline" size={18} color={Colors.accent.primary} />}
        />

        <Input
          label="Emergency Phone / Contact *"
          placeholder="e.g. +94 71 889 9001"
          value={form.managerContact}
          onChangeText={(v) => setForm({ ...form, managerContact: v })}
          keyboardType="phone-pad"
          icon={<Ionicons name="call-outline" size={18} color={Colors.accent.primary} />}
        />

        <Select
          label="Managing Organisation Type *"
          value={form.organisationType}
          options={ORGANISATION_TYPES}
          onSelect={(val) => setForm({ ...form, organisationType: val as OrganisationType })}
        />

        <Input
          label="Organisation Name *"
          placeholder="e.g. Disaster Management Centre"
          value={form.organisationName}
          onChangeText={(v) => setForm({ ...form, organisationName: v })}
          icon={<Ionicons name="shield-outline" size={18} color={Colors.accent.primary} />}
        />

        {/* Facilities selection */}
        <Text style={styles.formSectionHeader}>AVAILABLE FACILITY INFRASTRUCTURE</Text>
        <View style={styles.facilitiesSelectGrid}>
          {SHELTER_FACILITIES.map((fac) => {
            const selected = selectedFacilities.includes(fac);
            return (
              <TouchableOpacity
                key={fac}
                onPress={() => {
                  setSelectedFacilities(
                    selected
                      ? selectedFacilities.filter((x) => x !== fac)
                      : [...selectedFacilities, fac],
                  );
                }}
                style={[styles.facSelectChip, selected && styles.facSelectChipActive]}
              >
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'add-circle-outline'}
                  size={14}
                  color={selected ? Colors.accent.primary : Colors.text.tertiary}
                />
                <Text style={[styles.facSelectText, selected && styles.facSelectTextActive]}>
                  {fac}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Button
          title="Complete Registration"
          variant="primary"
          loading={submitting}
          onPress={handleRegister}
          style={styles.modalSubmit}
        />
      </FormModal>

      {/* Activate Modal */}
      <FormModal
        visible={!!showActivate}
        title={
          showActivate?.status === 'inactive'
            ? `Reactivate: ${showActivate?.name}`
            : `Activate: ${showActivate?.name}`
        }
        onClose={() => setShowActivate(null)}
      >
        <Text style={styles.activateHint}>
          Activating this shelter links it directly to the designated hazard event and broadcasts
          safe haven coordinates to first responders.
        </Text>

        <Select
          label="Link Active Hazard Event *"
          value={activateEventId}
          options={events.map((e) => ({
            value: e.id,
            label: e.title,
            description: `${e.affectedDistricts.join(', ')} • ${e.hazardType.toUpperCase()}`,
          }))}
          onSelect={(val) => setActivateEventId(val)}
        />

        <Button
          title="Confirm & Broadcast Activation"
          variant="primary"
          loading={submitting}
          onPress={handleActivate}
          style={styles.modalSubmit}
        />
      </FormModal>

      {/* Update Occupancy Modal */}
      <FormModal
        visible={!!showOccupancy}
        title={`Update Occupancy: ${showOccupancy?.name}`}
        onClose={() => {
          setShowOccupancy(null);
          setOccupancyValue('');
        }}
      >
        <View style={styles.occupancyModalCard}>
          <Text style={styles.modalCapLabel}>REGISTERED MAXIMUM CAPACITY</Text>
          <Text style={styles.modalCapVal}>{showOccupancy?.capacity.toLocaleString()} Evacuees</Text>
        </View>

        <Input
          label="Current Verified Headcount *"
          placeholder={`Enter occupants (Cap: ${showOccupancy?.capacity})`}
          value={occupancyValue}
          onChangeText={setOccupancyValue}
          keyboardType="numeric"
          icon={<Ionicons name="people-outline" size={18} color={Colors.accent.primary} />}
        />

        <Button
          title="Save Headcount Telemetry"
          variant="primary"
          loading={submitting}
          onPress={handleUpdateOccupancy}
          style={styles.modalSubmit}
        />
      </FormModal>

      {/* Bottom Navigation Dock */}
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
  shelterCard: {
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
  shelterName: {
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
  facilityTypePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  facilityTypeText: {
    fontSize: FontSize.micro,
    color: Colors.text.secondary,
    fontWeight: '700',
  },
  overCapacityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  overCapacityText: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: '#F87171',
    letterSpacing: 0.5,
  },
  occupancyBox: {
    marginBottom: Spacing.md,
  },
  occupancyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  occupancyLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    fontWeight: '600',
  },
  occupancyPercent: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text.primary,
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
  facilitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  facilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.10)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  facilityChipText: {
    fontSize: FontSize.micro,
    fontWeight: '700',
    color: Colors.accent.primary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  formSectionHeader: {
    fontSize: FontSize.micro + 1,
    fontWeight: '800',
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  facilitiesSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  facSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 4,
  },
  facSelectChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: Colors.accent.primary,
  },
  facSelectText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },
  facSelectTextActive: {
    color: Colors.accent.primary,
    fontWeight: '800',
  },
  modalSubmit: {
    marginTop: Spacing.md,
  },
  activateHint: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginVertical: Spacing.sm,
    lineHeight: 18,
  },
  occupancyModalCard: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  modalCapLabel: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.accent.primary,
  },
  modalCapVal: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    color: Colors.text.primary,
    marginTop: 2,
  },
});
