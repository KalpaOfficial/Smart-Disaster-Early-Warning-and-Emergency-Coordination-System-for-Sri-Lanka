import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { ScreenContainer } from './ScreenContainer';
import {
  OfficerHero,
  OfficerCard as Card,
  OfficerButton as Button,
  officerScreenStyle,
  officerShellStyle,
} from './OfficerUi';
import { Input } from './Input';
import { HazardEventFields, hazardEventFieldErrors } from './HazardEventFields';
import { useFormFeedback } from '@/hooks/useFormFeedback';
import { FormModal } from './FormModal';
import { MobileNavBar } from './MobileNavBar';
import { ConfirmationDialog } from './ConfirmationDialog';
import { EmptyState } from './EmptyState';
import { LightColors, MobileTypography } from '@/constants/colors';
import { EVENT_LEVELS, HAZARD_TYPES, type HazardEventDetails } from '@/utils/hazardEventForm';
import {
  subscribeToHazardEvents,
  createHazardEvent,
  updateHazardEvent,
  setHazardEventStatus,
} from '@/services/hazardEventService';
import type { HazardEvent } from '@/types/resources';

export function HazardEventDirectory() {
  const router = useRouter();
  const { state } = useAuth();
  const officer = state.user?.role === 'dmc_officer';
  const [events, setEvents] = useState<HazardEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState<'active' | 'closed' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<HazardEvent | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [draft, setDraft] = useState<HazardEventDetails>(emptyDraft());
  const [busy, setBusy] = useState(false);
  const eventFeedback = useFormFeedback(draft, formVisible);
  const { error: formError, setError: setFormError } = eventFeedback;
  const [notice, setNotice] = useState('');
  const [statusEvent, setStatusEvent] = useState<HazardEvent | null>(null);
  const [statusError, setStatusError] = useState('');
  function emptyDraft(): HazardEventDetails {
    return {
      title: '',
      hazardType: 'flood',
      description: '',
      affectedDistricts: state.user?.district ? [state.user.district] : [],
      affectedRiverBasins: [],
      warningLevel: EVENT_LEVELS[0],
    };
  }
  useEffect(() => {
    if (!officer) return;
    setLoading(true);
    setError('');
    return subscribeToHazardEvents(
      items => {
        setEvents(items);
        setLoading(false);
        setError('');
      },
      () => {
        setLoading(false);
        setError('Could not load hazard events. Try again.');
      }
    );
  }, [officer, revision]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const edit = (event: HazardEvent | null) => {
    setEditing(event);
    setDraft(
      event
        ? {
            title: event.title,
            hazardType: event.hazardType,
            description: event.description,
            affectedDistricts: [...event.affectedDistricts],
            affectedRiverBasins: [...(event.affectedRiverBasins || [])],
            warningLevel: event.warningLevel || EVENT_LEVELS[0],
          }
        : emptyDraft()
    );
    setFormError('');
    setFormVisible(true);
  };
  const save = async () => {
    if (busy || !officer) return;
    const errors = hazardEventFieldErrors(draft);
    eventFeedback.setErrors(errors);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setFormError('');
    try {
      if (editing) await updateHazardEvent(editing.id, draft);
      else await createHazardEvent({ ...draft, status: 'active' });
      setFormVisible(false);
      setSearch('');
      setFilter(editing?.status || 'active');
      setNotice(
        editing
          ? 'Event details updated.'
          : 'Hazard event created. You can now issue warnings or link verified reports.'
      );
    } catch (err) {
      setFormError((err as Error).message || 'Could not save the event. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const changeStatus = async () => {
    if (!statusEvent || busy || !officer) return;
    setBusy(true);
    setStatusError('');
    try {
      await setHazardEventStatus(
        statusEvent.id,
        statusEvent.status === 'active' ? 'closed' : 'active'
      );
      setNotice(
        statusEvent.status === 'active'
          ? 'Event closed. Its reports and warning history are retained.'
          : 'Event reopened and available for new warnings and reports.'
      );
      setStatusEvent(null);
    } catch (err) {
      setStatusError((err as Error).message || 'Could not update the event status.');
    } finally {
      setBusy(false);
    }
  };
  if (!officer)
    return (
      <ScreenContainer style={officerScreenStyle} contentStyle={officerShellStyle}>
        <EmptyState
          appearance="light"
          title="DMC officer access required"
          message="Only DMC officers can create and manage hazard events."
          actionTitle="Back to home"
          onAction={() => router.replace('/(app)')}
        />
      </ScreenContainer>
    );
  const visibleEvents = events.filter(
    event =>
      (filter === 'all' || event.status === filter) &&
      `${event.title} ${event.hazardType} ${event.affectedDistricts.join(' ')} ${event.affectedRiverBasins?.join(' ') || ''}`
        .toLowerCase()
        .includes(search.trim().toLowerCase())
  );
  return (
    <ScreenContainer style={officerScreenStyle} contentStyle={officerShellStyle}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <OfficerHero
          title="Manage hazard events"
          description="Create events, update affected areas and keep their status current."
          caption="DMC Officer"
          icon="warning-outline"
          onBack={() => router.back()}
        />
        <Card style={styles.filters}>
          <Input
            appearance="light"
            placeholder="Search events or districts"
            value={search}
            onChangeText={setSearch}
          />
          <View style={styles.tabs}>
            {(['active', 'closed', 'all'] as const).map(value => (
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityLabel={`${value === 'all' ? 'All events' : value === 'active' ? 'Active events' : 'Closed events'}`}
                accessibilityState={{ selected: filter === value }}
                key={value}
                onPress={() => setFilter(value)}
                style={[styles.tab, filter === value && styles.selected]}
              >
                <Text style={[styles.tabText, filter === value && styles.blue]}>
                  {value === 'all' ? 'All' : value === 'active' ? 'Active' : 'Closed'} (
                  {events.filter(event => value === 'all' || event.status === value).length})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
        <Button
          title="Create hazard event"
          onPress={() => edit(null)}
          style={{ marginBottom: 18 }}
        />
        {!!notice && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Dismiss message"
              onPress={() => setNotice('')}
              style={styles.dismiss}
            >
              <Ionicons name="close" size={20} color="#07834B" />
            </TouchableOpacity>
          </View>
        )}
        {!!error && (
          <Card>
            <Text style={styles.error}>{error}</Text>
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => setRevision(value => value + 1)}
            />
          </Card>
        )}
        {loading ? (
          <ActivityIndicator color={LightColors.primary} />
        ) : !error && !visibleEvents.length ? (
          <EmptyState
            appearance="light"
            title="No events to show"
            message={
              search
                ? 'Try another event name or district.'
                : 'Create a hazard event to start coordinating warnings and verified reports.'
            }
          />
        ) : (
          visibleEvents.map(event => (
            <Card key={event.id} style={styles.event}>
              <View style={styles.row}>
                <Text style={styles.caption}>
                  {HAZARD_TYPES.find(type => type.value === event.hazardType)?.label ||
                    event.hazardType}
                </Text>
                <Text style={[styles.status, event.status === 'closed' && styles.closed]}>
                  {event.status === 'active' ? 'Active' : 'Closed'}
                </Text>
              </View>
              <Text style={styles.title}>{event.title}</Text>
              <Text style={styles.caption}>{event.affectedDistricts.join(', ')}</Text>
              <Text style={styles.body} numberOfLines={3}>
                {event.description}
              </Text>
              <Button
                title="View event details"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/(app)/warnings/[eventId]',
                    params: { eventId: event.id },
                  })
                }
              />
              <View style={styles.actions}>
                <Button
                  title="Edit event"
                  variant="outline"
                  onPress={() => edit(event)}
                  style={styles.flex}
                />
                <Button
                  title={event.status === 'active' ? 'Close event' : 'Reopen event'}
                  variant={event.status === 'active' ? 'danger' : 'success'}
                  onPress={() => {
                    setStatusEvent(event);
                    setStatusError('');
                  }}
                  style={styles.flex}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
      <FormModal
        appearance="light"
        visible={formVisible}
        feedbackKey={eventFeedback.attempt}
        title={editing ? 'Edit hazard event' : 'Create hazard event'}
        onClose={() => {
          if (!busy) setFormVisible(false);
        }}
      >
        <Text style={styles.formHelp}>
          {editing
            ? 'Update the event details. Existing warnings and reports stay linked.'
            : 'New events start as active. Creating an event does not send a public warning.'}
        </Text>
        <HazardEventFields
          draft={draft}
          setDraft={setDraft}
          busy={busy}
          errors={eventFeedback.errors}
        />
        {!!formError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {formError}
          </Text>
        )}
        <Button
          title={editing ? 'Save event changes' : 'Create event'}
          loading={busy}
          onPress={() => {
            void save();
          }}
        />
      </FormModal>
      <ConfirmationDialog
        visible={Boolean(statusEvent)}
        title={
          statusEvent?.status === 'active'
            ? 'Close this hazard event?'
            : 'Reopen this hazard event?'
        }
        message={
          statusEvent?.status === 'active'
            ? 'It will no longer appear in active event selectors. Reports and warning history will remain. Previously issued warnings are not cancelled.'
            : 'It will be available again for new warnings, report links and resource coordination.'
        }
        confirmLabel={statusEvent?.status === 'active' ? 'Close event' : 'Reopen event'}
        onCancel={() => {
          if (!busy) setStatusEvent(null);
        }}
        onConfirm={() => {
          void changeStatus();
        }}
        busy={busy}
        error={statusError}
      />
      <MobileNavBar appearance="light" />
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 110 },
  filters: { marginTop: -40, marginBottom: 18 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 8,
  },
  selected: { backgroundColor: LightColors.primarySoft },
  tabText: { ...MobileTypography.caption, color: LightColors.secondaryText, fontWeight: '600' },
  blue: { color: LightColors.primary },
  event: { gap: 12, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { ...MobileTypography.section, color: LightColors.text, fontWeight: '700' },
  caption: { ...MobileTypography.caption, color: LightColors.secondaryText },
  body: { ...MobileTypography.body, color: LightColors.secondaryText },
  status: {
    ...MobileTypography.badge,
    backgroundColor: '#E5F7ED',
    color: '#07834B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  closed: { backgroundColor: '#EEF1F6', color: LightColors.secondaryText },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flex: { flexGrow: 1, flexBasis: 110 },
  error: { ...MobileTypography.caption, color: LightColors.danger, marginBottom: 12 },
  formHelp: { ...MobileTypography.caption, color: LightColors.secondaryText, marginBottom: 20 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#E5F7ED',
    marginBottom: 16,
  },
  noticeText: { ...MobileTypography.caption, color: '#07834B', flex: 1 },
  dismiss: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
