import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormModal } from './FormModal';
import { LightColors, MobileTypography } from '@/constants/colors';

export function ReportDatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(new Date());
  const year = month.getFullYear(),
    index = month.getMonth();
  const offset = new Date(year, index, 1).getDay();
  const count = new Date(year, index + 1, 0).getDate();
  const choose = (day: number) => {
    onChange(`${year}-${String(index + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    setOpen(false);
  };
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.input}
        onPress={() => {
          setMonth(value ? new Date(`${value}T12:00:00`) : new Date());
          setOpen(true);
        }}
      >
        <Text style={[styles.text, !value && styles.muted]}>
          {value
            ? new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : 'Select date'}
        </Text>
        <Ionicons name="calendar-outline" size={20} color={LightColors.primary} />
      </TouchableOpacity>
      <FormModal visible={open} onClose={() => setOpen(false)} title={label} appearance="light">
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={styles.arrow}
            onPress={() => setMonth(new Date(year, index - 1, 1))}
          >
            <Ionicons name="chevron-back" size={22} color={LightColors.primary} />
          </TouchableOpacity>
          <Text style={styles.label}>
            {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={styles.arrow}
            onPress={() => setMonth(new Date(year, index + 1, 1))}
          >
            <Ionicons name="chevron-forward" size={22} color={LightColors.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.grid}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <Text key={day} style={styles.weekday}>
              {day}
            </Text>
          ))}
          {Array.from({ length: offset + count }, (_, i) => {
            const day = i - offset + 1;
            const iso = `${year}-${String(index + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            return day < 1 ? (
              <View key={i} style={styles.day} />
            ) : (
              <TouchableOpacity
                key={i}
                accessibilityRole="button"
                accessibilityLabel={iso}
                accessibilityState={{ selected: value === iso }}
                style={[styles.day, value === iso && styles.selected]}
                onPress={() => choose(day)}
              >
                <Text style={[styles.text, value === iso && { color: '#FFFFFF' }]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.action}
            onPress={() => {
              onChange('');
              setOpen(false);
            }}
          >
            <Text style={styles.link}>Clear date</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.action}
            onPress={() => {
              const today = new Date();
              onChange(
                `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
              );
              setOpen(false);
            }}
          >
            <Text style={styles.link}>Today</Text>
          </TouchableOpacity>
        </View>
      </FormModal>
    </View>
  );
}
const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { ...MobileTypography.caption, color: LightColors.text, fontWeight: '600' },
  text: { ...MobileTypography.body, color: LightColors.text },
  muted: { color: LightColors.mutedText },
  input: {
    minHeight: 54,
    padding: 14,
    borderWidth: 1,
    borderColor: LightColors.border,
    borderRadius: 12,
    backgroundColor: LightColors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  arrow: { padding: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: {
    width: '14.2857%',
    textAlign: 'center',
    ...MobileTypography.caption,
    color: LightColors.secondaryText,
    paddingVertical: 10,
  },
  day: {
    width: '14.2857%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  selected: { backgroundColor: LightColors.primary },
  action: { padding: 12 },
  link: { ...MobileTypography.button, color: LightColors.primary, fontWeight: '700' },
});
