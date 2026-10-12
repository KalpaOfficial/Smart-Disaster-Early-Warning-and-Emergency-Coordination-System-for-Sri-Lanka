import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormModal } from './FormModal';
import { Input } from './Input';
import { OfficerButton } from './OfficerUi';
import { LightColors, MobileTypography } from '@/constants/colors';
import { FormError } from './FormError';

export function MultiSelectField({
  label,
  values,
  options,
  onChange,
  disabled = false,
  error,
}: {
  label: string;
  values: string[];
  options: readonly string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = options.filter(option =>
    option.toLowerCase().includes(search.trim().toLowerCase())
  );
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${values.length} selected`}
        disabled={disabled}
        onPress={() => {
          setSearch('');
          setVisible(true);
        }}
        style={styles.trigger}
      >
        <View style={styles.flex}>
          <Text style={styles.value}>{values.length ? values.join(', ') : 'Choose areas'}</Text>
          <Text style={styles.caption}>{values.length} selected</Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={LightColors.secondaryText} />
      </TouchableOpacity>
      <FormError message={error} />
      <FormModal
        appearance="light"
        visible={visible}
        title={label.replace(' *', '')}
        onClose={() => setVisible(false)}
      >
        <Input
          appearance="light"
          label="Search areas"
          placeholder="Search areas"
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.options}>
          {filtered.map(option => (
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityLabel={option}
              accessibilityState={{ checked: values.includes(option) }}
              key={option}
              onPress={() =>
                onChange(
                  values.includes(option)
                    ? values.filter(value => value !== option)
                    : [...values, option]
                )
              }
              style={[styles.option, values.includes(option) && styles.selected]}
            >
              <Text style={[styles.value, styles.flex]}>{option}</Text>
              <Ionicons
                name={values.includes(option) ? 'checkbox' : 'square-outline'}
                size={24}
                color={LightColors.primary}
              />
            </TouchableOpacity>
          ))}
        </View>
        {!filtered.length && <Text style={styles.caption}>No matching areas.</Text>}
        <OfficerButton
          title={`Done (${values.length} selected)`}
          onPress={() => setVisible(false)}
          style={{ marginTop: 16 }}
        />
      </FormModal>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { ...MobileTypography.label, fontWeight: '600', color: LightColors.text, marginBottom: 8 },
  flex: { flex: 1, minWidth: 0 },
  value: { ...MobileTypography.body, color: LightColors.text },
  caption: { ...MobileTypography.caption, color: LightColors.secondaryText, marginTop: 4 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: LightColors.surfaceMuted,
    borderColor: LightColors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    minHeight: 56,
  },
  options: { gap: 8 },
  option: {
    padding: 12,
    borderRadius: 12,
    minHeight: 48,
    borderColor: LightColors.border,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selected: { backgroundColor: LightColors.primarySoft, borderColor: LightColors.primary },
});
