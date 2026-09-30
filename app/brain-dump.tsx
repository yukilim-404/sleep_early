/**
 * app/brain-dump.tsx — Step 11 (hardcoded offline version)
 *
 * Reachable from BarrierCheckIn when "Overthinking" is selected.
 *
 * Flow:
 *   1. Mic button → 2s "Listening…" animation
 *   2. Fixed fake transcript appears
 *   3. Structured checklist + reassurance text
 *   4. "Ready to wind down?" → /wind-down
 *
 * 100% offline — no STT or LLM API calls in this version.
 */
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// ── Hardcoded demo content ────────────────────────────────────────────────────

const FAKE_TRANSCRIPT =
  "Tomorrow I have a presentation and I'm worried I'll forget the slides. Also I haven't replied to my group member.";

const TOMORROW_TASKS = [
  'Review presentation slides',
  'Reply to group member',
];

type Stage = 'idle' | 'listening' | 'transcript' | 'structured';

// ── Component ─────────────────────────────────────────────────────────────────

export default function BrainDumpScreen() {
  const router = useRouter();
  const { barrier } = useLocalSearchParams<{ barrier?: string }>();

  const [stage,    setStage]    = useState<Stage>('idle');
  const [checked,  setChecked]  = useState<boolean[]>(TOMORROW_TASKS.map(() => false));

  // Animations
  const micPulse   = useRef(new Animated.Value(1)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const fadeIn     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  // Mic pulse loop while listening
  useEffect(() => {
    if (stage === 'listening') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(micPulse, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(micPulse, { toValue: 1,   duration: 500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      micPulse.setValue(1);
    }
  }, [stage]);

  function handleMicPress() {
    if (stage !== 'idle') return;

    // 1. Show listening
    setStage('listening');

    // 2. After 2s, show transcript
    setTimeout(() => {
      setStage('transcript');
      Animated.timing(contentAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

      // 3. After another 1.5s, show structured output
      setTimeout(() => {
        setStage('structured');
      }, 1500);
    }, 2000);
  }

  function toggleCheck(i: number) {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  function handleWindDown() {
    router.push({
      pathname: '/wind-down',
      params: {
        barrier: barrier ?? 'overthinking',
        intervention_completed: 'true',
        closure: 'brain_dump',
      },
    });
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.ScrollView
        style={{ opacity: fadeIn }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>Brain Dump</Text>
          <Text style={styles.subtitle}>
            Speak your thoughts out loud. We'll organise them so your mind can let go.
          </Text>
        </View>

        {/* ── Mic button ── */}
        {(stage === 'idle' || stage === 'listening') && (
          <View style={styles.micSection}>
            <Animated.View style={[styles.micRing, { transform: [{ scale: micPulse }] }]}>
              <TouchableOpacity
                style={[styles.micBtn, stage === 'listening' && styles.micBtnActive]}
                onPress={handleMicPress}
                disabled={stage === 'listening'}
                accessibilityLabel={stage === 'listening' ? 'Listening...' : 'Tap to speak'}
                accessibilityRole="button"
              >
                <Text style={styles.micIcon}>{stage === 'listening' ? '🎙️' : '🎤'}</Text>
              </TouchableOpacity>
            </Animated.View>

            <Text style={styles.micLabel}>
              {stage === 'idle'
                ? 'Tap the mic and speak freely'
                : '🔴 Listening…'}
            </Text>
            {stage === 'idle' && (
              <Text style={styles.micHint}>
                Say whatever's on your mind — worries, tasks, anything.
              </Text>
            )}
          </View>
        )}

        {/* ── Transcript ── */}
        {(stage === 'transcript' || stage === 'structured') && (
          <Animated.View style={[styles.transcriptCard, { opacity: contentAnim }]}>
            <Text style={styles.transcriptLabel}>YOU SAID</Text>
            <Text style={styles.transcriptText}>"{FAKE_TRANSCRIPT}"</Text>
          </Animated.View>
        )}

        {/* ── Structured output ── */}
        {stage === 'structured' && (
          <Animated.View style={[styles.structured, { opacity: contentAnim }]}>
            {/* Tomorrow tasks */}
            <View style={styles.taskCard}>
              <Text style={styles.taskCardLabel}>📋  TOMORROW'S LIST</Text>
              {TOMORROW_TASKS.map((task, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.taskRow}
                  onPress={() => toggleCheck(i)}
                  accessibilityLabel={`Task: ${task}`}
                  accessibilityState={{ checked: checked[i] }}
                >
                  <View style={[styles.checkbox, checked[i] && styles.checkboxDone]}>
                    {checked[i] && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[styles.taskText, checked[i] && styles.taskTextDone]}>
                    {task}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tonight reassurance */}
            <View style={styles.tonightCard}>
              <Text style={styles.tonightLabel}>🌙  TONIGHT</Text>
              <Text style={styles.tonightText}>
                Nothing else needs to be solved.{'\n'}Your thoughts are captured.
              </Text>
            </View>

            {/* Wind down CTA */}
            <TouchableOpacity
              style={styles.cta}
              onPress={handleWindDown}
              accessibilityLabel="Ready to wind down"
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>Ready to Wind Down →</Text>
            </TouchableOpacity>

            <Text style={styles.footer}>
              These tasks will still be here tomorrow. Right now, rest is the priority.
            </Text>
          </Animated.View>
        )}
      </Animated.ScrollView>
    </View>
  );
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

  header: { gap: 8 },
  title:  { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  subtitle: { fontSize: 15, color: '#6060A0', lineHeight: 22 },

  // Mic
  micSection: { alignItems: 'center', gap: 16, paddingVertical: 16 },
  micRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1A1A2E',
    borderWidth: 2,
    borderColor: PURPLE + '60',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  micBtn: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#1E1A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: '#2A0A2A' },
  micIcon:  { fontSize: 40 },
  micLabel: { fontSize: 16, color: '#E0E0FF', fontWeight: '600' },
  micHint:  { fontSize: 13, color: '#4A4A7A', textAlign: 'center', maxWidth: 260 },

  // Transcript
  transcriptCard: {
    backgroundColor: '#0F0F20',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2A4A',
    gap: 8,
  },
  transcriptLabel: { fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 1.5 },
  transcriptText:  { fontSize: 15, color: '#8080C0', lineHeight: 22, fontStyle: 'italic' },

  // Structured output
  structured: { gap: 14 },
  taskCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 12,
  },
  taskCardLabel: { fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 1.5 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: PURPLE, borderColor: PURPLE },
  checkmark:    { color: '#fff', fontSize: 14, fontWeight: '700' },
  taskText:     { fontSize: 15, color: '#C0C0E0', flex: 1, fontWeight: '500' },
  taskTextDone: { color: '#555', textDecorationLine: 'line-through' },

  tonightCard: {
    backgroundColor: '#0A1510',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1A4030',
    gap: 8,
  },
  tonightLabel: { fontSize: 11, fontWeight: '700', color: '#52C4A0', letterSpacing: 1.5 },
  tonightText:  { fontSize: 16, color: '#70C0A0', lineHeight: 24, fontWeight: '500' },

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
    marginTop: 4,
  },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  footer: { color: '#3A3A5A', fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
