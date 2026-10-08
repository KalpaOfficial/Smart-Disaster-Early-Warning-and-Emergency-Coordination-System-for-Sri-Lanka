/**
 * Report Status Badge component for UC02: Submit and Verify Ground Report.
 * Displays tactile pills for pending_verification, verified, rejected, info_requested.
 */
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing, FontSize } from '@/constants/colors';
import { getReportStatusDefinition } from '@/constants/observationTypes';
import type { ReportStatus } from '@/types/groundReport';

interface ReportStatusBadgeProps {
  status: ReportStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  style?: ViewStyle;
}

export function ReportStatusBadge({
  status,
  size = 'md',
  showIcon = true,
  style,
}: ReportStatusBadgeProps) {
  const def = getReportStatusDefinition(status);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: def.bgColor,
          borderColor: def.color,
        },
        size === 'sm' && styles.badgeSm,
        size === 'lg' && styles.badgeLg,
        style,
      ]}
    >
      {showIcon && (
        <Ionicons
          name={def.icon}
          size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14}
          color={def.color}
        />
      )}
      <Text
        style={[
          styles.text,
          { color: def.color },
          size === 'sm' && styles.textSm,
          size === 'lg' && styles.textLg,
        ]}
      >
        {def.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
