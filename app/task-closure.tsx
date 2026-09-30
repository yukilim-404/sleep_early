/**
 * app/task-closure.tsx — Step 8 (primary demo screen, must be most polished)
 *
 * "You still have unfinished work."
 * Three options — all count as intervention_completed = true:
 *   1. "Work on it now"         → returns to Home
 *   2. "Save & continue tomorrow" → shows calm confirmation → navigates to WindDown
 *   3. "Mark as done"           → navigates directly to WindDown
 *
 * The "Save & continue tomorrow" path shows an animated reassurance panel
 * before navigating — this is the key emotional beat of the demo.
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

// ── Component ─────────────────────────────────────────────────────────────────

type ClosureChoice = 'work' | 'tomorrow' | 'done';

export default function TaskClosureScreen() {
  const router = useRouter();
  const { barrier } = useLocalSearchParams<{ barrier?: string }>();

  const [showConfirmation, setShowConfirmation] = useState(false);

  // Entrance animations
  const contentAnim = useRef({
    opacity:    new Animated.Value(0),
    translateY: new Animated.Value(20),
  }).current;

  // Confirmation panel animation
  const confirmAnim = useRef({
    opacity:    new Animated.Value(0),
    translateY: new Animated.Value(30),
    scale:      new Animated.Value(0.95),
  }).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(contentAnim.opacity,    { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(contentAnim.translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 120 }),
    ]).start();
  }, []);

  function animateConfirmationIn() {
    setShowConfirmation(true);
    Animated.parallel([
      Animated.timing(confirmAnim.opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(confirmAnim.translateY, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 100 }),
      Animated.spring(confirmAnim.scale,   { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 100 }),
    ]).start();
  }

  function handleChoice(choice: ClosureChoice) {
    switch (choice) {
      case 'work':
        // User will handle it outside the app — go home
        // Still counts as intervention_completed (they engaged with the prompt)
        router.replace('/(tabs)');
        break;

      case 'tomorrow':
        // Show the "your work is parked" reassurance, then go to wind-down
        animateConfirmationIn();
        break;

      case 'done':
        router.push({
          pathname: '/wind-down',
          params: {
            barrier: barrier ?? 'work',
            intervention_completed: 'true',
            closure: 'done',
          },
        });
        break;
    }
  }

  function handleContinueToWindDown() {
    router.push({
      pathname: '/wind-down',
      params: {
        barrier: barrier ?? 'work',
        intervention_completed: 'true',
        closure: 'tomorrow',
      },
    });
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        style={{
          opacity:   contentAnim.opacity,
          transform: [{ translateY: contentAnim.translateY }],
        }}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>💼</Text>
          </View>
          <Text style={styles.title}>You still have{'\n'}unfinished work.</Text>
          <Text style={styles.subtitle}>
            That's okay. You showed up and faced it.{'\n'}What feels right for tonight?
          </Text>
        </View>

        {/* ── Confirmation panel (shown after "park it") ── */}
        {showConfirmation && (
          <Animated.View
            style={[
              styles.confirmCard,
              {
                opacity:   confirmAnim.opacity,
                transform: [
                  { translateY: confirmAnim.translateY },
                  { scale: confirmAnim.scale },
                ],
              },
            ]}
          >
            <Text style={styles.confirmEmoji}>✅</Text>
            <Text style={styles.confirmTitle}>
              Okay, I've moved it to tomorrow.
            </Text>
            <Text style={styles.confirmBody}>
              Your work is parked. You don't need to{'\n'}solve it tonight. Rest is productive too.
            </Text>
            <TouchableOpacity
              style={styles.confirmCta}
              onPress={handleContinueToWindDown}
              accessibilityLabel="Continue to wind down"
            >
              <Text style={styles.confirmCtaText}>Continue to Wind Down →</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Options (hidden once confirmation shows) ── */}
        {!showConfirmation && (
          <View style={styles.options}>
            {/* Option 1: Work on it now */}
            <OptionCard
              emoji="⚡"
              title="Work on it now"
              sub="I'll finish it, then come back when I'm ready."
              accentColor="#E0A060"
              onPress={() => handleChoice('work')}
            />

            {/* Option 2: Park it — the key intervention */}
            <OptionCard
              emoji="📥"
              title="Save &amp; continue tomorrow"
              sub="I'll let it rest tonight. It'll be there in the morning."
              accentColor="#5ba371"
              featured
              onPress={() => handleChoice('tomorrow')}
            />

            {/* Option 3: Mark done */}
            <OptionCard
              emoji="✓"
              title="Mark as done"
              sub="Actually, it's finished. Time to sleep."
              accentColor="#52C4A0"
              onPress={() => handleChoice('done')}
            />
          </View>
        )}

        {/* ── Calm footer note ── */}
        {!showConfirmation && (
          <Text style={styles.footer}>
            Whichever you choose, you've already done the hard part — acknowledging it.
          </Text>
        )}
      </Animated.ScrollView>
    </View>
  );
}

// ── Option card sub-component ─────────────────────────────────────────────────

function OptionCard({
  emoji,
  title,
  sub,
  accentColor,
  featured = false,
  onPress,
}: {
  emoji: string;
  title: string;
  sub: string;
  accentColor: string;
  featured?: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[
          styles.optionCard,
          { borderColor: accentColor + (featured ? 'CC' : '30') },
          featured && styles.optionCardFeatured,
        ]}
        onPress={onPress}
        onPressIn={() =>
          Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 3 }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 3 }).start()
        }
        activeOpacity={1}
        accessibilityLabel={title}
        accessibilityRole="button"
      >
        {featured && (
          <View style={[styles.featuredTag, { backgroundColor: accentColor }]}>
            <Text style={styles.featuredTagText}>RECOMMENDED</Text>
          </View>
        )}
        <View style={styles.optionRow}>
          <View style={[styles.optionEmoji, { backgroundColor: accentColor + '20' }]}>
            <Text style={styles.optionEmojiText}>{emoji}</Text>
          </View>
          <View style={styles.optionText}>
            <Text style={[styles.optionTitle, featured && { color: '#fff' }]}>{title}</Text>
            <Text style={styles.optionSub}>{sub}</Text>
          </View>
          <Text style={[styles.optionArrow, { color: accentColor }]}>›</Text>
        </View>
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
    paddingBottom: 56,
    gap: 24,
  },

  // Header
  header: { alignItems: 'center', gap: 14, marginBottom: 4 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#E0A86820',
    borderWidth: 1,
    borderColor: '#E0A86840',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  icon:     { fontSize: 36 },
  title:    { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 36, letterSpacing: -0.4 },
  subtitle: { fontSize: 15, color: '#6060A0', textAlign: 'center', lineHeight: 22 },

  // Confirmation panel
  confirmCard: {
    backgroundColor: '#0F1F18',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#52C4A060',
    padding: 28,
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  confirmEmoji: { fontSize: 40, marginBottom: 4 },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#E8FFF4',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  confirmBody: {
    fontSize: 15,
    color: '#70A090',
    textAlign: 'center',
    lineHeight: 23,
  },
  confirmCta: {
    marginTop: 12,
    backgroundColor: '#52C4A0',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  confirmCtaText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Options
  options: { gap: 12 },
  optionCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
  },
  optionCardFeatured: {
    backgroundColor: '#161628',
    paddingTop: 40, // room for the RECOMMENDED tag
  },
  featuredTag: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 5,
    alignItems: 'center',
  },
  featuredTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  optionRow:       { flexDirection: 'row', alignItems: 'center', gap: 14 },
  optionEmoji:     { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  optionEmojiText: { fontSize: 22 },
  optionText:      { flex: 1, gap: 3 },
  optionTitle:     { color: '#C0C0E0', fontSize: 16, fontWeight: '700' },
  optionSub:       { color: '#505080', fontSize: 13, lineHeight: 18 },
  optionArrow:     { fontSize: 24, lineHeight: 28 },

  // Footer
  footer: {
    fontSize: 13,
    color: '#3A3A5A',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
});
