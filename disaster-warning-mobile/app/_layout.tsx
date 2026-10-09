/**
 * Root layout — wraps the app with AuthProvider and handles auth-based routing.
 */
import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { AuthProvider } from '@/hooks/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/colors';

// Filter out benign React Native Web internal deprecation warnings in development
if (Platform.OS === 'web') {
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (
      msg.includes('"shadow*" style props are deprecated') ||
      msg.includes('props.pointerEvents is deprecated')
    ) {
      return;
    }
    origWarn(...args);
  };
}

/**
 * Auth guard — redirects based on authentication state.
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  useEffect(() => {
    if (state.isLoading) return;

    // Wait a tick for navigation to mount
    const timer = setTimeout(() => {
      setIsNavigationReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [state.isLoading]);

  useEffect(() => {
    if (!isNavigationReady || state.isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!state.isAuthenticated && !inAuthGroup) {
      // Not signed in → redirect to login
      router.replace('/(auth)/login');
    } else if (state.isAuthenticated && inAuthGroup) {
      // Signed in but still on auth screens → redirect to app
      router.replace('/(app)');
    }
  }, [state.isAuthenticated, state.isLoading, segments, isNavigationReady, router]);

  if (state.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.accent.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AuthGuard>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.bg.primary },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </AuthGuard>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
