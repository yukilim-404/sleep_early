/**
 * app/barrier-check-in.tsx — Step 8 (primary demo screen)
 *
 * "What's keeping you up tonight?"
 * Routes:
 *   Unfinished work  → /task-closure (with barrier=work)
 *   Overthinking     → /brain-dump   (bonus step 11)
 *   Everything else  → /wind-down    (with barrier=<tag>)
 *
 * Each option card entrance is staggered for a polished feel.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { BarrierTag } from '@/src/lib/types';

// ── Barrier options ───────────────────────────────────────────────────────────

const BARRIERS: {
  id: BarrierTag;
  emoji: string;
  label: string;
  sub: string;
  accentColor: string;
}[] = [
  {
    id: 'phone',
    emoji: '📱',
    label: 'Phone / Doomscrolling',
    sub: 'Hard to put it down, one more scroll.',
    accentColor: '#8B84FF',
  },
  {
    id: 'gaming',
    emoji: '🎮',
    label: 'Gaming',
    sub: 'Just one more level turned into a few more.',
    accentColor: '#7CC4E0',
  },
  {
    id: 'work',
    emoji: '💼',
    label: 'Unfinished Work',
    sub: "Something's still on your plate tonight.",
    accentColor: '#E0A868',
  },
  {
    id: 'overthinking',
    emoji: '🧠',
    label: 'Overthinking',
    sub: "Mind's running through scenarios.",
    accentColor: '#A868E0',
  },
  {
    id: 'me_time',
    emoji: '🌟',
    label: 'Not Enough Me-Time',
    sub: 'The day was all for others; this is yours.',
    accentColor: '#68C48A',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function BarrierCheckInScreen() {
  const router = useRouter();

  // Staggered card entrance animations
  const anims = useRef(
    BARRIERS.map(() => ({
      opacity:     new Animated.Value(0),
      translateY:  new Animated.Value(24),
    }))
  ).current;

  const headerAnim = useRef({
    opacity:    new Animated.Value(0),
    translateY: new Animated.Value(-16),
  }).current;

  useEffect(() => {
    // Header fades in first
    Animated.parallel([
      Animated.timing(headerAnim.opacity,    { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(headerAnim.translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    // Cards stagger in after 200ms
    const stagger = Animated.stagger(
      80,
      anims.map((a) =>
        Animated.parallel([
          Animated.timing(a.opacity,    { toValue: 1, duration: 350, delay: 200, useNativeDriver: true }),
          Animated.timing(a.translateY, { toValue: 0, duration: 350, delay: 200, useNativeDriver: true }),
        ])
      )
    );
    stagger.start();
  }, []);

  function handleSelect(barrier: BarrierTag) {
    if (barrier === 'work') {
      router.push({ pathname: '/task-closure', params: { barrier } });
    } else if (barrier === 'overthinking') {
      router.push({ pathname: '/brain-dump', params: { barrier } });
    } else {
      router.push({
        pathname: '/wind-down',
        params: { barrier, intervention_completed: 'true' },
      });
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity:   headerAnim.opacity,
              transform: [{ translateY: headerAnim.translateY }],
            },
          ]}
        >
          <Text style={styles.eyebrow}>TONIGHT'S CHECK-IN</Text>
          <Text style={styles.title}>What's keeping{'\n'}you up?</Text>
          <Text style={styles.subtitle}>
            Pick the one that feels most true right now.{'\n'}No judgment — just honesty.
          </Text>
        </Animated.View>

        {/* ── Option cards ── */}
        <View style={styles.cards}>
          {BARRIERS.map((b, i) => (
            <Animated.View
              key={b.id}
              style={{
                opacity:   anims[i].opacity,
                transform: [{ translateY: anims[i].translateY }],
              }}
            >
              <BarrierCard barrier={b} onPress={() => handleSelect(b.id)} />
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Barrier card sub-component ────────────────────────────────────────────────

function BarrierCard({
  barrier,
  onPress,
}: {
  barrier: (typeof BARRIERS)[number];
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.card, { borderColor: barrier.accentColor + '40' }]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        accessibilityLabel={`Select: ${barrier.label}`}
        accessibilityRole="button"
      >
        <View style={[styles.emojiWrap, { backgroundColor: barrier.accentColor + '18' }]}>
          <Text style={styles.emoji}>{barrier.emoji}</Text>
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardLabel}>{barrier.label}</Text>
          <Text style={styles.cardSub}>{barrier.sub}</Text>
        </View>
        <Text style={[styles.arrow, { color: barrier.accentColor }]}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const BG   = '#0A0A15';
const CARD = '#13131F';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 20 : 24,
    paddingBottom: 48,
    gap: 24,
  },

  header: { gap: 8, marginBottom: 4 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5ba371',
    letterSpacing: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#6060A0',
    lineHeight: 22,
  },

  cards: { gap: 12 },
  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  emojiWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26 },
  cardText: { flex: 1, gap: 3 },
  cardLabel: { color: '#E8E8FF', fontSize: 16, fontWeight: '700' },
  cardSub:   { color: '#5A5A8A', fontSize: 13, lineHeight: 18 },
  arrow:     { fontSize: 24, fontWeight: '300', lineHeight: 28 },
});
