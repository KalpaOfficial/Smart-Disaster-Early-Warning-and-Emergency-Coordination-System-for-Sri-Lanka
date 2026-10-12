import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { FormModal } from './FormModal';
import { HazardEventFields, hazardEventFieldErrors } from './HazardEventFields';
import { useFormFeedback } from '@/hooks/useFormFeedback';
import { OfficerButton } from './OfficerUi';
import { useAuth } from '@/hooks/useAuth';
import { createHazardEvent } from '@/services/hazardEventService';
import {
  EVENT_LEVELS,
  normalizeHazardEvent,
  type HazardEventDetails,
} from '@/utils/hazardEventForm';
import { LightColors, MobileTypography } from '@/constants/colors';
import type { HazardEvent } from '@/types/resources';

export function CreateHazardEventModal({
  onClose,
  onCreated,
  district,
}: {
  onClose: () => void;
  onCreated: (event: HazardEvent) => void;
  district?: string;
}) {
  const { state } = useAuth();
  const [draft, setDraft] = useState<HazardEventDetails>({
    title: '',
    hazardType: 'flood',
    description: '',
    affectedDistricts: district ? [district] : state.user?.district ? [state.user.district] : [],
    affectedRiverBasins: [],
    warningLevel: EVENT_LEVELS[0],
  });
  const [busy, setBusy] = useState(false);
  const feedback = useFormFeedback(draft, true);
  const { error, setError } = feedback;
  if (state.user?.role !== 'dmc_officer') return null;
  const save = async () => {
    if (busy) return;
    const errors = hazardEventFieldErrors(draft);
    feedback.setErrors(errors);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setError('');
    try {
      const details = normalizeHazardEvent(draft);
      const id = await createHazardEvent({ ...details, status: 'active' });
      onCreated({ ...details, id, status: 'active', startDate: new Date().toISOString() });
    } catch (err) {
      setError((err as Error).message || 'Could not create the event. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormModal
      appearance="light"
      visible
      title="Add hazard event"
      feedbackKey={feedback.attempt}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <Text style={styles.help}>
        Create the missing event and return to your review. Your review note will be kept. This does
        not send a public warning.
      </Text>
      <HazardEventFields draft={draft} setDraft={setDraft} busy={busy} errors={feedback.errors} />
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <OfficerButton
        title="Create and select event"
        loading={busy}
        onPress={() => {
          void save();
        }}
      />
    </FormModal>
  );
}
const styles = StyleSheet.create({
  help: { ...MobileTypography.caption, color: LightColors.secondaryText, marginBottom: 20 },
  error: { ...MobileTypography.caption, color: LightColors.danger, marginBottom: 12 },
});
