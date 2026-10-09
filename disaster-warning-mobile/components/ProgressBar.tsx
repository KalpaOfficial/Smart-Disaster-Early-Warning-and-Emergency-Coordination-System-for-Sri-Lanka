/**
 * Animated Tactical Progress Bar for shelter capacity and supply levels.
 * Dynamic semantic color transitions (emerald -> amber -> rose).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, FontSize, Spacing } from '@/constants/colors';

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  unit?: string;
  showPercentage?: boolean;
  height?: number;
  color?: string;
}

export function ProgressBar({
  current,
  total,
  label,
  unit,
  showPercentage = true,
  height = 8,
  color,
}: ProgressBarProps) {
  const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;

  // Auto-color based on percentage: emerald (<70%) -> amber (70-89%) -> rose (>=90%)
  const autoColor =
    percentage >= 90
      ? Colors.danger
      : percentage >= 70
        ? Colors.warning
        : Colors.success;

  const barColor = color || autoColor;

  return (
    <View style={styles.container}>
      {(Boolean(label) || showPercentage) && (
        <View style={styles.header}>
          {Boolean(label) && <Text style={styles.label}>{label}</Text>}
          <Text style={styles.value}>
            {current.toLocaleString()}{unit ? ` ${unit}` : ''} / {total.toLocaleString()}{unit ? ` ${unit}` : ''}
            {showPercentage && (
              <Text style={[styles.pctText, { color: barColor }]}>
                {` (${Math.round(percentage)}%)`}
              </Text>
            )}
          </Text>
        </View>
      )}
      <View style={[styles.track, { height }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${percentage}%`,
              backgroundColor: barColor,
              height,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  value: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    fontWeight: '600',
  },
  pctText: {
    fontWeight: '700',
  },
  track: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: BorderRadius.full,
  },
});
