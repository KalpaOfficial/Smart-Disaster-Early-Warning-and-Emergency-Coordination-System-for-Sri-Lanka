/**
 * Reports Route Layout — Stack Navigator for Ground Hazard Reports.
 * Manages transitions between report list, submit form, detail view, and offline queue.
 */
import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function ReportsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg.primary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="submit" />
      <Stack.Screen name="[reportId]" />
      <Stack.Screen name="offline-queue" />
    </Stack>
  );
}
