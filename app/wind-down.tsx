/**
 * app/wind-down.tsx — Step 8 / Step 9
 *
 * Calm wind-down screen used by all barrier types.
 * Receives via route params:
 *   barrier                 — BarrierTag
 *   intervention_completed  — "true" | "false"
 *   closure                 — "tomorrow" | "done" | undefined (task-closure paths)
 *
 * "Going to sleep now" records the current time as bedtime (in-memory for now,
 * persisted to Supabase in Step 9 when morning check-in completes the row).
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { saveTonightSession } from '@/src/lib/session';
import type { BarrierTag } from '@/src/lib/types';

// ── Copy by barrier + closure ─────────────────────────────────────────────────

function getWindDownCopy(barrier?: string, closure?: string): { heading: string; body: string } {
  if (barrier === 'work' && closure === 'tomorrow') {
    return {
      heading: 'Work can wait.\nRest cannot.',
      body: "You've parked it safely for tomorrow. Your brain can let go now — it's already handled.",
    };
  }
  if (barrier === 'work' && closure === 'done') {
    return {
      heading: "Done. Now rest.",
      body: "You finished it. That took discipline. Now let yourself actually switch off.",
    };
  }
  if (barrier === 'phone' || barrier === 'gaming') {
    return {
      heading: 'Time to put it down.',
      body: "It'll still be there tomorrow. For the next few hours, this time is yours — actually yours.",
    };
  }
  if (barrier === 'overthinking') {
    return {
      heading: "Your thoughts are noted.",
      body: "You've acknowledged what's on your mind. You don't have to solve it tonight. Just breathe.",
    };
  }
  if (barrier === 'me_time') {
    return {
      heading: 'You got your time.',
      body: "And now the kindest thing you can do for yourself is sleep. Tomorrow you'll show up better rested.",
    };
  }
  return {
    heading: 'Time to rest.',
    body: "Your mind has done enough for today. Whatever's left can wait until tomorrow.",
  };
}

// ── Breathing animation dots ──────────────────────────────────────────────────

function BreathingOrb() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 3500, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,    duration: 3500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.orb, { transform: [{ scale }] }]}>
      <Animated.View
        style={[
          styles.orbInner,
          {
            transform: [{ scale: scale }],
          },
        ]}
      />
      <Text style={styles.orbEmoji}>🌙</Text>
    </Animated.View>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WindDownScreen() {
  const router = useRouter();
  const { barrier, intervention_completed, closure } = useLocalSearchParams<{
    barrier?: string;
    intervention_completed?: string;
    closure?: string;
  }>();

  const [sleeping, setSleeping] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const { heading, body } = getWindDownCopy(barrier, closure);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 100 }),
    ]).start();
  }, []);

  async function handleSleep() {
    setSleeping(true);

    await saveTonightSession({
      bedtime: new Date().toTimeString().slice(0, 8), // "HH:MM:SS"
      barrier: (barrier as BarrierTag | undefined) ?? null,
      intervention_completed: intervention_completed === 'true',
    });

    // Fade to black, then navigate home
    Animated.timing(fadeAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start(() => {
      router.replace('/(tabs)');
    });
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Breathing orb */}
        <BreathingOrb />

        {/* Copy */}
        <View style={styles.textBlock}>
          <Text style={styles.heading}>{heading}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>

        {/* Breathing cue */}
        <View style={styles.breatheRow}>
          <View style={styles.breatheDot} />
          <Text style={styles.breatheText}>Breathe slowly</Text>
          <View style={styles.breatheDot} />
        </View>

        {/* Sleep CTA */}
        <TouchableOpacity
          style={[styles.cta, sleeping && styles.ctaSleeping]}
          onPress={handleSleep}
          disabled={sleeping}
          accessibilityLabel="Going to sleep now"
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>
            {sleeping ? 'Good night 🌙' : 'Going to Sleep Now'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.tip}>
          Tap when you're ready to close the app and sleep.
        </Text>
      </Animated.View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#060610',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 28,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
  },

  // Orb
  orb: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#120C2A',
    borderWidth: 1,
    borderColor: '#3A2E7A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5ba371',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  orbInner: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#5ba37110',
  },
  orbEmoji: { fontSize: 52 },

  // Text
  textBlock: { gap: 12, alignItems: 'center' },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: '#E8E0FF',
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 16,
    color: '#6060A0',
    textAlign: 'center',
    lineHeight: 25,
    maxWidth: 300,
  },

  // Breathe indicator
  breatheRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breatheDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3A2E7A',
  },
  breatheText: {
    color: '#3A3A6A',
    fontSize: 13,
    letterSpacing: 1,
    fontWeight: '500',
  },

  // CTA
  cta: {
    backgroundColor: '#1A163A',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderWidth: 1,
    borderColor: '#3A2E7A',
    shadowColor: '#5ba371',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  ctaSleeping: {
    backgroundColor: '#0A0A1E',
    borderColor: '#2A2A4A',
  },
  ctaText: {
    color: '#A090E0',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },

  tip: {
    color: '#2A2A4A',
    fontSize: 12,
    textAlign: 'center',
  },
});
