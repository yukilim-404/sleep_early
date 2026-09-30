/**
 * app/(tabs)/index.tsx — Home screen
 *
 * Wireframe direction 3c: "Night scene like your login reference, with a
 * strip of recent nights." Full-bleed illustrated night scene, a floating
 * "TONIGHT" card with the pet + bedtime countdown, a 7-night streak strip,
 * and one primary CTA — matches the "one card, one button" principle from
 * DESIGN_RESEARCH.md.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageBackground,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { getProfile, getLogs, calculateStreak } from '@/src/lib/dataStore';
import { loadTonightSession } from '@/src/lib/session';
import { getPermissionStatus } from '@/src/lib/notifications';
import { circularDiffMinutes, localISODate } from '@/src/lib/timeMath';
import type { Profile, SleepLog } from '@/src/lib/types';

// ── Pet assets ────────────────────────────────────────────────────────────────

const PET_IMAGES = [
  require('../../assets/pet-1.png'),
  require('../../assets/pet-2.png'),
  require('../../assets/pet-3.png'),
  require('../../assets/pet-4.png'),
];

function petImageForStreak(streak: number) {
  if (streak >= 10) return PET_IMAGES[3];
  if (streak >= 6)  return PET_IMAGES[2];
  if (streak >= 3)  return PET_IMAGES[1];
  return PET_IMAGES[0];
}

const PET_LABELS = ['Just getting started…', 'Finding a rhythm!', 'On a roll!', 'Sleep champion!'];

function petLabelForStreak(streak: number) {
  if (streak >= 10) return PET_LABELS[3];
  if (streak >= 6)  return PET_LABELS[2];
  if (streak >= 3)  return PET_LABELS[1];
  return PET_LABELS[0];
}

// ── Countdown helpers ─────────────────────────────────────────────────────────

function parseTime(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number);
  return { h, m: m ?? 0 };
}

function secondsUntil(targetHour: number, targetMin: number): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(targetHour, targetMin, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
}

function formatCountdown(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function formatBedtime(t: string): string {
  const { h, m } = parseTime(t);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

/** Last 7 calendar dates, oldest → newest, as YYYY-MM-DD. */
function last7Dates(): string[] {
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(localISODate(d));
  }
  return out;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();

  const [profile,     setProfile]     = useState<Profile | null>(null);
  const [logs,        setLogs]        = useState<SleepLog[]>([]);
  const [streak,      setStreak]      = useState(0);
  const [countdown,   setCountdown]   = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [hasSession,  setHasSession]  = useState(false);
  const [notifDenied, setNotifDenied] = useState(false);

  async function loadData() {
    const [p, l, sess] = await Promise.all([getProfile(), getLogs(30), loadTonightSession()]);
    setHasSession(!!sess.bedtime);
    setNotifDenied((await getPermissionStatus()) === 'denied');
    setProfile(p);
    setLogs(l);
    if (p) {
      const s = calculateStreak(l, p.target_bedtime);
      setStreak(s);
      const { h, m } = parseTime(p.target_bedtime);
      setCountdown(secondsUntil(h, m));
    }
    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [])
  );

  useEffect(() => {
    if (!profile) return;
    const { h, m } = parseTime(profile.target_bedtime);
    const tick = setInterval(() => setCountdown(secondsUntil(h, m)), 1000);
    return () => clearInterval(tick);
  }, [profile]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#5ba371" size="large" />
      </View>
    );
  }

  const petImage = petImageForStreak(streak);
  const petLabel = petLabelForStreak(streak);
  const hasProfile = profile !== null;

  // "Last 7 nights" strip — a moon for each on-target night, a dot otherwise/no-data.
  const dates = last7Dates();
  const byDate = new Map(logs.filter((l) => l.bedtime).map((l) => [l.date, l]));
  const strip = dates.map((date) => {
    const log = byDate.get(date);
    if (!log?.bedtime || !profile) return 'none';
    return circularDiffMinutes(log.bedtime, profile.target_bedtime) <= 30 ? 'onTarget' : 'late';
  });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ImageBackground
        source={require('../../assets/images/home-bg.jpg')}
        style={styles.bg}
        resizeMode="cover"
      >
        <View style={styles.scrim} pointerEvents="none" />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadData(); }}
              tintColor="#5ba371"
            />
          }
        >
          <Text style={styles.eyebrow}>TONIGHT</Text>

          {/* ── Floating card: pet + bedtime ── */}
          <View style={styles.card}>
            <Image source={petImage} style={styles.petImage} resizeMode="contain" />

            {hasProfile ? (
              <>
                <Text style={styles.cardEyebrow}>BEDTIME</Text>
                <Text style={styles.bedtime}>{formatBedtime(profile!.target_bedtime)}</Text>
                <Text style={styles.countdownLabel}>
                  {countdown > 0 ? `in ${formatCountdown(countdown)}` : "It's bedtime!"}
                </Text>
              </>
            ) : (
              <Text style={styles.bedtime}>Set up your goals →</Text>
            )}

            <Text style={styles.petMood}>{petLabel}</Text>

            {/* Last 7 nights strip */}
            <View style={styles.stripRow}>
              <Text style={styles.stripLabel}>
                Last 7 nights · {streak} in a row
              </Text>
              <View style={styles.stripDots}>
                {strip.map((state, i) => (
                  <Text key={i} style={styles.stripDot}>
                    {state === 'onTarget' ? '☾' : state === 'late' ? '·' : '·'}
                  </Text>
                ))}
                <Text style={styles.stripToday}>today</Text>
              </View>
            </View>
          </View>

          {notifDenied && (
            <TouchableOpacity
              style={styles.secondaryCta}
              onPress={() => Linking.openSettings()}
              accessibilityRole="button"
              accessibilityLabel="Turn on notifications in settings"
            >
              <Text style={styles.secondaryCtaText}>🔔  Reminders are off — tap to enable</Text>
            </TouchableOpacity>
          )}

          {/* ── One primary CTA ── */}
          {hasSession ? (
            <TouchableOpacity
              style={styles.primaryCta}
              onPress={() => router.push('/sleep-wake-check-in')}
              accessibilityLabel="Log last night's sleep"
              accessibilityRole="button"
            >
              <Text style={styles.primaryCtaText}>Log last night's sleep</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.primaryCta}
              onPress={() => router.push('/barrier-check-in')}
              accessibilityLabel="Start tonight's check-in"
              accessibilityRole="button"
            >
              <Text style={styles.primaryCtaText}>Start tonight's check-in</Text>
            </TouchableOpacity>
          )}

          {!hasProfile && (
            <TouchableOpacity
              style={styles.secondaryCta}
              onPress={() => router.push('/onboarding')}
              accessibilityLabel="Complete onboarding"
              accessibilityRole="button"
            >
              <Text style={styles.secondaryCtaText}>👋  Complete Setup</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </ImageBackground>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const GREEN  = '#5ba371';
const BG     = '#0A0A15';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  bg: { flex: 1 },
  scrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(6, 8, 20, 0.35)',
  },
  loader: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingTop: 16, paddingBottom: 40, gap: 16 },

  eyebrow: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  card: {
    backgroundColor: 'rgba(15, 15, 25, 0.85)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(120, 200, 140, 0.6)',
    padding: 24,
    alignItems: 'center',
    gap: 6,
    marginTop: 140,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  petImage: {
    width: 110,
    height: 110,
    marginTop: -90,
    marginBottom: 4,
  },
  cardEyebrow: { fontSize: 11, fontWeight: '700', color: '#7A9F85', letterSpacing: 1.5 },
  bedtime: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  countdownLabel: { fontSize: 14, color: GREEN, fontWeight: '600' },
  petMood: { fontSize: 13, color: '#9090B0', marginTop: 4 },

  stripRow: { marginTop: 14, alignItems: 'center', gap: 6 },
  stripLabel: { fontSize: 12, color: '#9090B0' },
  stripDots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stripDot: { fontSize: 16, color: GREEN },
  stripToday: { fontSize: 11, color: '#6060A0', marginLeft: 4 },

  primaryCta: {
    backgroundColor: GREEN,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryCtaText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  secondaryCta: {
    backgroundColor: 'rgba(15, 15, 25, 0.75)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  secondaryCtaText: { color: '#C0C0D0', fontSize: 14, fontWeight: '600' },
});
