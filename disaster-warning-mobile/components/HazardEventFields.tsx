import React from 'react';
import { Input } from './Input';
import { Select } from './Select';
import { MultiSelectField } from './MultiSelectField';
import { SRI_LANKAN_DISTRICTS } from '@/constants/districts';
import { SRI_LANKA_RIVER_BASINS } from '@/constants/riverBasins';
import { EVENT_LEVELS, HAZARD_TYPES, type HazardEventDetails } from '@/utils/hazardEventForm';
import type { HazardEvent } from '@/types/resources';
import { requiredFields, type FieldErrors } from '@/utils/formValidation';
export function hazardEventFieldErrors(draft: HazardEventDetails): FieldErrors {
  const errors = requiredFields(draft, {
    title: 'Event title',
    hazardType: 'Hazard type',
    description: 'Event description',
    affectedDistricts: 'Affected districts',
  });
  if (draft.title.length > 150) errors.title = 'Use no more than 150 characters.';
  if (draft.description.length > 2000) errors.description = 'Use no more than 2,000 characters.';
  return errors;
}
export function HazardEventFields({
  draft,
  setDraft,
  busy,
  errors = {},
}: {
  draft: HazardEventDetails;
  setDraft: React.Dispatch<React.SetStateAction<HazardEventDetails>>;
  busy: boolean;
  errors?: FieldErrors;
}) {
  return (
    <>
      {' '}
      <Input
        appearance="light"
        label="Event title *"
        error={errors.title}
        value={draft.title}
        onChangeText={title => setDraft(value => ({ ...value, title }))}
        editable={!busy}
        maxLength={150}
        placeholder="For example: Kelani river flooding"
        multiline
        scrollEnabled={false}
      />
      <Select
        appearance="light"
        label="Hazard type *"
        error={errors.hazardType}
        value={draft.hazardType}
        options={HAZARD_TYPES}
        disabled={busy}
        onSelect={hazardType =>
          setDraft(value => ({ ...value, hazardType: hazardType as HazardEvent['hazardType'] }))
        }
      />
      <Select
        appearance="light"
        label="Event alert level *"
        error={errors.warningLevel}
        value={draft.warningLevel || EVENT_LEVELS[0]}
        options={EVENT_LEVELS.map(level => ({ value: level, label: level }))}
        disabled={busy}
        onSelect={warningLevel => setDraft(value => ({ ...value, warningLevel }))}
      />
      <MultiSelectField
        label="Affected districts *"
        error={errors.affectedDistricts}
        values={draft.affectedDistricts}
        options={SRI_LANKAN_DISTRICTS}
        disabled={busy}
        onChange={affectedDistricts => setDraft(value => ({ ...value, affectedDistricts }))}
      />
      <MultiSelectField
        label="River basins (optional)"
        values={draft.affectedRiverBasins || []}
        options={Object.keys(SRI_LANKA_RIVER_BASINS)}
        disabled={busy}
        onChange={affectedRiverBasins => setDraft(value => ({ ...value, affectedRiverBasins }))}
      />
      <Input
        appearance="light"
        label="Event description *"
        error={errors.description}
        value={draft.description}
        onChangeText={description => setDraft(value => ({ ...value, description }))}
        editable={!busy}
        multiline
        scrollEnabled={false}
        maxLength={2000}
        inputStyle={{ minHeight: 120, textAlignVertical: 'top' }}
        placeholder="Describe the hazard, affected places and current conditions."
      />
    </>
  );
}
