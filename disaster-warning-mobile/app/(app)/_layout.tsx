/**
 * Authenticated app layout — main navigation structure.
 */
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';
import { startAutoSync, stopAutoSync } from '@/services/offlineSyncManager';

export default function AppLayout() {
  useEffect(() => {
    // Start automated background synchronization for delayed offline reports
    startAutoSync();
    return () => {
      stopAutoSync();
    };
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg.primary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="resources" />
      <Stack.Screen name="warnings" />
      <Stack.Screen name="reports" />
    </Stack>
  );
}
