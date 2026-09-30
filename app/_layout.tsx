import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import 'react-native-reanimated';
import type { EventSubscription } from 'expo-notifications';

import { Text, View, Platform } from 'react-native';
import { supabaseConfigured } from '@/src/lib/supabase';
import { getCurrentUserId, subscribeToAuthChanges } from '@/src/lib/auth';
import { getProfile } from '@/src/lib/dataStore';
import { getNotifications } from '@/src/lib/notificationsModule';
import {
  setupNotificationChannel,
  setupForegroundHandler,
  scheduleReminders,
} from '@/src/lib/notifications';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

// Set up foreground notification handler at module level
setupForegroundHandler();

export default function RootLayout() {
  const router = useRouter();
  const notificationListener = useRef<EventSubscription | null>(null);
  const responseListener     = useRef<EventSubscription | null>(null);

  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // 'checking' → 'signedOut' (show /login) → 'signedIn' (show the app)
  const [authStatus, setAuthStatus] = useState<'checking' | 'signedOut' | 'signedIn'>('checking');

  // ── Auth gate: require a real signed-in session before anything else ──────
  useEffect(() => {
    let mounted = true;
    getCurrentUserId().then((uid) => {
      if (mounted) setAuthStatus(uid ? 'signedIn' : 'signedOut');
    });
    const unsubscribe = subscribeToAuthChanges((uid) => {
      if (mounted) setAuthStatus(uid ? 'signedIn' : 'signedOut');
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Stack.Screen children must stay static (expo-router requirement) — redirect instead
  // of conditionally mounting/unmounting screens.
  useEffect(() => {
    if (authStatus === 'signedOut') router.replace('/login');
    else if (authStatus === 'signedIn') router.replace('/(tabs)');
  }, [authStatus, router]);

  // ── Notification setup, once signed in ─────────────────────────────────────
  useEffect(() => {
    if (authStatus !== 'signedIn' || Platform.OS === 'web') return;
    (async () => {
      await setupNotificationChannel();
      // Reschedule reminders from the stored profile (no-op unless permission was granted;
      // the permission prompt itself happens at the end of onboarding).
      const profile = await getProfile();
      if (profile?.target_bedtime) {
        await scheduleReminders(profile.target_bedtime, profile.wake_time);
      }
    })();
  }, [authStatus]);

  // ── Notification tap → deep link to barrier-check-in (mobile only) ────────
  useEffect(() => {
    const Notifications = getNotifications();
    if (!Notifications) return; // unavailable: web or Expo Go

    // Listener for taps while app is open
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (_notification) => {
        // App is in foreground — notification is shown as banner, no extra action needed
      }
    );

    // Listener for taps that open/resume the app
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (typeof data?.screen === 'string') router.push(data.screen as never);
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);

  // ── Handle notification that launched the app from quit state (mobile only) ─
  useEffect(() => {
    const Notifications = getNotifications();
    if (!Notifications) return; // unavailable: web or Expo Go
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const screen = response?.notification.request.content.data?.screen;
      if (typeof screen === 'string') {
        // Small delay to let the navigator mount first
        setTimeout(() => router.push(screen as never), 500);
      }
    });
  }, []);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded || authStatus === 'checking') return null;

  if (!supabaseConfigured) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0F1A', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>App is not configured</Text>
        <Text style={{ color: '#888', textAlign: 'center' }}>
          Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env and restart.
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="barrier-check-in"
          options={{ title: "Tonight's Check-In", headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="task-closure"
          options={{ title: 'Unfinished Work', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="wind-down"
          options={{ title: 'Wind Down', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="sleep-wake-check-in"
          options={{ title: 'Morning Check-In', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="brain-dump"
          options={{ title: 'Brain Dump', headerBackTitle: 'Back' }}
        />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
