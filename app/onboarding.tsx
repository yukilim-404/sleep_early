/**
 * app/onboarding.tsx
 *
 * 3-step wizard following Signup Wireframes.pdf direction 2c:
 *   1. Account  — already done (login.tsx), shown here as a completed step
 *   2. Schedule — target bedtime, wake time, workdays, timezone
 *   3. Reminders — what usually keeps you up (barriers) + notification opt-in
 *
 * On finish: saveProfile() → generateSeedHistory() (demo mode only) → navigate to Home
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { saveProfile } from '@/src/lib/dataStore';
import { scheduleReminders, requestNotificationPermissions } from '@/src/lib/notifications';
import { generateSeedHistory, userHasLogs } from '@/src/lib/seedData';
import { isDemoMode, setDemoMode } from '@/src/lib/demoMode';
import { QuickTimePicker } from '@/src/components/TimePicker';
import type { BarrierTag, Workday } from '@/src/lib/types';

// ── Static data ───────────────────────────────────────────────────────────────

const BARRIERS: { id: BarrierTag; emoji: string; label: string; sub: string }[] = [
  { id: 'phone',        emoji: '📱', label: 'Phone',          sub: 'Doomscrolling / social media' },
  { id: 'gaming',       emoji: '🎮', label: 'Gaming',         sub: 'One more level syndrome'       },
  { id: 'work',         emoji: '💼', label: 'Unfinished work', sub: 'Tasks still on my mind'       },
  { id: 'overthinking', emoji: '🧠', label: 'Overthinking',   sub: 'Brain won\'t quiet down'       },
  { id: 'me_time',      emoji: '🌟', label: 'Me-time',        sub: 'Finally have the house to myself' },
];

const DAYS: { id: Workday; label: string }[] = [
  { id: 'mon', label: 'M' },
  { id: 'tue', label: 'T' },
  { id: 'wed', label: 'W' },
  { id: 'thu', label: 'T' },
  { id: 'fri', label: 'F' },
  { id: 'sat', label: 'S' },
  { id: 'sun', label: 'S' },
];

const STEPS = ['Account', 'Schedule', 'Reminders'] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toTimeString(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const titleTaps = useRef(0);

  // step index into STEPS — 0 (Account) is already complete via login, so the
  // wizard itself only shows 1 (Schedule) and 2 (Reminders).
  const [step, setStep] = useState<1 | 2>(1);

  async function handleTitleTap() {
    titleTaps.current += 1;
    if (titleTaps.current >= 5) {
      titleTaps.current = 0;
      await setDemoMode(true);
      Alert.alert('Demo mode on', 'Sample history will be added when you finish setup.');
    }
  }

  // Bedtime default: 23:00
  const [bedHour,   setBedHour]   = useState(23);
  const [bedMinute, setBedMinute] = useState(0);

  // Wake time default: 07:00
  const [wakeHour,   setWakeHour]   = useState(7);
  const [wakeMinute, setWakeMinute] = useState(0);

  const [workdays,  setWorkdays]  = useState<Workday[]>(['mon','tue','wed','thu','fri']);
  const [barriers,  setBarriers]  = useState<BarrierTag[]>([]);
  const [loading,   setLoading]   = useState(false);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function toggleWorkday(day: Workday) {
    setWorkdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function toggleBarrier(tag: BarrierTag) {
    setBarriers((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleFinish() {
    if (barriers.length === 0) {
      Alert.alert('Pick at least one', 'Select what usually keeps you up so we can tailor your check-ins.');
      return;
    }

    setLoading(true);
    try {
      const targetBedtime = toTimeString(bedHour, bedMinute);
      const wakeTime      = toTimeString(wakeHour, wakeMinute);

      // 1. Save profile
      const profile = await saveProfile({
        target_bedtime:    targetBedtime,
        wake_time:         wakeTime,
        workdays,
        timezone,
        baseline_barriers: barriers,
      });

      if (!profile) {
        Alert.alert('Save failed', 'Could not save your profile. Check your connection and try again.');
        return;
      }

      // 2. Schedule nightly check-in notifications
      await new Promise<void>((resolve) =>
        Alert.alert(
          'Bedtime reminders',
          "We'll nudge you 2 hours before bed, 15 minutes before, and in the morning to log your sleep. You can change this anytime in Settings.",
          [{ text: 'Continue', onPress: () => resolve() }],
          { cancelable: false }
        )
      );
      await requestNotificationPermissions();
      await scheduleReminders(targetBedtime, wakeTime);

      // 3. Generate seed history (demo mode only)
      const hasLogs = await userHasLogs();
      if (!hasLogs && (await isDemoMode())) {
        await generateSeedHistory(targetBedtime, barriers);
      }

      router.replace('/(tabs)');
    } catch (err) {
      console.error('[Onboarding] Unexpected error:', err);
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Step header — wireframe 2c: WELCOME + ✓ 2 3 / Account Schedule Reminders ── */}
        <TouchableOpacity activeOpacity={1} onPress={handleTitleTap}>
          <Text style={styles.welcome}>WELCOME</Text>
        </TouchableOpacity>
        <StepIndicator currentIndex={step} />

        {step === 1 ? (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>When do you{'\n'}want to sleep?</Text>
              <Text style={styles.subtitle}>
                Takes 30 seconds. We'll use this to personalise your check-ins.
              </Text>
            </View>

            <Section label="🛏  Target Bedtime" hint="When do you want to be in bed?">
              <QuickTimePicker
                label="I want to sleep by"
                hour={bedHour}
                minute={bedMinute}
                onHourChange={setBedHour}
                onMinuteChange={setBedMinute}
              />
            </Section>

            <Section label="☀️  Wake Time" hint="When do you need to be up?">
              <QuickTimePicker
                label="I wake up at"
                hour={wakeHour}
                minute={wakeMinute}
                onHourChange={setWakeHour}
                onMinuteChange={setWakeMinute}
              />
            </Section>

            <Section label="📅  Workdays" hint="Which days do you usually work?">
              <View style={styles.dayRow}>
                {DAYS.map((d) => {
                  const active = workdays.includes(d.id);
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.dayChip, active && styles.dayChipActive]}
                      onPress={() => toggleWorkday(d.id)}
                      accessibilityLabel={`Toggle ${d.id}`}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>

            <View style={styles.timezoneRow}>
              <Text style={styles.timezoneLabel}>Timezone: auto-detected</Text>
              <Text style={styles.timezoneValue}>{timezone}</Text>
            </View>

            <View style={styles.navRow}>
              <View style={styles.navBackSpacer} />
              <TouchableOpacity
                style={styles.navNext}
                onPress={() => setStep(2)}
                accessibilityLabel="Next: Reminders"
                accessibilityRole="button"
              >
                <Text style={styles.navNextText}>Next →</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>What usually{'\n'}keeps you up?</Text>
              <Text style={styles.subtitle}>
                Select all that apply — we'll focus on these in your nightly check-ins.
              </Text>
            </View>

            <View style={styles.barrierList}>
              {BARRIERS.map((b) => {
                const active = barriers.includes(b.id);
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.barrierChip, active && styles.barrierChipActive]}
                    onPress={() => toggleBarrier(b.id)}
                    accessibilityLabel={`Select barrier: ${b.label}`}
                    accessibilityState={{ selected: active }}
                  >
                    <View style={styles.barrierRow}>
                      <Text style={styles.barrierEmoji}>{b.emoji}</Text>
                      <View style={styles.barrierText}>
                        <Text style={[styles.barrierLabel, active && styles.barrierLabelActive]}>
                          {b.label}
                        </Text>
                        <Text style={styles.barrierSub}>{b.sub}</Text>
                      </View>
                      {active && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Section label="🔔  Reminders" hint="We'll nudge you before bed and in the morning.">
              <Text style={styles.reminderNote}>
                Wind-down nudge (2 hours before bed) and a morning log reminder — both on by
                default, and can be turned off anytime in Settings.
              </Text>
            </Section>

            <View style={styles.navRow}>
              <TouchableOpacity
                style={styles.navBack}
                onPress={() => setStep(1)}
                accessibilityLabel="Back to Schedule"
                accessibilityRole="button"
              >
                <Text style={styles.navBackText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cta, loading && styles.ctaDisabled]}
                onPress={handleFinish}
                disabled={loading}
                accessibilityLabel="Get started"
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaText}>Get Started →</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        <Text style={styles.footer}>
          You can update these anytime from settings.
        </Text>
      </ScrollView>
    </View>
  );
}

// ── Sub-component: step indicator (✓ · current · future) ──────────────────────

function StepIndicator({ currentIndex }: { currentIndex: 1 | 2 }) {
  return (
    <View style={styles.stepRow}>
      {STEPS.map((label, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                done && styles.stepDotDone,
                current && styles.stepDotCurrent,
              ]}
            >
              <Text style={styles.stepDotText}>{done ? '✓' : i + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, current && styles.stepLabelCurrent]}>{label}</Text>
            {i < STEPS.length - 1 && <View style={styles.stepConnector} />}
          </View>
        );
      })}
    </View>
  );
}

// ── Sub-component: Section wrapper ────────────────────────────────────────────

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

// ── Styles ────────────────────────────────────────────────────────────────────

const PURPLE = '#5ba371';
const BG     = '#0A0A15';
const CARD   = '#13131F';
const BORDER = '#2A2A3E';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 48,
    gap: 28,
  },

  // Welcome + step indicator
  welcome: {
    color: '#5A5A80',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  stepItem: {
    alignItems: 'center',
    position: 'relative',
    minWidth: 84,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepDotDone: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
  },
  stepDotCurrent: {
    borderColor: PURPLE,
  },
  stepDotText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  stepLabel: {
    color: '#5A5A80',
    fontSize: 11,
  },
  stepLabelCurrent: {
    color: '#E0E0FF',
    fontWeight: '700',
  },
  stepConnector: {
    position: 'absolute',
    top: 13,
    left: '75%',
    right: '-25%',
    height: 1.5,
    backgroundColor: BORDER,
  },

  // Header
  header: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#7070A0',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },

  // Section
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E0E0FF',
    letterSpacing: 0.2,
  },
  sectionHint: {
    fontSize: 13,
    color: '#6060A0',
    marginBottom: 2,
  },

  // Workday chips
  dayRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  dayChip: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
  },
  dayChipText: {
    color: '#555',
    fontSize: 14,
    fontWeight: '700',
  },
  dayChipTextActive: {
    color: '#fff',
  },

  // Timezone
  timezoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  timezoneLabel: { color: '#7070A0', fontSize: 13 },
  timezoneValue: { color: '#AAA', fontSize: 13, fontWeight: '600' },

  // Barrier list
  barrierList: {
    gap: 10,
  },
  barrierChip: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  barrierChipActive: {
    borderColor: PURPLE,
    backgroundColor: '#1A1A2E',
  },
  barrierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  barrierEmoji: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  barrierText: {
    flex: 1,
    gap: 2,
  },
  barrierLabel: {
    color: '#AAA',
    fontSize: 15,
    fontWeight: '600',
  },
  barrierLabelActive: {
    color: '#fff',
  },
  barrierSub: {
    color: '#555',
    fontSize: 12,
  },
  checkmark: {
    color: PURPLE,
    fontSize: 18,
    fontWeight: '700',
  },
  reminderNote: {
    color: '#7070A0',
    fontSize: 13,
    lineHeight: 19,
  },

  // Nav row (Back / Next or Back / Get Started)
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navBackSpacer: { flex: 0 },
  navBack: {
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  navBackText: {
    color: '#9090B0',
    fontSize: 15,
    fontWeight: '600',
  },
  navNext: {
    flex: 1,
    backgroundColor: PURPLE,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  navNextText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // CTA (final step)
  cta: {
    flex: 1,
    backgroundColor: PURPLE,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  footer: {
    color: '#3A3A5A',
    fontSize: 12,
    textAlign: 'center',
  },
});
