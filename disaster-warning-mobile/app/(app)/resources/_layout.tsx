/**
 * Resources group layout — stack navigator for resource coordination screens.
 */
import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function ResourcesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg.primary },
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
