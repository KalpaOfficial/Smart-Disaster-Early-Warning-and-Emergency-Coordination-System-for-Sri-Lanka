/**
 * Report Status Badge component for UC02: Submit and Verify Ground Report.
 * Displays tactile pills for pending_verification, verified, rejected, info_requested.
 */
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Spacing, FontSize, MobileTypography } from '@/constants/colors';
import { getReportStatusDefinition } from '@/constants/observationTypes';
import type { ReportStatus } from '@/types/groundReport';

interface ReportStatusBadgeProps {
  status: ReportStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  style?: ViewStyle;
  appearance?: 'dark' | 'light';
}

export function ReportStatusBadge({
  status,
  size = 'md',
  showIcon = true,
  style,
  appearance = 'dark',
}: ReportStatusBadgeProps) {
  const def = getReportStatusDefinition(status);
  const color =
    appearance === 'light'
      ? {
          pending_verification: '#946000',
          verified: '#07834B',
          rejected: '#C52A39',
          info_requested: '#0066CC',
        }[status] || '#946000'
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
        {def.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lightBadge: { maxWidth: '100%', flexShrink: 1, paddingHorizontal: 10, paddingVertical: 6 },
  lightText: { ...MobileTypography.badge, flexShrink: 1, letterSpacing: 0, textTransform: 'none' },
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
    letterSpacing: 0.4,
    textTransform: 'uppercase',
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
