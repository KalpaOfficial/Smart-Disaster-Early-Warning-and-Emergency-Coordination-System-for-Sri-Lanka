/**
 * Observation Type Badge component for UC02: Submit and Verify Ground Report.
 * Displays visually distinct badges for Rising Water, Blocked Road, Landslide Crack, Other.
 */
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Spacing, FontSize, MobileTypography } from '@/constants/colors';
import { getObservationTypeDefinition } from '@/constants/observationTypes';
import type { ObservationType } from '@/types/groundReport';

interface ObservationTypeBadgeProps {
  type: ObservationType;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  short?: boolean;
  style?: ViewStyle;
  appearance?: 'dark' | 'light';
}

export function ObservationTypeBadge({
  type,
  size = 'md',
  showIcon = true,
  short = false,
  style,
  appearance = 'dark',
}: ObservationTypeBadgeProps) {
  const def = getObservationTypeDefinition(type);
  const color =
    appearance === 'light'
      ? {
          rising_water: '#0066CC',
          blocked_road: '#946000',
          landslide_crack: '#C52A39',
          other: '#6941C6',
        }[type] || '#6941C6'
      : def.color;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: def.bgColor,
          borderColor: color,
        },
        size === 'sm' && styles.badgeSm,
        size === 'lg' && styles.badgeLg,
        appearance === 'light' && styles.lightBadge,
        style,
      ]}
    >
      {showIcon && (
        <Ionicons
          name={def.icon}
          size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14}
          color={color}
        />
      )}
      <Text
        style={[
          styles.text,
          { color },
          size === 'sm' && styles.textSm,
          size === 'lg' && styles.textLg,
          appearance === 'light' && styles.lightText,
        ]}
      >
        {short ? def.shortLabel : def.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lightBadge: { maxWidth: '100%', flexShrink: 1, paddingHorizontal: 10, paddingVertical: 6 },
  lightText: { ...MobileTypography.badge, flexShrink: 1, letterSpacing: 0 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: Spacing.xs,
  },
  badgeSm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: 4,
  },
  badgeLg: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs + 2,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  textSm: {
    fontSize: 10,
    fontWeight: '700',
  },
  textLg: {
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
});
