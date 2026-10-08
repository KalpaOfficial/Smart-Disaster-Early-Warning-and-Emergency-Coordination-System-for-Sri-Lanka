/**
 * Status Badge component for displaying shelter/team/supply statuses.
 */
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, BorderRadius, Spacing, FontSize } from '@/constants/colors';
import type {
  ShelterStatus,
  TeamStatus,
  OrganisationType,
  SupplyType,
} from '@/types/resources';

interface BadgeProps {
  label: string;
  color: string;
  bgColor?: string;
  style?: ViewStyle;
  size?: 'sm' | 'md';
}

export function Badge({ label, color, bgColor, style, size = 'md' }: BadgeProps) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bgColor || `${color}20`, borderColor: color },
        size === 'sm' && styles.badgeSm,
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text
        style={[
          styles.text,
          { color },
          size === 'sm' && styles.textSm,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Pre-configured badge for shelter statuses.
 */
export function ShelterStatusBadge({
  status,
  size = 'md',
}: {
  status: ShelterStatus;
  size?: 'sm' | 'md';
}) {
  const config: Record<ShelterStatus, { label: string; color: string }> = {
    registered: { label: 'Registered', color: Colors.shelter.registered },
    active: { label: 'Active', color: Colors.shelter.active },
    inactive: { label: 'Inactive', color: Colors.shelter.inactive },
    over_capacity: { label: 'Over Capacity', color: Colors.shelter.overCapacity },
  };
  const { label, color } = config[status] || { label: status, color: Colors.text.secondary };
  return <Badge label={label} color={color} size={size} />;
}

/**
 * Pre-configured badge for rescue team statuses.
 */
export function TeamStatusBadge({
  status,
  size = 'md',
}: {
  status: TeamStatus;
  size?: 'sm' | 'md';
}) {
  const config: Record<TeamStatus, { label: string; color: string }> = {
    available: { label: 'Available', color: Colors.team.available },
    dispatched: { label: 'Dispatched', color: Colors.team.dispatched },
    en_route: { label: 'En Route', color: Colors.team.enRoute },
    on_site: { label: 'On Site', color: Colors.team.onSite },
    completed: { label: 'Completed', color: Colors.team.completed },
    unavailable: { label: 'Unavailable', color: Colors.team.unavailable },
  };
  const { label, color } = config[status] || { label: status, color: Colors.text.secondary };
  return <Badge label={label} color={color} size={size} />;
}

/**
 * Pre-configured badge for organisation types.
 */
export function OrganisationBadge({
  type,
  size = 'md',
}: {
  type: OrganisationType;
  size?: 'sm' | 'md';
}) {
  const config: Record<OrganisationType, { label: string; color: string }> = {
    government: { label: 'Government', color: Colors.info },
    armed_forces: { label: 'Armed Forces', color: '#F43F5E' },
    ngo: { label: 'NGO / INGO', color: Colors.warning },
    private_donor: { label: 'Private Donor', color: '#A855F7' },
  };
  const { label, color } = config[type] || { label: type, color: Colors.text.secondary };
  return <Badge label={label} color={color} size={size} />;
}

/**
 * Pre-configured badge for relief supply types.
 */
export function SupplyTypeBadge({
  type,
  size = 'md',
}: {
  type: SupplyType;
  size?: 'sm' | 'md';
}) {
  const config: Record<SupplyType, { label: string; color: string }> = {
    food: { label: 'Food Rations', color: Colors.supply.food },
    water: { label: 'Drinking Water', color: Colors.supply.water },
    medicine: { label: 'Medicine', color: Colors.supply.medicine },
    blankets: { label: 'Blankets', color: Colors.supply.blankets },
    tents: { label: 'Tents', color: Colors.supply.tents },
  };
  const { label, color } = config[type] || { label: type, color: Colors.text.secondary };
  return <Badge label={label} color={color} size={size} />;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: Spacing.xs + 2,
  },
  badgeSm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textSm: {
    fontSize: 10,
  },
});
