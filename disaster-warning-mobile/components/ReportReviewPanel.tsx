import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Select } from './Select';
import { LightColors, MobileTypography } from '@/constants/colors';
import type { HazardEvent } from '@/types/resources';

type Decision = 'verify' | 'reject' | 'info';
const choices: {
  id: Decision;
  title: string;
  detail: string;
  color: string;
  tint: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    id: 'verify',
    title: 'Verify report',
    detail: 'The observation is accurate and reliable.',
    color: '#07834B',
    tint: '#E5F7ED',
    icon: 'checkmark-circle-outline',
  },
  {
    id: 'info',
    title: 'Request more information',
    detail: 'Ask the submitter for missing details.',
    color: LightColors.primary,
    tint: LightColors.primarySoft,
    icon: 'chatbubble-ellipses-outline',
  },
  {
    id: 'reject',
    title: 'Reject report',
    detail: 'The observation is incorrect or unsuitable.',
    color: LightColors.danger,
    tint: '#FFF0F2',
    icon: 'close-circle-outline',
  },
];
export function ReportReviewPanel({
  action,
  onAction,
  events,
  eventId,
  onEvent,
  onAddEvent,
  note,
  onNote,
  busy,
  error,
  onSubmit,
}: {
  action: Decision | null;
  onAction: (action: Decision) => void;
  events: HazardEvent[];
  eventId: string;
  onEvent: (id: string) => void;
  onAddEvent?: () => void;
  note: string;
  onNote: (value: string) => void;
  busy: boolean;
  error: string;
  onSubmit: () => void;
}) {
  const selected = choices.find(choice => choice.id === action);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headingRow}>
          <View style={styles.headerIcon}>
            <Ionicons name="shield-checkmark-outline" size={25} color="#FFFFFF" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>OFFICER REVIEW</Text>
            <Text style={[styles.title, styles.headerTitle]}>Review decision</Text>
          </View>
        </View>
        <Text style={styles.helper}>
          Check the photos, location and description, then choose what happens next.
        </Text>
      </View>
      <View style={styles.body}>
        <View style={styles.choices}>
          {choices.map(choice => (
            <TouchableOpacity
              key={choice.id}
              accessibilityRole="radio"
              accessibilityLabel={choice.title}
              accessibilityState={{ checked: action === choice.id, disabled: busy }}
              disabled={busy}
              onPress={() => onAction(choice.id)}
              style={[
                styles.choice,
                action === choice.id && { borderColor: choice.color, backgroundColor: choice.tint },
                busy && styles.disabled,
              ]}
            >
              <View
                style={[
                  styles.choiceIcon,
                  { backgroundColor: action === choice.id ? choice.color : choice.tint },
                ]}
              >
                <Ionicons
                  name={choice.icon}
                  size={23}
                  color={action === choice.id ? '#FFFFFF' : choice.color}
                />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.label, action === choice.id && { color: choice.color }]}>
                  {choice.title}
                </Text>
                <Text style={styles.caption}>{choice.detail}</Text>
              </View>
              <Ionicons
                name={action === choice.id ? 'radio-button-on' : 'radio-button-off'}
                size={21}
                color={action === choice.id ? choice.color : LightColors.mutedText}
              />
            </TouchableOpacity>
          ))}
        </View>
        {selected && (
          <View style={styles.form}>
            <Text style={styles.title}>
              {action === 'verify'
                ? 'Verification details'
                : action === 'reject'
                  ? 'Reason for rejection'
                  : 'Message to the submitter'}
            </Text>
            {action === 'verify' && (
              <>
                <Select
                  appearance="light"
                  label="Related hazard event (optional)"
                  placeholder="Choose an event"
                  value={eventId}
                  options={[
                    {
                      value: '',
                      label: 'No related event',
                      description: 'Verify this report without linking it to an event.',
                    },
                    ...events.map(event => ({
                      value: event.id,
                      label: event.title,
                      description: event.affectedDistricts.join(', '),
                    })),
                  ]}
                  onSelect={onEvent}
                  disabled={busy}
                  footerAction={
                    onAddEvent
                      ? {
                          label: 'Add hazard event',
                          description: 'Missing the event you need? Create it here.',
                          onPress: onAddEvent,
                        }
                      : undefined
                  }
                />
                <Text style={styles.caption}>
                  {eventId
                    ? 'This verified report will appear with the selected hazard event.'
                    : 'You can verify the report even if no related event is listed.'}
                </Text>
              </>
            )}
            <Text style={styles.label}>
              {action === 'verify'
                ? 'Review note (optional)'
                : action === 'reject'
                  ? 'Explain your decision *'
                  : 'What information is needed? *'}
            </Text>
            <TextInput
              accessibilityLabel={
                action === 'verify'
                  ? 'Review note'
                  : action === 'reject'
                    ? 'Rejection reason'
                    : 'Information request'
              }
              value={note}
              onChangeText={onNote}
              editable={!busy}
              multiline
              scrollEnabled={false}
              style={styles.input}
              placeholder={
                action === 'verify'
                  ? 'Add any findings that support your decision.'
                  : action === 'reject'
                    ? 'Explain why this report cannot be accepted.'
                    : 'For example: please add a clearer photo and confirm whether vehicles can pass.'
              }
              placeholderTextColor={LightColors.mutedText}
            />
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <Text style={styles.caption}>
              {action === 'verify'
                ? 'The report status will change to Verified.'
                : action === 'reject'
                  ? 'The report will be rejected and your reason saved.'
                  : 'The submitter will receive your request and can reply with more details.'}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                selected.title === 'Request more information'
                  ? 'Send information request'
                  : selected.title
              }
              disabled={busy}
              accessibilityState={{ disabled: busy, busy }}
              onPress={onSubmit}
              style={[styles.submit, { backgroundColor: selected.color }, busy && { opacity: 0.6 }]}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name={selected.icon} size={21} color="#FFFFFF" />
                  <Text style={styles.submitText}>
                    {action === 'info' ? 'Send information request' : selected.title}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BBD4FF',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: LightColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  header: { backgroundColor: LightColors.primary, padding: 16 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { ...MobileTypography.small, fontWeight: '700', letterSpacing: 1, color: '#FFFFFF' },
  headerTitle: { color: '#FFFFFF', marginTop: 2 },
  body: { padding: 16 },
  choiceIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
  title: { ...MobileTypography.section, fontWeight: '700', color: LightColors.text },
  helper: {
    ...MobileTypography.caption,
    color: '#FFFFFF',
    marginTop: 12,
  },
  choices: { gap: 10 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    minHeight: 76,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: LightColors.border,
  },
  flex: { flex: 1, minWidth: 0 },
  label: { ...MobileTypography.label, color: LightColors.text, fontWeight: '600' },
  caption: { ...MobileTypography.caption, color: LightColors.secondaryText, marginTop: 4 },
  form: {
    gap: 12,
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: LightColors.border,
  },
  input: {
    ...MobileTypography.body,
    color: LightColors.text,
    padding: 12,
    minHeight: 108,
    textAlignVertical: 'top',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LightColors.border,
    backgroundColor: LightColors.surfaceMuted,
  },
  error: { ...MobileTypography.caption, color: LightColors.danger },
  submit: {
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { ...MobileTypography.button, color: '#FFFFFF', fontWeight: '700' },
});
