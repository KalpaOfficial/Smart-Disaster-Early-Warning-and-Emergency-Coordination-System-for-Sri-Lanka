import type { Ionicons } from '@expo/vector-icons';
import type { UserRole } from '@/types/auth';

export interface MobileNavItem {
  key: string;
  label: string;
  route: string;
  iconName: keyof typeof Ionicons.glyphMap;
  activeIconName: keyof typeof Ionicons.glyphMap;
}

const STAFF_ITEMS: MobileNavItem[] = [
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
const COMMUNITY_ITEMS: MobileNavItem[] = [
  {
    key: 'dashboard',
    label: 'Home',
    route: '/(app)',
    iconName: 'home-outline',
    activeIconName: 'home',
  },
  {
    key: 'warnings',
    label: 'Warnings',
    route: '/(app)/warnings',
    iconName: 'notifications-outline',
    activeIconName: 'notifications',
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
    iconName: 'business-outline',
    activeIconName: 'business',
  },
];

const EVENTS_ITEM: MobileNavItem = {
  key: 'events',
  label: 'Events',
  route: '/(app)/warnings/events',
  iconName: 'layers-outline',
  activeIconName: 'layers',
};

export function isCommunityRole(role?: UserRole): boolean {
  return role === 'citizen' || role === 'volunteer';
}

export function getMobileNavItems(role?: UserRole): MobileNavItem[] {
  if (role === 'dmc_officer')
    return [COMMUNITY_ITEMS[0], EVENTS_ITEM, COMMUNITY_ITEMS[1], COMMUNITY_ITEMS[2]];
  if (role === 'district_officer')
    return [
      { ...STAFF_ITEMS[0], label: 'Home', iconName: 'home-outline', activeIconName: 'home' },
      STAFF_ITEMS[2],
      STAFF_ITEMS[3],
      STAFF_ITEMS[4],
    ];
  return isCommunityRole(role) ? COMMUNITY_ITEMS : STAFF_ITEMS;
}

export function isMobileNavActive(pathname: string, route: string): boolean {
  const normalize = (path: string) => path.replace(/\/\([^/]+\)/g, '').replace(/\/$/, '') || '/';
  const target = normalize(route);
  const current = normalize(pathname);
  // Event management has its own tab inside the warnings route group.
  if (
    target === '/warnings' &&
    (current === '/warnings/events' || current.startsWith('/warnings/events/'))
  )
    return false;
  return target === '/'
    ? current === '/' || current === '/index' || current === '/post-event-reports'
    : current === target || current.startsWith(`${target}/`);
}
