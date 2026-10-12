import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import { Card as BaseCard } from './Card';
import { ReportScreenHero } from './ReportScreenHero';
import { Colors as DarkColors, LightColors, MobileTypography } from '@/constants/colors';

/** Light tokens for the officer warning and verification workflows. */
export const OfficerColors = {
  ...DarkColors,
  bg: {
    ...DarkColors.bg,
    primary: LightColors.background,
    secondary: LightColors.surface,
    tertiary: LightColors.primarySoft,
    elevated: LightColors.surfaceMuted,
    glass: LightColors.surface,
  },
  accent: {
    ...DarkColors.accent,
    primary: LightColors.primary,
    secondary: '#6654C0',
    gradient: ['#0066FF', '#0066FF'] as const,
  },
  text: {
    primary: LightColors.text,
    secondary: LightColors.secondaryText,
    tertiary: LightColors.secondaryText,
    muted: LightColors.mutedText,
    inverse: '#FFFFFF',
    accent: LightColors.primary,
  },
  border: {
    ...DarkColors.border,
    default: LightColors.border,
    light: LightColors.border,
    focus: LightColors.primary,
  },
  success: '#07834B',
  warning: '#946000',
  danger: LightColors.danger,
  info: LightColors.primary,
};

export const OfficerFontSize = {
  micro: 12,
  xxs: 13,
  xs: 14,
  sm: 15,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 28,
  hero: 32,
};

export function OfficerCard(props: React.ComponentProps<typeof BaseCard>) {
  return <BaseCard {...props} style={[props.style, styles.card]} />;
}

export function OfficerButton({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  textStyle,
}: React.ComponentProps<typeof import('./Button').Button>) {
  const solid = variant === 'primary';
  const buttonIcon = React.isValidElement<{ color?: string }>(icon)
    ? React.cloneElement(icon, { color: solid ? '#FFFFFF' : LightColors.primary })
    : icon;
  const color =
    variant === 'danger'
      ? LightColors.danger
      : variant === 'success'
        ? '#07834B'
        : LightColors.primary;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: solid ? LightColors.primary : LightColors.primarySoft },
        style,
        (disabled || loading) && { opacity: 0.5 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={solid ? '#FFFFFF' : color} />
      ) : (
        <>
          {buttonIcon}
          <Text style={[styles.buttonText, { color: solid ? '#FFFFFF' : color }, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function OfficerHero(props: React.ComponentProps<typeof ReportScreenHero>) {
  return (
    <View style={styles.hero}>
      <ReportScreenHero {...props} />
    </View>
  );
}

export const officerScreenStyle = { backgroundColor: '#0855D9' };
export const officerShellStyle = {
  backgroundColor: LightColors.background,
  borderColor: LightColors.border,
  shadowOpacity: 0.06,
};
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: LightColors.border,
    borderRadius: 20,
    shadowColor: '#183A65',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  button: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { ...MobileTypography.button, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  hero: { marginHorizontal: -20, marginTop: -8, marginBottom: 20 },
});
