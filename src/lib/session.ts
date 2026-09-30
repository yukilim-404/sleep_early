import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BarrierTag } from './types';

const KEY = '@sleep_early/tonight_session';
const STALE_MS = 36 * 60 * 60 * 1000;

export interface TonightSession {
  bedtime: string | null;
  barrier: BarrierTag | null;
  intervention_completed: boolean;
  saved_at: number | null;
}

const EMPTY: TonightSession = {
  bedtime: null,
  barrier: null,
  intervention_completed: false,
  saved_at: null,
};

export async function saveTonightSession(
  s: Omit<TonightSession, 'saved_at'>
): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...s, saved_at: Date.now() }));
  } catch (err) {
    console.warn('[session] save failed:', err);
  }
}

export async function loadTonightSession(): Promise<TonightSession> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const s = JSON.parse(raw) as TonightSession;
    if (!s.saved_at || Date.now() - s.saved_at > STALE_MS) return EMPTY;
    return s;
  } catch {
    return EMPTY;
  }
}

export async function clearTonightSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (err) {
    console.warn('[session] clear failed:', err);
  }
}
