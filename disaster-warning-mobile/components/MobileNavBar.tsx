/**
 * Premium Mobile Navigation Dock.
 * Floating, translucent command bar anchored cleanly at the bottom.
 * Supports iOS home indicators, responsive centering, and active glowing pill highlights.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing, FontSize } from '@/constants/colors';

interface NavItem {
  key: string;
  label: string;
  route: string;
  iconName: keyof typeof Ionicons.glyphMap;
  activeIconName: keyof typeof Ionicons.glyphMap;
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    route: '/(app)',
    iconName: 'grid-outline',
    activeIconName: 'grid',
  },
  {
    key: 'reports',
    label: 'Reports',
    route: '/(app)/reports',
    iconName: 'document-text-outline',
    activeIconName: 'document-text',
  },
  {
    key: 'shelters',
    label: 'Shelters',
    route: '/(app)/resources/shelters',
    iconName: 'home-outline',
    activeIconName: 'home',
  },
  {
    key: 'teams',
    label: 'Rescue',
    route: '/(app)/resources/rescue-teams',
    iconName: 'shield-outline',
    activeIconName: 'shield',
  },
  {
    key: 'supplies',
    label: 'Supplies',
    route: '/(app)/resources/relief-supplies',
    iconName: 'cube-outline',
    activeIconName: 'cube',
  },
];

export function MobileNavBar() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (itemRoute: string) => {
    if (itemRoute === '/(app)') {
      return pathname === '/' || pathname === '/(app)' || pathname === '/(app)/index';
    }
    return pathname.startsWith(itemRoute);
  };

  return (
    <View
      style={styles.dockContainer}
      pointerEvents={Platform.OS === 'web' ? undefined : 'box-none'}
    >
      <View
        style={styles.dockSurface}
        pointerEvents={Platform.OS === 'web' ? undefined : 'auto'}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.route);

          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => router.push(item.route as never)}
              style={styles.tabButton}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, active && styles.iconWrapperActive]}>
                <Ionicons
                  name={active ? item.activeIconName : item.iconName}
                  size={20}
                  color={active ? Colors.accent.primary : Colors.text.tertiary}
                />
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {item.label}
              </Text>
              {active && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
