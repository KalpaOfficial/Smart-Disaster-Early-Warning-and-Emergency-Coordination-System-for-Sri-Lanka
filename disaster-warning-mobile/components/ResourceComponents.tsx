import { MobileTypography } from '@/constants/colors';
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenContainer as BaseScreen } from './ScreenContainer';
import { Card as BaseCard } from './Card';
import { Button as BaseButton } from './Button';
import { Input as BaseInput } from './Input';
import { Select as BaseSelect } from './Select';
import { FormModal as BaseModal } from './FormModal';
import { MobileNavBar as BaseNav } from './MobileNavBar';
import { EmptyState as BaseEmpty } from './EmptyState';
import { Colors, LightColors } from '@/constants/colors';
export { LinearGradient };
export const ResourceColors = {
  ...Colors,
  bg: {
    ...Colors.bg,
    primary: LightColors.background,
    secondary: '#FFFFFF',
    tertiary: '#EAF2FF',
    elevated: '#FFFFFF',
    glass: '#FFFFFF',
  },
  text: {
    ...Colors.text,
    primary: LightColors.text,
    secondary: LightColors.secondaryText,
    tertiary: LightColors.mutedText,
    inverse: '#FFFFFF',
    accent: LightColors.primary,
  },
  accent: { ...Colors.accent, primary: LightColors.primary },
  border: { ...Colors.border, default: LightColors.border, light: LightColors.border },
  input: { ...Colors.input, bg: '#F8FAFD', border: LightColors.border, text: LightColors.text },
};
export function ScreenContainer(props: React.ComponentProps<typeof BaseScreen>) {
  return (
    <BaseScreen
      {...props}
      style={{ backgroundColor: '#0855D9', ...props.style }}
      contentStyle={{
        backgroundColor: LightColors.background,
        borderColor: LightColors.border,
        shadowOpacity: 0.06,
        ...props.contentStyle,
      }}
    />
  );
}
export function Card(props: React.ComponentProps<typeof BaseCard>) {
  return (
    <BaseCard
      {...props}
      glowColor={undefined}
      style={[
        {
          backgroundColor: '#FFFFFF',
          borderColor: LightColors.border,
          shadowColor: '#154893',
          shadowOpacity: 0.05,
          shadowRadius: 14,
          borderRadius: 20,
        },
        props.style,
      ]}
    />
  );
}
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  textStyle,
  fullWidth,
  size,
}: React.ComponentProps<typeof BaseButton>) {
  const outlined = variant === 'outline' || variant === 'ghost' || variant === 'secondary';
  const color =
    variant === 'danger'
      ? LightColors.danger
      : variant === 'success'
        ? '#07834B'
        : outlined
          ? LightColors.primary
          : '#FFFFFF';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[
        {
          minHeight: size === 'sm' ? 44 : 48,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderRadius: 13,
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: outlined
            ? '#EAF2FF'
            : variant === 'danger'
              ? '#FFF1F2'
              : variant === 'success'
                ? '#E5F7ED'
                : LightColors.primary,
          opacity: disabled || loading ? 0.5 : 1,
        },
        fullWidth && { width: '100%' },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              {
                color,
                ...MobileTypography.button,
                fontWeight: '700',
                flexShrink: 1,
                textAlign: 'center',
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
export function Input(props: React.ComponentProps<typeof BaseInput>) {
  return <BaseInput {...props} appearance="light" />;
}
export function Select(props: React.ComponentProps<typeof BaseSelect>) {
  return <BaseSelect {...props} appearance="light" />;
}
export function FormModal(props: React.ComponentProps<typeof BaseModal>) {
  return <BaseModal {...props} appearance="light" />;
}
export function MobileNavBar() {
  return <BaseNav appearance="light" />;
}
export function EmptyState({
  iconName = 'document-text-outline',
  title,
  message,
}: React.ComponentProps<typeof BaseEmpty>) {
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 12 }}>
      <Ionicons name={iconName} size={32} color={LightColors.primary} />
      <Text
        style={{
          color: LightColors.text,
          ...MobileTypography.body,
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: LightColors.secondaryText,
          ...MobileTypography.caption,

          textAlign: 'center',
        }}
      >
        {message}
      </Text>
    </View>
  );
}
