/**
 * src/lib/notifications.ts
 *
 * Daily local reminders: wind-down (bedtime -2h), last call (-15m), morning log (wake +15m).
 * Tapping one deep-links via `data.screen`.
 *
 * The expo-notifications module is loaded lazily via getNotifications() — never
 * imported statically — because merely importing it throws inside Expo Go on
 * Android (SDK 53+). Every function here degrades gracefully to a no-op/false
 * when it's unavailable (Expo Go or web), matching the app's "works without
 * notifications" requirement.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { timeToMinutes } from './timeMath';
import { getNotifications } from './notificationsModule';

const CHANNEL_ID = 'checkin';

export async function setupNotificationChannel() {
  const Notifications = getNotifications();
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Check-In Reminders',
    description: "Reminds you to start tonight's wind-down routine.",
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#5ba371',
  });
}

export function setupForegroundHandler() {
  const Notifications = getNotifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ── Permission ────────────────────────────────────────────────────────────────

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

/** Current permission state without prompting. */
export async function getPermissionStatus(): Promise<PermissionStatus> {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return 'undetermined';
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/** Ask for permission (no re-prompt if already decided). */
export async function requestNotificationPermissions(): Promise<PermissionStatus> {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return 'undetermined';
    const existing = await getPermissionStatus();
    if (existing !== 'undetermined') return existing;
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return status === 'granted' ? 'granted' : 'denied';
  } catch (err) {
    console.warn('[notifications] Permission request failed:', err);
    return 'denied';
  }
}

// ── Preferences ───────────────────────────────────────────────────────────────

const PREFS_KEY = '@sleep_early/notif_prefs';

export interface NotifPrefs {
  winddown: boolean;
  lastcall: boolean;
  morning: boolean;
}

const DEFAULT_PREFS: NotifPrefs = { winddown: true, lastcall: true, morning: true };

export async function getNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function saveNotifPrefs(p: NotifPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch (err) {
    console.warn('[notifications] prefs save failed:', err);
  }
}

// ── Scheduling ────────────────────────────────────────────────────────────────

/** "HH:MM[:SS]" shifted by deltaMin minutes, wrapping at midnight */
function shift(t: string, deltaMin: number): { h: number; m: number } {
  const total = (((timeToMinutes(t) + deltaMin) % 1440) + 1440) % 1440;
  return { h: Math.floor(total / 60), m: total % 60 };
}

function fmt(t: string): string {
  const { h, m } = shift(t, 0);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/**
 * (Re)schedule the daily reminders, replacing anything previously scheduled.
 * Returns false if unavailable (Expo Go/web), permission isn't granted, or scheduling fails.
 */
export async function scheduleReminders(
  targetBedtime: string,
  wakeTime: string
): Promise<boolean> {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return false;
    if ((await getPermissionStatus()) !== 'granted') return false;

    await Notifications.cancelAllScheduledNotificationsAsync();
    const prefs = await getNotifPrefs();

    const daily = (t: { h: number; m: number }) => ({
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: t.h,
      minute: t.m,
      channelId: CHANNEL_ID,
    });

    if (prefs.winddown) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Time to wind down 🌙',
          body: "Your bedtime is in 2 hours. What's keeping you up tonight?",
          data: { screen: '/barrier-check-in' },
        },
        trigger: daily(shift(targetBedtime, -120)),
      });
    }
    if (prefs.lastcall) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Last call',
          body: `Aim to be in bed by ${fmt(targetBedtime)}.`,
          data: { screen: '/wind-down' },
        },
        trigger: daily(shift(targetBedtime, -15)),
      });
    }
    if (prefs.morning) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Good morning ☀️',
          body: "Log last night's sleep — it takes 10 seconds.",
          data: { screen: '/sleep-wake-check-in' },
        },
        trigger: daily(shift(wakeTime, 15)),
      });
    }
    return true;
  } catch (err) {
    console.warn('[notifications] Failed to schedule:', err);
    return false;
  }
}

export async function cancelReminders(): Promise<void> {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn('[notifications] Failed to cancel:', err);
  }
}
