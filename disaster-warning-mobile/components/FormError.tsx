import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { LightColors, MobileTypography } from '@/constants/colors';

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
      {message}
    </Text>
  );
}
const styles = StyleSheet.create({
  error: {
    ...MobileTypography.caption,
    color: LightColors.danger,
    backgroundColor: '#FFF1F2',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
  },
});
