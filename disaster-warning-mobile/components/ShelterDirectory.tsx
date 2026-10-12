import { MobileTypography } from '@/constants/colors';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/components/ScreenContainer';
import { FormModal } from '@/components/FormModal';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { ReportLocationField } from '@/components/ReportLocationField';
import { ShelterMap } from '@/components/ShelterMap';
import { MobileNavBar } from '@/components/MobileNavBar';
import { useAuth } from '@/hooks/useAuth';
import { LightColors } from '@/constants/colors';
import {
  SRI_LANKAN_DISTRICTS,
  SHELTER_FACILITIES,
  FACILITY_TYPES,
  ORGANISATION_TYPES,
} from '@/constants/districts';
import { canCoordinateResources } from '@/constants/resourcePermissions';
import {
  getShelters,
  createShelter,
  activateShelter,
  updateOccupancy,
  deactivateShelter,
} from '@/services/shelterService';
import { getActiveEvents } from '@/services/hazardEventService';
import {
  filterShelters,
  shelterAvailability,
  shelterCapacityNotice,
} from '@/utils/shelterDirectory';
import type { ShelterAvailability } from '@/utils/shelterDirectory';
import type { Shelter, CreateShelterData, HazardEvent } from '@/types/resources';

const availabilityLabels = {
  open: 'Open',
  full: 'Full / over capacity',
  closed: 'Closed',
  registered: 'Registered',
  all: 'All',
};
const blankForm = (): CreateShelterData => ({
  name: '',
  facilityType: 'school',
  address: '',
  district: '',
  latitude: 6.9271,
  longitude: 79.8612,
  capacity: 0,
  facilities: [],
  managerName: '',
  managerContact: '',
  organisationType: 'government',
  organisationName: '',
});
export function ShelterDirectory() {
  const compact = useWindowDimensions().width < 380;
  const { state } = useAuth();
  const user = state.user;
  const manager = canCoordinateResources(user?.role);
  const community = user?.role === 'citizen' || user?.role === 'volunteer';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const request = useRef(0);
  const mutationLock = useRef(false);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [events, setEvents] = useState<HazardEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [district, setDistrict] = useState(user?.district || '');
  const [search, setSearch] = useState('');
  const [facility, setFacility] = useState('');
  const [availability, setAvailability] = useState<ShelterAvailability>('all');
  const [selected, setSelected] = useState<Shelter | null>(null);
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState<CreateShelterData>(blankForm);
  const [capacity, setCapacity] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [manual, setManual] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({});
  const [eventId, setEventId] = useState('');
  const [occupancy, setOccupancy] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [success, setSuccess] = useState('');
  useEffect(() => {
    if (!success) return;
    const timeout = setTimeout(() => setSuccess(''), 5000);
    return () => clearTimeout(timeout);
  }, [success]);
  const load = useCallback(async () => {
    const id = ++request.current;
    try {
      const [items, active] = await Promise.all([
        getShelters(),
        manager ? getActiveEvents() : Promise.resolve([]),
      ]);
      if (id !== request.current) return;
      setShelters(items);
      setEvents(active);
      setFailed(false);
    } catch {
      if (id === request.current) setFailed(true);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [manager]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        request.current += 1;
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
  const run = async (action: () => Promise<unknown>, message: string) => {
    if (!manager || mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(message);
      setSelected(null);
      setRegister(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes. Please try again.');
      setValidationAttempt(value => value + 1);
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  };
  const updateForm = <K extends keyof CreateShelterData>(key: K, value: CreateShelterData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setFormErrors(prev => ({ ...prev, [key]: undefined }));
  };
  const submitRegistration = () => {
    if (!manager || !user) return;
    const errors: Record<string, string> = {};
    for (const field of [
      'name',
      'address',
      'district',
      'managerName',
      'managerContact',
      'organisationName',
    ] as const)
      if (!form[field].trim()) errors[field] = 'This field is required.';
    const cap = Number(capacity);
    if (!Number.isSafeInteger(cap) || cap <= 0) errors.capacity = 'Enter a positive whole number.';
    if (!confirmed) errors.location = 'Select a map location or use current location.';
    const districtError = officerDistrictError(form.district, user.district);
    if (districtError) errors.district = districtError;
    setFormErrors(errors);
    setError('');
    if (Object.keys(errors).length) setValidationAttempt(value => value + 1);
    if (Object.keys(errors).length) return;
    void run(
      () => createShelter({ ...form, capacity: cap }, user.id),
      'Shelter registered. Activate it for an active event when ready.'
    );
  };
  const open = (s: Shelter) => {
    setSelected(s);
    setOccupancy(String(s.currentOccupancy));
    setEventId('');
    setError('');
  };
  const filtered = filterShelters(shelters, {
    district,
    search,
    facility,
    availability,
    manager: !community,
  });
  const optionTabs: ShelterAvailability[] = manager
    ? ['all', 'open', 'full', 'registered', 'closed']
    : ['all', 'open', 'full', 'closed'];
  const selectedAvailability = selected ? shelterAvailability(selected) : 'all';
  const relevantEvents = selected
    ? events.filter(e => e.affectedDistricts.includes(selected.district))
    : [];
  const renderButton = (
    title: string,
    onPress: () => void,
    secondary = false,
    disabled = false
  ) => (
    <TouchableOpacity
      style={[
        secondary ? styles.secondaryButton : styles.primaryButton,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
    >
      <Text style={secondary ? styles.secondaryButtonText : styles.primaryButtonText}>
        {busy ? 'Saving...' : title}
      </Text>
    </TouchableOpacity>
  );
  return (
    <ScreenContainer style={styles.screen} contentStyle={styles.shell}>
      <StatusBar style="light" />
      <FlatList
        data={loading || failed ? [] : filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={LightColors.primary}
          />
        }
        ListHeaderComponent={
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
                <Text style={styles.headerCaption}>
                  {manager ? 'Resource coordination' : 'Community support'}
                </Text>
                <Ionicons name="business-outline" size={25} color="#FFFFFF" />
              </View>
              <Text style={styles.heroTitle}>{manager ? 'Manage shelters' : 'Find a shelter'}</Text>
              <Text style={styles.heroDescription}>
                {manager
                  ? 'Register, activate and monitor evacuation shelters.'
                  : 'Find locations, facilities and space for your family.'}
              </Text>
            </LinearGradient>
            <View style={styles.filters}>
              <Input
                appearance="light"
                placeholder="Search name, location or organisation"
                value={search}
                onChangeText={setSearch}
                accessibilityLabel="Search shelters"
                icon={<Ionicons name="search-outline" size={18} color={LightColors.mutedText} />}
                containerStyle={styles.search}
              />
              <View style={[styles.filterRow, compact && { flexDirection: 'column' }]}>
                <Select
                  appearance="light"
                  value={district}
                  onSelect={setDistrict}
                  options={[
                    { value: '', label: 'All districts' },
                    ...SRI_LANKAN_DISTRICTS.map(d => ({ value: d, label: d })),
                  ]}
                  containerStyle={styles.filterSelect}
                />
                <Select
                  appearance="light"
                  value={facility}
                  onSelect={setFacility}
                  options={[
                    { value: '', label: 'Any facility' },
                    ...SHELTER_FACILITIES.map(f => ({ value: f, label: f })),
                  ]}
                  containerStyle={styles.filterSelect}
                />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabs}
              >
                {optionTabs.map(tab => (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setAvailability(tab)}
                    style={[styles.tab, availability === tab && styles.activeTab]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: availability === tab }}
                  >
                    <Text style={[styles.tabText, availability === tab && styles.activeTabText]}>
                      {availabilityLabels[tab]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.body}>
              {!!success && (
                <View style={styles.success}>
                  <Text style={styles.successText} accessibilityLiveRegion="polite">
                    {success}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setSuccess('')}
                    style={styles.dismissSuccess}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss success message"
                  >
                    <Ionicons name="close" size={20} color="#07834B" />
                  </TouchableOpacity>
                </View>
              )}
              {manager &&
                renderButton('Register shelter', () => {
                  setForm({ ...blankForm(), district: user?.district || '' });
                  setCapacity('');
                  setConfirmed(false);
                  setFormErrors({});
                  setError('');
                  setRegister(true);
                })}
              <View style={styles.listHeading}>
                <Text style={styles.sectionTitle}>
                  {manager
                    ? 'Shelter directory'
                    : district
                      ? 'Shelters in ' + district
                      : 'All shelter locations'}
                </Text>
                <Text style={styles.caption}>
                  {!failed && !loading ? `${filtered.length} listed` : ''}
                </Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const state = shelterAvailability(item);
          const available = Math.max(0, item.capacity - item.currentOccupancy);
          return (
            <TouchableOpacity
              onPress={() => open(item)}
              style={styles.shelterCard}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${availabilityLabels[state]}`}
            >
              <View style={styles.shelterHeading}>
                <View style={styles.shelterIcon}>
                  <Ionicons name="business-outline" size={23} color={LightColors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.shelterName}>{item.name}</Text>
                  <Text style={styles.caption}>
                    {item.district} /{' '}
                    {FACILITY_TYPES.find(f => f.value === item.facilityType)?.label}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.status,
                  {
                    backgroundColor:
                      state === 'open' ? '#E5F7ED' : state === 'full' ? '#FFF0F2' : '#EAF2FF',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        state === 'open'
                          ? '#07834B'
                          : state === 'full'
                            ? LightColors.danger
                            : LightColors.secondaryText,
                    },
                  ]}
                >
                  {state === 'full' ? 'Full' : availabilityLabels[state]}
                </Text>
              </View>
              <Text style={styles.address} numberOfLines={2}>
                {item.address}
              </Text>
              <View style={styles.progress}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, item.capacity ? (item.currentOccupancy / item.capacity) * 100 : 0)}%`,
                      backgroundColor: state === 'full' ? LightColors.danger : '#0AA66A',
                    },
                  ]}
                />
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.caption}>
                  {state === 'open'
                    ? `${available} spaces available`
                    : `${item.currentOccupancy} / ${item.capacity} occupants`}
                </Text>
                <Text style={styles.detailsLink}>View details</Text>
                <Ionicons name="chevron-forward" size={14} color={LightColors.primary} />
              </View>
              {!!shelterCapacityNotice(item) && (
                <Text style={styles.errorText}>{shelterCapacityNotice(item)}</Text>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading ? (
              <ActivityIndicator color={LightColors.primary} />
            ) : (
              <>
                <Ionicons
                  name={failed ? 'cloud-offline-outline' : 'home-outline'}
                  size={32}
                  color={LightColors.primary}
                />
                <Text style={styles.sectionTitle}>
                  {failed ? 'Shelters unavailable' : 'No matching shelters'}
                </Text>
                <Text style={styles.caption}>
                  {failed
                    ? 'Check your connection and pull down to refresh.'
                    : 'Try another district, availability or facility filter.'}
                </Text>
              </>
            )}
          </View>
        }
      />
      <FormModal
        appearance="light"
        visible={!!selected}
        onClose={() => {
          if (!busy) setSelected(null);
        }}
        title={selected?.name || 'Shelter details'}
        feedbackKey={validationAttempt}
      >
        {selected && (
          <View>
            <View style={styles.detailHeader}>
              <Text style={styles.sectionTitle}>{availabilityLabels[selectedAvailability]}</Text>
              <Text style={styles.caption}>
                {selected.district} / {selected.organisationName}
              </Text>
            </View>
            <ShelterMap latitude={selected.latitude} longitude={selected.longitude} />
            <Text style={styles.address}>{selected.address}</Text>
            <View style={styles.detailCapacity}>
              <Text style={styles.capacityValue}>
                {selected.currentOccupancy} / {selected.capacity}
              </Text>
              <Text style={styles.caption}>Current occupancy / capacity</Text>
              {!!shelterCapacityNotice(selected) && (
                <Text style={styles.errorText}>{shelterCapacityNotice(selected)}</Text>
              )}
            </View>
            <Text style={styles.sectionTitle}>Facilities</Text>
            <View style={styles.facilityChips}>
              {selected.facilities.length ? (
                selected.facilities.map(f => (
                  <View key={f} style={styles.facilityChip}>
                    <Ionicons name="checkmark-circle-outline" size={14} color="#07834B" />
                    <Text style={styles.caption}>{f}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.caption}>Facilities have not been listed.</Text>
              )}
            </View>
            <Text style={styles.sectionTitle}>Contact</Text>
            <Text style={styles.address}>{selected.managerName}</Text>
            {renderButton(
              selected.managerContact,
              () => {
                void Linking.openURL(`tel:${selected.managerContact}`).catch(() =>
                  setError('Could not open the phone app.')
                );
              },
              true
            )}
            {renderButton(
              'Get directions',
              () => {
                void Linking.openURL(
                  `https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`
                ).catch(() => setError('Could not open maps.'));
              },
              true,
              !selected.latitude && !selected.longitude
            )}
            {manager && (
              <View style={styles.manageSection}>
                <Text style={styles.sectionTitle}>Manage shelter</Text>
                {selected.status === 'registered' || selected.status === 'inactive' ? (
                  <>
                    <Select
                      appearance="light"
                      label="Active hazard event"
                      value={eventId}
                      onSelect={setEventId}
                      options={relevantEvents.map(e => ({ value: e.id, label: e.title }))}
                      disabled={busy}
                    />
                    {!relevantEvents.length && (
                      <Text style={styles.caption}>
                        An active event in {selected.district} is required to activate this shelter.
                      </Text>
                    )}
                    {renderButton(
                      'Activate shelter',
                      () =>
                        void run(() => activateShelter(selected.id, eventId), 'Shelter activated.'),
                      false,
                      !eventId
                    )}
                  </>
                ) : (
                  <>
                    <Input
                      appearance="light"
                      label="Current occupants"
                      error={error === 'Enter a non-negative whole number.' ? error : undefined}
                      value={occupancy}
                      onChangeText={value => {
                        setOccupancy(value);
                        setError('');
                      }}
                      keyboardType="number-pad"
                      editable={!busy}
                    />
                    {Number(occupancy) > selected.capacity && (
                      <Text style={styles.errorText}>
                        This exceeds capacity. The actual number will be saved and flagged as over
                        capacity.
                      </Text>
                    )}
                    {renderButton('Update occupancy', () => {
                      const count = Number(occupancy);
                      if (!occupancy.trim() || !Number.isSafeInteger(count) || count < 0) {
                        setError('Enter a non-negative whole number.');
                        setValidationAttempt(value => value + 1);
                        return;
                      }
                      void run(
                        () => updateOccupancy(selected.id, count, selected.capacity),
                        'Occupancy and history updated.'
                      );
                    })}
                    {selected.currentOccupancy > 0 && (
                      <Text style={styles.caption}>
                        Reallocate occupants before closing this shelter.
                      </Text>
                    )}
                    {renderButton(
                      'Deactivate shelter',
                      () => void run(() => deactivateShelter(selected.id), 'Shelter deactivated.'),
                      true,
                      selected.currentOccupancy > 0
                    )}
                  </>
                )}
                {selected.occupancyHistory?.length ? (
                  <View style={styles.history}>
                    <Text style={styles.sectionTitle}>Occupancy history</Text>
                    {selected.occupancyHistory
                      .slice(-5)
                      .reverse()
                      .map((h, index) => (
                        <Text key={index} style={styles.caption}>
                          {h.occupancy} / {h.capacity} - {new Date(h.timestamp).toLocaleString()}
                        </Text>
                      ))}
                  </View>
                ) : null}
              </View>
            )}
            {!!error && (
              <Text style={styles.errorText} accessibilityLiveRegion="polite">
                {error}
              </Text>
            )}
          </View>
        )}
      </FormModal>
      <FormModal
        appearance="light"
        visible={register && manager}
        onClose={() => {
          if (!busy) setRegister(false);
        }}
        title="Register shelter"
        feedbackKey={validationAttempt}
      >
        <Text style={styles.formCaption}>
          Add facility details, ownership and the exact shelter location.
        </Text>
        <Input
          appearance="light"
          label="Shelter name"
          value={form.name}
          onChangeText={v => updateForm('name', v)}
          error={formErrors.name}
          editable={!busy}
        />
        <Select
          appearance="light"
          label="Facility type"
          value={form.facilityType}
          onSelect={v => updateForm('facilityType', v as CreateShelterData['facilityType'])}
          options={FACILITY_TYPES}
          disabled={busy}
        />
        <Input
          appearance="light"
          label="Capacity"
          placeholder="Number of people"
          value={capacity}
          onChangeText={value => {
            setCapacity(value);
            setFormErrors(current => ({ ...current, capacity: undefined }));
          }}
          keyboardType="number-pad"
          error={formErrors.capacity}
          editable={!busy}
        />
        <Text style={styles.sectionTitle}>Shelter location</Text>
        {register && manager && (
          <ReportLocationField
            location={{ latitude: form.latitude, longitude: form.longitude }}
            confirmed={confirmed}
            isManual={manual}
            locationName={form.address}
            district={form.district}
            disabled={busy}
            errors={{
              location: formErrors.location,
              locationName: formErrors.address,
              district: formErrors.district || officerDistrictError(form.district, user?.district),
            }}
            onLocationChange={(loc, isManual) => {
              updateForm('latitude', loc.latitude);
              updateForm('longitude', loc.longitude);
              setConfirmed(true);
              setManual(isManual);
              setFormErrors(prev => ({ ...prev, location: undefined }));
            }}
            onInvalidLocation={() => setConfirmed(false)}
            onNameChange={v => updateForm('address', v)}
            onDistrictChange={v => updateForm('district', v)}
          />
        )}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Ownership and contact</Text>
          <Select
            appearance="light"
            label="Organisation type"
            value={form.organisationType}
            onSelect={v =>
              updateForm('organisationType', v as CreateShelterData['organisationType'])
            }
            options={ORGANISATION_TYPES}
            disabled={busy}
          />
          <Input
            appearance="light"
            label="Organisation name"
            value={form.organisationName}
            onChangeText={v => updateForm('organisationName', v)}
            error={formErrors.organisationName}
            editable={!busy}
          />
          <Input
            appearance="light"
            label="Manager name"
            value={form.managerName}
            onChangeText={v => updateForm('managerName', v)}
            error={formErrors.managerName}
            editable={!busy}
          />
          <Input
            appearance="light"
            label="Manager contact"
            value={form.managerContact}
            onChangeText={v => updateForm('managerContact', v)}
            error={formErrors.managerContact}
            keyboardType="phone-pad"
            editable={!busy}
          />
          <Text style={styles.sectionTitle}>Available facilities</Text>
          <View style={styles.facilityChips}>
            {SHELTER_FACILITIES.map(f => (
              <TouchableOpacity
                key={f}
                disabled={busy}
                onPress={() =>
                  updateForm(
                    'facilities',
                    form.facilities.includes(f)
                      ? form.facilities.filter(item => item !== f)
                      : [...form.facilities, f]
                  )
                }
                style={[
                  styles.facilityChip,
                  form.facilities.includes(f) && styles.selectedFacility,
                ]}
                accessibilityRole="checkbox"
                accessibilityLabel={f}
                accessibilityState={{ checked: form.facilities.includes(f), disabled: busy }}
              >
                {form.facilities.includes(f) && (
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                )}
                <Text
                  style={[
                    styles.caption,
                    form.facilities.includes(f) && styles.selectedFacilityText,
                  ]}
                >
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {!!error && (
          <Text style={styles.errorText} accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
        {renderButton('Register shelter', submitRegistration)}
      </FormModal>
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
  filterRow: { flexDirection: 'row', gap: 8 },
  filterSelect: { flex: 1, marginBottom: 10 },
  tabs: { gap: 8 },
  tab: {
    paddingHorizontal: 12,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#F6F9FD',
  },
  activeTab: { backgroundColor: LightColors.primarySoft },
  tabText: { ...MobileTypography.caption, color: LightColors.secondaryText, fontWeight: '600' },
  activeTabText: { color: LightColors.primary },
  body: { paddingHorizontal: 18 },
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
  shelterCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 18,
    marginBottom: 13,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7EEF8',
  },
  shelterHeading: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  shelterIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: LightColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shelterName: {
    color: LightColors.text,
    ...MobileTypography.body,
    fontWeight: '700',
    marginBottom: 4,
  },
  status: {
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  statusText: { ...MobileTypography.badge, fontWeight: '600' },
  address: { ...MobileTypography.body, color: LightColors.secondaryText, marginVertical: 10 },
  progress: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E7EEF8',
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  cardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  detailsLink: {
    marginLeft: 'auto',
    color: LightColors.primary,
    ...MobileTypography.caption,
    fontWeight: '600',
  },
  empty: { alignItems: 'center', padding: 35, gap: 12 },
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
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  secondaryButtonText: {
    color: LightColors.primary,
    ...MobileTypography.button,
    fontWeight: '600',
  },
  disabled: { opacity: 0.45 },
  success: {
    backgroundColor: '#E5F7ED',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  successText: { color: '#07834B', ...MobileTypography.caption, flex: 1 },
  dismissSuccess: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  detailHeader: { marginTop: 5 },
  detailCapacity: {
    backgroundColor: LightColors.primarySoft,
    padding: 18,
    borderRadius: 16,
    marginVertical: 16,
  },
  capacityValue: { color: LightColors.text, fontSize: 25, fontWeight: '800', marginBottom: 5 },
  facilityChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  facilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F6F9FD',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LightColors.border,
  },
  selectedFacility: { backgroundColor: LightColors.primary, borderColor: LightColors.primary },
  selectedFacilityText: { color: '#FFFFFF', fontWeight: '700' },
  manageSection: {
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: LightColors.border,
  },
  errorText: { color: LightColors.danger, ...MobileTypography.caption, marginVertical: 10 },
  formCaption: { ...MobileTypography.caption, color: LightColors.secondaryText, marginBottom: 18 },
  formSection: { marginTop: 24 },
  history: { marginTop: 20, gap: 8 },
});
import { officerDistrictError } from '@/utils/formValidation';
