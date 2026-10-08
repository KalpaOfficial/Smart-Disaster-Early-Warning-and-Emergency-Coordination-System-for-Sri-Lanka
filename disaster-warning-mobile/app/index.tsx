/**
 * Index redirect — sends users to the appropriate group based on auth state.
 */
import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { state } = useAuth();

  if (state.isAuthenticated) {
    return <Redirect href="/(app)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
