/**
 * Reusable Input component with label, error state, and secure text toggle.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  LightColors,
  BorderRadius,
  FontSize,
  Spacing,
  MobileTypography,
} from '@/constants/colors';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  isPassword?: boolean;
  appearance?: 'dark' | 'light';
  inputRef?: React.Ref<TextInput>;
}

export function Input({
  label,
  error,
  icon,
  containerStyle,
  inputStyle,
  isPassword = false,
  appearance = 'dark',
  inputRef,
  ...textInputProps
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isLight = appearance === 'light';

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={[styles.label, isLight && styles.lightLabel]}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrapper,
          isLight && styles.lightWrapper,
          isFocused ? styles.focused : undefined,
          isFocused && isLight && styles.lightFocused,
          error ? styles.errored : undefined,
          error && isLight ? styles.lightErrored : undefined,
        ]}
      >
        {Boolean(icon) && <View style={styles.iconWrapper}>{icon}</View>}
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            isLight && styles.lightInput,
            icon ? styles.inputWithIcon : undefined,
            inputStyle,
          ]}
          placeholderTextColor={isLight ? LightColors.mutedText : Colors.input.placeholder}
          selectionColor={isLight ? LightColors.primary : Colors.accent.primary}
          accessibilityLabel={label}
          aria-invalid={!!error}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...textInputProps}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            accessibilityState={{ disabled: textInputProps.editable === false }}
            disabled={textInputProps.editable === false}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={isLight ? LightColors.secondaryText : Colors.text.tertiary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.errorText, isLight && styles.lightErrorText]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lightLabel: {
    color: LightColors.text,
    textTransform: 'none',
    letterSpacing: 0,
    ...MobileTypography.label,
    fontWeight: '600',
    marginBottom: 8,
  },
  lightWrapper: {
    backgroundColor: LightColors.surfaceMuted,
    borderColor: LightColors.border,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 54,
  },
  lightFocused: {
    backgroundColor: LightColors.surface,
    borderColor: LightColors.primary,
    shadowColor: LightColors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 0,
  },
  lightInput: {
    color: LightColors.text,
    paddingVertical: 16,
    ...MobileTypography.body,
  },
  lightErrored: { borderColor: LightColors.danger },
  lightErrorText: { color: LightColors.danger, ...MobileTypography.caption },
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginBottom: Spacing.xs + 2,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1527',
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  focused: {
    borderColor: Colors.accent.primary,
    backgroundColor: '#101B33',
    shadowColor: Colors.accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  errored: {
    borderColor: Colors.danger,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: Colors.text.primary,
    fontSize: FontSize.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  inputWithIcon: {
    paddingLeft: Spacing.xs,
  },
  iconWrapper: {
    paddingLeft: Spacing.lg,
  },
  eyeButton: {
    flexShrink: 0,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
    fontWeight: '500',
  },
});
