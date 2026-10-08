/**
 * Authenticated app layout — main navigation structure.
 */
import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function AppLayout() {
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
    </Stack>
  );
}
