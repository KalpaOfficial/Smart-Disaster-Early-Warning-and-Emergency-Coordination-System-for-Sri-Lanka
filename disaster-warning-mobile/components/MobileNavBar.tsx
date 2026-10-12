/**
 * Premium Mobile Navigation Dock.
 * Floating, translucent command bar anchored cleanly at the bottom.
 * Supports iOS home indicators, responsive centering, and active glowing pill highlights.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  LightColors,
  BorderRadius,
  Spacing,
  FontSize,
  MobileTypography,
} from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { getMobileNavItems, isMobileNavActive } from '@/constants/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function MobileNavBar({ appearance = 'dark' }: { appearance?: 'dark' | 'light' } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useAuth();
  const insets = useSafeAreaInsets();
  const isLight = appearance === 'light';
  const items = getMobileNavItems(state.user?.role);

  return (
    <View
      style={[
        styles.dockContainer,
        isLight && styles.lightContainer,
        isLight && { paddingBottom: Math.max(insets.bottom, 10) },
      ]}
      pointerEvents={Platform.OS === 'web' ? undefined : 'box-none'}
    >
      <View
        style={[styles.dockSurface, isLight && styles.lightSurface]}
        pointerEvents={Platform.OS === 'web' ? undefined : 'auto'}
      >
        {items.map(item => {
          const active = isMobileNavActive(pathname, item.route);

          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => router.push(item.route as never)}
              style={styles.tabButton}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              aria-selected={active}
            >
              <View
                style={[
                  styles.iconWrapper,
                  active && styles.iconWrapperActive,
                  active && isLight && styles.lightActiveIcon,
                ]}
              >
                <Ionicons
                  name={active ? item.activeIconName : item.iconName}
                  size={20}
                  color={
                    isLight
                      ? active
                        ? LightColors.primary
                        : LightColors.mutedText
                      : active
                        ? Colors.accent.primary
                        : Colors.text.tertiary
                  }
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isLight && styles.lightLabel,
                  active && styles.tabLabelActive,
                  active && isLight && styles.lightActiveLabel,
                ]}
              >
                {item.label}
              </Text>
              {active && !isLight && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lightContainer: {
    backgroundColor: LightColors.surface,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: LightColors.border,
  },
  lightSurface: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: LightColors.surface,
    borderWidth: 0,
    borderRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
    paddingVertical: 8,
  },
  lightLabel: { color: LightColors.mutedText, ...MobileTypography.small },
  lightActiveLabel: { color: LightColors.primary },
  lightActiveIcon: { backgroundColor: LightColors.primarySoft },

  dockContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 24 : Spacing.md,
    paddingTop: Spacing.xs,
    backgroundColor: 'transparent',
    zIndex: 99,
    ...(Platform.OS === 'web' ? ({ pointerEvents: 'none' } as never) : {}),
  },
  dockSurface: {
    width: '92%',
    maxWidth: 460,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(11, 19, 38, 0.94)',
    borderRadius: BorderRadius.xxl,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.18)',
    ...(Platform.OS === 'web' ? ({ pointerEvents: 'auto' } as never) : {}),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  iconWrapper: {
    width: 36,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
  },
  tabLabel: {
    fontSize: FontSize.micro + 1,
    fontWeight: '600',
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  tabLabelActive: {
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent.primary,
    marginTop: 2,
  },
});
