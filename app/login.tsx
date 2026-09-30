/**
 * Login/signup — follows Signup Wireframes.pdf direction 2d exactly: a
 * full-bleed night scene with a floating card offset from the edges (rounded
 * on all corners, glowing border), brand title over the scene top-left.
 * Direction 2e's resend countdown and two-step email→code flow are folded in.
 * Direction 2b ("start without an account") is intentionally NOT built —
 * login is mandatory in this app.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';

import { sendLoginCode, verifyLoginCode } from '@/src/lib/auth';
import { PRIVACY_POLICY_URL } from '@/constants/links';

const GREEN = '#5ba371';
const RESEND_SECONDS = 42;
const WIDE_BREAKPOINT = 700;

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const player = useVideoPlayer(
    require('@/assets/videos/login-bg.mp4'),
    (p) => {
      p.loop = true;
      p.muted = true;
    }
  );

  // Explicit play() after mount — on web, autoplay from inside useVideoPlayer's
  // setup callback can get dropped before the player is actually ready.
  useEffect(() => {
    player.play();
  }, [player]);

  // Resend countdown — starts once a code is sent (wireframe 2e: "Resend code in 0:42")
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!sent) return;
    setResendIn(RESEND_SECONDS);
    timerRef.current = setInterval(() => {
      setResendIn((s) => (s <= 1 ? (clearInterval(timerRef.current!), 0) : s - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sent]);

  async function send() {
    const addr = email.trim();
    if (!addr.includes('@')) return Alert.alert('Enter a valid email address.');
    if (!agreed) return Alert.alert('Please agree to the Privacy Policy to continue.');
    setBusy(true);
    const err = await sendLoginCode(addr);
    setBusy(false);
    if (err) return Alert.alert('Could not send code', err);
    setSent(true);
  }

  async function resend() {
    if (resendIn > 0) return;
    setBusy(true);
    const err = await sendLoginCode(email.trim());
    setBusy(false);
    if (err) return Alert.alert('Could not resend code', err);
    setResendIn(RESEND_SECONDS);
    timerRef.current = setInterval(() => {
      setResendIn((s) => (s <= 1 ? (clearInterval(timerRef.current!), 0) : s - 1));
    }, 1000);
  }

  async function verify() {
    setBusy(true);
    const err = await verifyLoginCode(email.trim(), code.trim());
    setBusy(false);
    if (err) return Alert.alert('Invalid code', err);
    // Root layout's auth listener picks up the new session and routes onward.
  }

  return (
    <View style={s.root}>
      <View style={s.videoClip}>
        <VideoView
          player={player}
          style={s.video}
          contentFit="cover"
          nativeControls={false}
          pointerEvents="none"
        />
      </View>
      <StatusBar style="light" />

      {/* Brand title over the scene, top-left */}
      <Text style={[s.brandTitle, isWide && s.brandTitleWide]}>Sleep{'\n'}Early!</Text>

      <KeyboardAvoidingView
        style={[s.flex, isWide && s.wideLayout]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        {/* Floating card — offset from every edge, rounded corners, glowing border */}
        <View style={[s.card, isWide ? s.cardWide : s.cardNarrow]}>
          {sent && (
            <TouchableOpacity onPress={() => { setSent(false); setCode(''); }} style={s.back}>
              <Text style={s.backText}>← Back</Text>
            </TouchableOpacity>
          )}

          {!sent ? (
            <>
              <Text style={s.heading}>Create account</Text>
              <Text style={s.subtitle}>We&apos;ll email you a 6-digit code. No password.</Text>

              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#8A8AA0"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={s.agreeRow}
                onPress={() => setAgreed((a) => !a)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed }}
              >
                <View style={[s.checkbox, agreed && s.checkboxOn]}>
                  {agreed && <Text style={s.checkboxTick}>✓</Text>}
                </View>
                <Text style={s.agreeText}>
                  I agree to the{' '}
                  <Text style={s.link} onPress={() => Linking.openURL(PRIVACY_POLICY_URL || 'https://example.com')}>
                    Privacy Policy
                  </Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.btn} onPress={send} disabled={busy}>
                <Text style={s.btnText}>{busy ? 'Please wait…' : 'Send code'}</Text>
              </TouchableOpacity>

              <Text style={s.switch}>
                Have an account?{' '}
                <Text style={s.link}>Log in</Text>
              </Text>
            </>
          ) : (
            <>
              <Text style={s.heading}>Check your email</Text>
              <Text style={s.subtitle}>Enter the code we sent to {email.trim()}</Text>

              <TextInput
                style={[s.input, s.codeInput]}
                value={code}
                onChangeText={setCode}
                placeholder="6-digit code"
                placeholderTextColor="#8A8AA0"
                keyboardType="number-pad"
                maxLength={8}
                autoFocus
              />

              <TouchableOpacity style={s.btn} onPress={verify} disabled={busy}>
                <Text style={s.btnText}>{busy ? 'Please wait…' : 'Verify & continue'}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={resend} disabled={resendIn > 0}>
                <Text style={s.switch}>
                  {resendIn > 0
                    ? `Resend code in 0:${String(resendIn).padStart(2, '0')}`
                    : 'Resend code'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A15' },
  flex: { flex: 1 },
  videoClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  // Plain full-bleed cover — no extra zoom, so the crop only trims what the
  // aspect-ratio mismatch requires, keeping as much of the original scene visible.
  video: { width: '100%', height: '100%' },

  brandTitle: {
    position: 'absolute',
    top: 40,
    left: 24,
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 38,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  brandTitleWide: { top: 56, left: 56, fontSize: 44, lineHeight: 48 },

  // Card: floats with margin on every side, rounded on all corners, glowing border frame
  card: {
    backgroundColor: 'rgba(15, 15, 25, 0.92)',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(120, 200, 140, 0.85)',
    padding: 40,
    gap: 16,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 12,
  },
  cardNarrow: {
    margin: 16,
    marginBottom: 32,
    alignSelf: 'stretch',
    marginTop: 'auto',
  },
  wideLayout: { justifyContent: 'center' },
  cardWide: {
    width: 600,
    alignSelf: 'flex-end',
    marginRight: 72,
  },

  back: { marginBottom: 4 },
  backText: { color: '#9090B0', fontSize: 14 },
  heading: { color: '#fff', fontSize: 26, fontWeight: '700' },
  subtitle: { color: '#9090B0', fontSize: 14, marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  codeInput: { letterSpacing: 4, fontSize: 20, textAlign: 'center' },
  agreeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#6A6A80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: GREEN, borderColor: GREEN },
  checkboxTick: { color: '#fff', fontSize: 13, fontWeight: '700' },
  agreeText: { color: '#B0B0C0', fontSize: 13, flexShrink: 1 },
  link: { color: GREEN, textDecorationLine: 'underline' },
  btn: { backgroundColor: GREEN, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switch: { color: '#9090B0', fontSize: 13, textAlign: 'center', marginTop: 4 },
});
