import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@sleep_early/demo_mode';

export async function isDemoMode(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setDemoMode(on: boolean): Promise<void> {
  try {
    if (on) await AsyncStorage.setItem(KEY, '1');
    else await AsyncStorage.removeItem(KEY);
  } catch (err) {
    console.warn('[demoMode] failed:', err);
  }
}
