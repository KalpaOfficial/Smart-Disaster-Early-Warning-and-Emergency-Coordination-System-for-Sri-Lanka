import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { CommunityDashboard } from '@/components/CommunityDashboard';
import { DistrictDashboard } from '@/components/DistrictDashboard';
import { DmcDashboard } from '@/components/DmcDashboard';

export default function DashboardScreen() {
  const { state } = useAuth();
  if (state.user?.role === 'district_officer') return <DistrictDashboard />;
  if (state.user?.role === 'dmc_officer') return <DmcDashboard />;
  return <CommunityDashboard />;
}
