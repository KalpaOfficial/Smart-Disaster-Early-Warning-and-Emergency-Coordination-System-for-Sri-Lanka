/**
 * Premium Card component with glassmorphism, glowing halos, and tactile feedback.
 */
import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { BorderRadius, Spacing } from '@/constants/colors';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  glowColor?: string;
  noPadding?: boolean;
  variant?: 'default' | 'elevated' | 'glass';
}

export function Card({
  children,
  style,
  onPress,
  glowColor,
  noPadding,
  variant = 'default',
}: CardProps) {
  const cardStyle = [
    styles.card,
    variant === 'elevated' && styles.cardElevated,
    variant === 'glass' && styles.cardGlass,
    glowColor && {
      borderColor: `${glowColor}50`,
      shadowColor: glowColor,
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 8,
    },
    noPadding && { padding: 0 },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onPress}
        style={cardStyle}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0D1526',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  cardElevated: {
    backgroundColor: '#121D33',
    borderColor: 'rgba(56, 189, 248, 0.20)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  cardGlass: {
    backgroundColor: 'rgba(13, 21, 38, 0.78)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
});
