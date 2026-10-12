/**
 * Resources group layout — stack navigator for resource coordination screens.
 */
import { Stack } from 'expo-router';
import { LightColors } from '@/constants/colors';

export default function ResourcesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: LightColors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="shelters" />
      <Stack.Screen name="rescue-teams" />
      <Stack.Screen name="relief-supplies" />
      <Stack.Screen name="seed" />
    </Stack>
  );
}
