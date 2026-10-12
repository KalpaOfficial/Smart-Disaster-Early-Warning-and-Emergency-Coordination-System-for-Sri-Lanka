/**
 * Warnings layout — Stack navigator for UC01 Issue Hazard Warning screens.
 */
import { Stack } from 'expo-router';
import { LightColors } from '@/constants/colors';

export default function WarningsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: LightColors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="events" />
      <Stack.Screen name="[eventId]" />
      <Stack.Screen name="compose" />
      <Stack.Screen name="summary" />
    </Stack>
  );
}
