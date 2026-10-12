export type FieldErrors = Record<string, string | undefined>;

/** Collect every missing field so users can correct the form in one pass. */
export function requiredFields(
  values: Record<string, unknown>,
  labels: Record<string, string>
): FieldErrors {
  const errors: FieldErrors = {};
  for (const [field, label] of Object.entries(labels)) {
    const value = values[field];
    if (
      value == null ||
      (typeof value === 'string' && !value.trim()) ||
      (Array.isArray(value) && !value.length)
    )
      errors[field] = `${label} is required.`;
  }
  return errors;
}

export function officerDistrictError(selected?: string, assigned?: string): string | undefined {
  if (selected && assigned && selected !== assigned)
    return `Your District Officer account is assigned to ${assigned}. Select ${assigned}, or ask the ${selected} District Officer to manage this record.`;
}

export function positiveQuantityError(value: string, label: string): string | undefined {
  if (!value.trim()) return `${label} is required.`;
  if (!Number.isSafeInteger(Number(value)) || Number(value) <= 0)
    return `${label} must be a positive whole number.`;
}
