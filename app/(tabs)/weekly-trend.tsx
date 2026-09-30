/**
 * app/(tabs)/weekly-trend.tsx — Step 7
 *
 * Displays:
 *  • 14-day bedtime line chart (react-native-gifted-charts)
 *  • Bedtime Improvement Rate stat
 *  • Intervention Completion Rate stat
 *  • Average sleep duration (bonus)
 *
 * Design intent: low-anxiety, soft colours, no red/alarm indicators.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';

import { getLogs, getProfile } from '@/src/lib/dataStore';
import type { SleepLog, Profile } from '@/src/lib/types';
import { nightAxisMinutes, localISODate } from '@/src/lib/timeMath';
import { isDemoMode } from '@/src/lib/demoMode';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH  = SCREEN_WIDTH - 40; // 20px padding each side

// ── Colour tokens ─────────────────────────────────────────────────────────────
const BG     = '#0A0A15';
const CARD   = '#13131F';
const BORDER = '#2A2A3E';
const PURPLE = '#5ba371';
const SOFT   = '#8B84FF';  // lighter purple for fills
const MUTED  = '#6060A0';

// ── Time helpers ──────────────────────────────────────────────────────────────

const timeToChartMinutes = nightAxisMinutes;

function minutesToLabel(mins: number): string {
  const wrapped = mins % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')}${period}`;
}

/** Short date label e.g. "Sep 22" */
function shortDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** ISO date string for N days ago */
function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localISODate(d);
}

// ── Stat calculations ─────────────────────────────────────────────────────────

/**
 * Bedtime Improvement Rate:
 *   % of the last 7 nights where bedtime ≤ the previous 7-night average.
 */
function calcImprovementRate(logs: SleepLog[]): string {
  const withBed = logs.filter((l) => l.bedtime);
  if (withBed.length < 8) return '—';

  const recent = withBed.slice(0, 7);   // most recent 7
  const older  = withBed.slice(7, 14);  // preceding 7

  if (older.length === 0) return '—';

  const olderAvg =
    older.reduce((s, l) => s + timeToChartMinutes(l.bedtime!), 0) / older.length;

  const improved = recent.filter((l) => timeToChartMinutes(l.bedtime!) <= olderAvg).length;
  return `${Math.round((improved / recent.length) * 100)}%`;
}

/** % of all loaded logs with intervention_completed = true */
function calcCompletionRate(logs: SleepLog[]): string {
  if (!logs.length) return '—';
  const rate = logs.filter((l) => l.intervention_completed).length / logs.length;
  return `${Math.round(rate * 100)}%`;
}

/** Average sleep duration (fall_asleep → wake) in hours */
function calcAvgDuration(logs: SleepLog[]): string {
  const valid = logs.filter((l) => l.fall_asleep_time && l.wake_time);
  if (!valid.length) return '—';
  const avgMins =
    valid.reduce((s, l) => {
      const asleep = timeToChartMinutes(l.fall_asleep_time!);
      const wake   = timeToChartMinutes(l.wake_time!);
      return s + (wake >= asleep ? wake - asleep : wake + 24 * 60 - asleep);
    }, 0) / valid.length;
  const h = Math.floor(avgMins / 60);
  const m = Math.round(avgMins % 60);
  return `${h}h ${m}m`;
}

// ── Chart data builder ────────────────────────────────────────────────────────

interface ChartPoint {
  value: number;
  label: string;
  dataPointText?: string;
  hideDataPoint?: boolean;
}

function buildChartData(logs: SleepLog[]): {
  points: ChartPoint[];
  yMin: number;
  yMax: number;
  yLabels: string[];
} {
  // Build a map of date → bedtime minutes for the last 14 days
  const byDate = new Map<string, number>();
  for (const log of logs) {
    if (log.bedtime && !byDate.has(log.date)) {
      byDate.set(log.date, timeToChartMinutes(log.bedtime));
    }
  }

  // Generate last 14 day slots (oldest → newest for left-to-right)
  const points: ChartPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = daysAgoISO(i);
    const mins  = byDate.get(date);
    const label = i % 2 === 0 ? shortDate(date) : ''; // show every-other label to avoid crowding
    points.push(
      mins !== undefined
        ? { value: mins, label, dataPointText: minutesToLabel(mins) }
        : { value: 0, label, hideDataPoint: true } // gap — no data
    );
  }

  const values = points.filter((p) => !p.hideDataPoint).map((p) => p.value);
  if (!values.length) {
    return { points, yMin: 22 * 60, yMax: 25 * 60, yLabels: [] };
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = 30; // 30 min padding top & bottom
  const yMin = Math.floor((rawMin - padding) / 30) * 30;
  const yMax = Math.ceil((rawMax  + padding) / 30) * 30;

  // Generate Y-axis labels every 30 min
  const yLabels: string[] = [];
  for (let t = yMin; t <= yMax; t += 30) {
    yLabels.push(minutesToLabel(t));
  }

  return { points, yMin, yMax, yLabels };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeeklyTrendScreen() {
  const [logs,     setLogs]     = useState<SleepLog[]>([]);
  const [demo,     setDemo]     = useState(false);
  const [profile,  setProfile]  = useState<Profile | null>(null);
  const [loading,  setLoading]  = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        const [l, p, demo] = await Promise.all([getLogs(30), getProfile(), isDemoMode()]);
        setDemo(demo);
        setLogs(demo ? l : l.filter((x) => !x.is_seed_data));
        setProfile(p);
        setLoading(false);
      })();
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={PURPLE} size="large" />
      </View>
    );
  }

  const { points, yMin, yMax, yLabels } = buildChartData(logs);
  const hasData = logs.filter((l) => l.bedtime).length >= 3;

  const improvementRate = calcImprovementRate(logs);
  const completionRate  = calcCompletionRate(logs);
  const avgDuration     = calcAvgDuration(logs);
  const targetBedtime   = profile ? minutesToLabel(timeToChartMinutes(profile.target_bedtime)) : null;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>Your Sleep Trend</Text>
          <Text style={styles.subtitle}>Last 14 nights{demo ? ' · demo data included' : ''}</Text>
        </View>

        {/* ── Line Chart ── */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Bedtime</Text>
          {targetBedtime && (
            <View style={styles.targetRow}>
              <View style={styles.targetDash} />
              <Text style={styles.targetLabel}>Target {targetBedtime}</Text>
            </View>
          )}

          {hasData ? (
            <View style={styles.chartWrapper}>
              <LineChart
                data={points}
                width={CHART_WIDTH - 80}
                height={180}
                color={SOFT}
                thickness={2.5}
                startFillColor={PURPLE}
                endFillColor={'#5ba37108'}
                startOpacity={0.25}
                endOpacity={0.02}
                areaChart
                curved
                hideDataPoints={false}
                dataPointsColor={SOFT}
                dataPointsRadius={4}
                xAxisColor={BORDER}
                yAxisColor={'transparent'}
                yAxisTextStyle={{ color: MUTED, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: MUTED, fontSize: 9 }}
                hideRules={false}
                rulesColor={'#1E1E2E'}
                rulesType="solid"
                yAxisOffset={yMin}
                maxValue={yMax - yMin}
                noOfSections={yLabels.length - 1}
                yAxisLabelTexts={yLabels}
                backgroundColor={'transparent'}
                initialSpacing={10}
                spacing={Math.floor((CHART_WIDTH - 100) / 14)}
                isAnimated
                animationDuration={800}
              />
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyText}>
                No bedtime data yet.{'\n'}Complete a check-in to see your trend.
              </Text>
            </View>
          )}
        </View>

        {/* ── Stat cards ── */}
        <Text style={styles.sectionLabel}>Your Stats</Text>
        <View style={styles.statsGrid}>
          <StatCard
            value={improvementRate}
            label="Bedtime Improvement Rate"
            sub="Nights on-track vs. prior week avg"
            accent={PURPLE}
          />
          <StatCard
            value={completionRate}
            label="Intervention Completion"
            sub="Nights you worked through your barrier"
            accent="#52C4A0"
          />
        </View>
        <View style={styles.statsGrid}>
          <StatCard
            value={avgDuration}
            label="Avg Sleep Duration"
            sub="From fall-asleep to wake-up"
            accent="#E0A060"
          />
          <StatCard
            value={String(logs.filter((l) => !l.is_seed_data).length)}
            label="Real Nights Logged"
            sub="Your own check-ins"
            accent="#60A0E0"
          />
        </View>

        {/* ── Friendly note ── */}
        <View style={styles.noteCard}>
          <Text style={styles.noteText}>
            📊 Trends take a few nights to become meaningful. Every night you check in adds to your picture — even the late ones.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  sub,
  accent,
}: {
  value: string;
  label: string;
  sub: string;
  accent: string;
}) {
  return (
    <View style={[stat.card, { borderColor: accent + '40' }]}>
      <Text style={[stat.value, { color: accent }]}>{value}</Text>
      <Text style={stat.label}>{label}</Text>
      <Text style={stat.sub}>{sub}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  loader: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  scroll: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 16 : 20,
    paddingBottom: 40,
    gap: 16,
  },

  header: { gap: 4, marginBottom: 4 },
  title:  { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: MUTED },

  chartCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 12,
    overflow: 'hidden',
  },
  chartTitle: { fontSize: 13, fontWeight: '700', color: '#888', letterSpacing: 0.5 },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  targetDash: {
    width: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#52C4A0',
    borderStyle: 'dashed',
  },
  targetLabel: { fontSize: 12, color: '#52C4A0', fontWeight: '600' },
  chartWrapper: { marginLeft: -8 },
  emptyChart: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: MUTED, textAlign: 'center', fontSize: 14, lineHeight: 22 },

  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#555', letterSpacing: 0.5 },
  statsGrid: { flexDirection: 'row', gap: 12 },

  noteCard: {
    backgroundColor: '#131320',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A4E',
    marginTop: 4,
  },
  noteText: { color: '#6060A0', fontSize: 13, lineHeight: 20 },
});

const stat = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 4,
  },
  value: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  label: { color: '#DDD', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  sub:   { color: '#555', fontSize: 11, lineHeight: 16 },
});
