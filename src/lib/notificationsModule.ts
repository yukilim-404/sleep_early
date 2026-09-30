/**
 * Lazily loads `expo-notifications`, but never inside Expo Go on Android — merely
 * importing that module throws there as of SDK 53 (push auto-registration is
 * disallowed in Expo Go and raises a hard error, not just a warning). Everything
 * that touches notifications should go through this instead of a static import,
 * and treat `null` as "not available right now" (Expo Go, or web).
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// eslint-disable-next-line @typescript-eslint/no-var-requires
export type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

/** Returns the expo-notifications module, or null if unavailable (Expo Go / web). */
export function getNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  if (Platform.OS === 'web' || isExpoGo) {
    cached = null;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cached = require('expo-notifications') as NotificationsModule;
  }
  return cached;
}
