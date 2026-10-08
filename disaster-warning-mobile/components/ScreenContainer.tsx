/**
 * Master Screen Container with Mobile-First Responsive Shell.
 * Ensures pixel-perfect mobile proportions on native devices (iOS/Android)
 * and a centered, high-fidelity mobile device simulator on desktop browsers.
 */
import React from 'react';
import { View, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  edges?: readonly Edge[];
}

export function ScreenContainer({
  children,
  style,
  contentStyle,
  edges = ['top', 'left', 'right'],
}: ScreenContainerProps) {
  return (
    <SafeAreaView edges={edges} style={[styles.root, style]}>
      <View style={[styles.shell, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#040711',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
    backgroundColor: Colors.bg.primary,
    position: 'relative',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? {
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.07)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.6,
          shadowRadius: 36,
        }
      : {}),
  },
});
