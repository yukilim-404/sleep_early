/**
 * app/sleep-wake-check-in.tsx — Step 9
 *
 * Morning screen: log last night's sleep.
 *
 * Combines data from two sources:
 *   1. tonightSession (from wind-down.tsx) — bedtime, barrier_tag, intervention_completed
 *   2. User input here — fall_asleep_time, wake_time, mood
 *
 * Then calls saveLog() and navigates to Home where the streak updates.
 *
 * Gracefully handles the "no session" case (user opens this without
 * having done a check-in — they can still log a full manual entry).
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { saveLog, getProfile } from '@/src/lib/dataStore';
import { loadTonightSession, clearTonightSession, type TonightSession } from '@/src/lib/session';
import { localISODate } from '@/src/lib/timeMath';
import { QuickTimePicker } from '@/src/components/TimePicker';
import { scheduleReminders } from '@/src/lib/notifications';
import type { BarrierTag, SleepLogInput } from '@/src/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeStringToHM(t: string | null): { h: number; m: number } {
  if (!t) return { h: 0, m: 0 };
  const [h, m] = t.split(':').map(Number);
  return { h, m: m ?? 0 };
}

function toTimeString(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/** Local ISO date string for yesterday */
function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localISODate(d);
}

/** Local ISO date string for today */
function todayISO(): string {
  return localISODate();
}

/**
 * Best-guess date for last night's log.
 * If it's before 14:00, assume the user is logging from this morning → use yesterday.
 * Otherwise they're logging mid-day for today.
 */
function logDate(): string {
  return new Date().getHours() < 14 ? yesterday() : todayISO();
}

// ── Mood data ─────────────────────────────────────────────────────────────────

const MOODS: { value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
  { value: 1, emoji: '😫', label: 'Rough' },
  { value: 2, emoji: '😪', label: 'Tired' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '😊', label: 'Good' },
  { value: 5, emoji: '😁', label: 'Great' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function SleepWakeCheckInScreen() {
  const router = useRouter();

  const [session, setSession] = useState<TonightSession>({
    bedtime: null,
    barrier: null,
    intervention_completed: false,
    saved_at: null,
  });
  const bedHM = timeStringToHM(session.bedtime);

  const [fallAsleepH, setFallAsleepH] = useState(0);
  const [fallAsleepM, setFallAsleepM] = useState(20);

  // Restore tonight's session (survives app kill) and default fall-asleep to bedtime + 20 min
  useEffect(() => {
    loadTonightSession().then((s) => {
      setSession(s);
      if (s.bedtime) {
        const { h, m } = timeStringToHM(s.bedtime);
        const total = h * 60 + m + 20;
        setFallAsleepH(Math.floor(total / 60) % 24);
        setFallAsleepM(total % 60);
      }
    });
  }, []);
  const [wakeH,       setWakeH]       = useState(7);
  const [wakeM,       setWakeM]       = useState(0);
  const [mood,        setMood]        = useState<1|2|3|4|5|null>(null);
  const [loading,     setLoading]     = useState(false);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;

  // Load profile wake time as default
  useEffect(() => {
    getProfile().then((p) => {
      if (p?.wake_time) {
        const { h, m } = timeStringToHM(p.wake_time);
        setWakeH(h);
        setWakeM(m);
      }
    });

    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 120 }),
    ]).start();
  }, []);

  async function handleSubmit() {
    if (!mood) {
      Alert.alert('One more thing', 'How did you feel this morning? Pick a mood to continue.');
      return;
    }

    setLoading(true);
    try {
      const log: SleepLogInput = {
        date:                   logDate(),
        bedtime:                session.bedtime ?? toTimeString(bedHM.h || 23, bedHM.m || 0),
        fall_asleep_time:       toTimeString(fallAsleepH, fallAsleepM),
        wake_time:              toTimeString(wakeH, wakeM),
        barrier_tag:            (session.barrier as BarrierTag | null) ?? null,
        intervention_completed: session.intervention_completed,
        mood,
        is_seed_data:           false,
      };

      const saved = await saveLog(log);

      if (!saved) {
        Alert.alert(
          'Save failed',
          "Couldn't save your log. Check your connection — your data was not lost, try again.",
          [{ text: 'OK' }]
        );
        return;
      }

      // Clear tonight's session now that we've persisted it
      await clearTonightSession();

      // Reschedule notification for tomorrow night
      const profile = await getProfile();
      if (profile?.target_bedtime) {
        await scheduleReminders(profile.target_bedtime, profile.wake_time);
      }

      // Fade out, then go home (streak will recalculate via useFocusEffect)
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        router.replace('/(tabs)');
      });
    } catch (err) {
      console.error('[SleepWakeCheckIn] Error:', err);
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const hasBedtime = !!session.bedtime;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.ScrollView
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.sunEmoji}>☀️</Text>
          <Text style={styles.title}>Good morning!</Text>
          <Text style={styles.subtitle}>
            Let's log how last night went.{'\n'}Takes 20 seconds.
          </Text>
        </View>

        {/* ── Bedtime summary (from session, read-only) ── */}
        {hasBedtime && (
          <View style={styles.sessionCard}>
            <Text style={styles.sessionLabel}>LAST NIGHT</Text>
            <View style={styles.sessionRow}>
              <SessionPill emoji="🛏" label="Bedtime" value={formatTime(session.bedtime!)} />
              {session.barrier && (
                <SessionPill emoji="🏷" label="Barrier" value={barrierLabel(session.barrier)} />
              )}
              {session.intervention_completed && (
                <SessionPill emoji="✓" label="Check-in" value="Completed" accent="#52C4A0" />
              )}
            </View>
          </View>
        )}

        {/* ── Fall-asleep time ── */}
        <Section label="😴  When did you actually fall asleep?" hint="Your best estimate is fine.">
          <QuickTimePicker
            label="I fell asleep around"
            hour={fallAsleepH}
            minute={fallAsleepM}
            onHourChange={setFallAsleepH}
            onMinuteChange={setFallAsleepM}
          />
        </Section>

        {/* ── Wake time ── */}
        <Section label="⏰  When did you wake up?" hint="When you actually got up.">
          <QuickTimePicker
            label="I woke up at"
            hour={wakeH}
            minute={wakeM}
            onHourChange={setWakeH}
            onMinuteChange={setWakeM}
          />
        </Section>

        {/* ── Mood rating ── */}
        <Section label="💭  How do you feel this morning?" hint="Optional but helps track your trend.">
          <View style={styles.moodRow}>
            {MOODS.map((m) => (
              <TouchableOpacity
                key={m.value}
                style={[styles.moodChip, mood === m.value && styles.moodChipActive]}
                onPress={() => setMood(m.value)}
                accessibilityLabel={`Mood: ${m.label}`}
                accessibilityState={{ selected: mood === m.value }}
              >
                <Text style={styles.moodEmoji}>{m.emoji}</Text>
                <Text style={[styles.moodLabel, mood === m.value && styles.moodLabelActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* ── Sleep duration preview ── */}
        <DurationPreview
          fallAsleepH={fallAsleepH}
          fallAsleepM={fallAsleepM}
          wakeH={wakeH}
          wakeM={wakeM}
        />

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[styles.cta, loading && styles.ctaDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          accessibilityLabel="Save sleep log"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Save & See My Streak →</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footer}>
          Your data stays private — only you can see it.
        </Text>
      </Animated.ScrollView>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionHint}>{hint}</Text>
      {children}
    </View>
  );
}

function SessionPill({
  emoji,
  label,
  value,
  accent = '#5ba371',
}: {
  emoji: string;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={[pill.wrap, { borderColor: accent + '40' }]}>
      <Text style={pill.emoji}>{emoji}</Text>
      <View>
        <Text style={pill.label}>{label}</Text>
        <Text style={[pill.value, { color: accent }]}>{value}</Text>
      </View>
    </View>
  );
}

function DurationPreview({
  fallAsleepH,
  fallAsleepM,
  wakeH,
  wakeM,
}: {
  fallAsleepH: number;
  fallAsleepM: number;
  wakeH: number;
  wakeM: number;
}) {
  const asleepMins = (fallAsleepH < 12 ? fallAsleepH + 24 : fallAsleepH) * 60 + fallAsleepM;
  const wakeMins   = (wakeH < 12 ? wakeH + 24 : wakeH) * 60 + wakeM;
  const dur        = Math.max(0, wakeMins - asleepMins);
  const h = Math.floor(dur / 60);
  const m = dur % 60;

  return (
    <View style={styles.durationCard}>
      <Text style={styles.durationLabel}>Estimated sleep duration</Text>
      <Text style={styles.durationValue}>
        {h > 0 ? `${h}h ` : ''}{m > 0 ? `${m}m` : ''}
        {dur === 0 ? '—' : ''}
      </Text>
      <Text style={styles.durationSub}>
        {dur >= 7 * 60
          ? '🌟 Great sleep!'
          : dur >= 6 * 60
          ? '😊 Decent night.'
          : dur > 0
          ? '😪 A bit short — aim for 7–8h.'
          : ''}
      </Text>
    </View>
  );
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${dh}:${String(m).padStart(2, '0')} ${period}`;
}

function barrierLabel(b: string): string {
  const map: Record<string, string> = {
    phone: 'Phone',
    gaming: 'Gaming',
    work: 'Work',
    overthinking: 'Overthinking',
    me_time: 'Me-time',
  };
  return map[b] ?? b;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const BG     = '#0A0A15';
const CARD   = '#13131F';
const BORDER = '#2A2A3E';
const PURPLE = '#5ba371';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 20 : 24,
    paddingBottom: 56,
    gap: 24,
  },

  header: { alignItems: 'center', gap: 8, marginBottom: 4 },
  sunEmoji: { fontSize: 48 },
  title:    { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  subtitle: { fontSize: 15, color: '#6060A0', textAlign: 'center', lineHeight: 22 },

  sessionCard: {
    backgroundColor: '#0F0F20',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A4A',
    gap: 10,
  },
  sessionLabel: { fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 1.5 },
  sessionRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  section: { gap: 8 },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: '#E0E0FF' },
  sectionHint:  { fontSize: 13, color: '#5050A0', marginBottom: 2 },

  moodRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  moodChip: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    gap: 4,
  },
  moodChipActive:  { backgroundColor: '#1A1A2E', borderColor: PURPLE },
  moodEmoji:       { fontSize: 22 },
  moodLabel:       { color: '#555', fontSize: 10, fontWeight: '600' },
  moodLabelActive: { color: PURPLE },

  durationCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    gap: 4,
  },
  durationLabel: { fontSize: 12, color: '#555', fontWeight: '600', letterSpacing: 0.5 },
  durationValue: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  durationSub:   { fontSize: 14, color: '#6060A0' },

  cta: {
    backgroundColor: PURPLE,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },

  footer: { color: '#3A3A5A', fontSize: 12, textAlign: 'center' },
});

const pill = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#13131F',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  emoji: { fontSize: 18 },
  label: { color: '#555', fontSize: 11, fontWeight: '600' },
  value: { fontSize: 14, fontWeight: '700' },
});
