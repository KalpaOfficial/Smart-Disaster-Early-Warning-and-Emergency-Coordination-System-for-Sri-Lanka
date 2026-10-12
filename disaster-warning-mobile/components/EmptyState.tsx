/**
 * Professional Mobile Empty State Component.
 * Supports vector icons, glowing halo orbs, clear messaging, and primary CTA.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Colors, FontSize, Spacing, LightColors, MobileTypography } from '@/constants/colors';

interface EmptyStateProps {
  iconName?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionTitle?: string;
  onAction?: () => void;
  appearance?: 'dark' | 'light';
}

export function EmptyState({
  iconName = 'document-text-outline',
  title,
  message,
  actionTitle,
  onAction,
  appearance = 'dark',
}: EmptyStateProps) {
  if (appearance === 'light')
    return (
      <View style={styles.container}>
        <View style={styles.lightIcon}>
          <Ionicons name={iconName} size={36} color={LightColors.primary} />
        </View>
        <Text style={styles.lightTitle}>{title}</Text>
        {!!message && <Text style={styles.lightMessage}>{message}</Text>}
        {!!actionTitle && !!onAction && (
          <TouchableOpacity
            onPress={onAction}
            accessibilityRole="button"
            style={styles.lightButton}
          >
            <Text style={styles.lightButtonText}>{actionTitle}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  return (
    <View style={styles.container}>
      <View style={styles.iconHalo}>
        <View style={styles.iconInner}>
          <Ionicons name={iconName} size={32} color={Colors.accent.primary} />
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          variant="primary"
          size="sm"
          onPress={onAction}
          style={styles.actionBtn}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lightIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: LightColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  lightTitle: {
    ...MobileTypography.section,
    color: LightColors.text,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  lightMessage: {
    ...MobileTypography.body,
    color: LightColors.secondaryText,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 24,
  },
  lightButton: {
    minHeight: 48,
    backgroundColor: LightColors.primary,
    borderRadius: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightButtonText: { ...MobileTypography.button, color: '#FFFFFF', fontWeight: '700' },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl * 1.5,
    paddingHorizontal: Spacing.xl,
  },
  iconHalo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    shadowColor: Colors.accent.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  iconInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  message: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
    maxWidth: 280,
  },
  actionBtn: {
    minWidth: 160,
  },
});
