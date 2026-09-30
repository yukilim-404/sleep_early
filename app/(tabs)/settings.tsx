import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Share,
  Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { QuickTimePicker } from '@/src/components/TimePicker';
import { getProfile, saveProfile, getLogs, deleteSeedLogs } from '@/src/lib/dataStore';
import { supabase } from '@/src/lib/supabase';
import { getCurrentEmail, signOut } from '@/src/lib/auth';
import { setDemoMode } from '@/src/lib/demoMode';
import {
  getNotifPrefs,
  saveNotifPrefs,
  scheduleReminders,
  cancelReminders,
  requestNotificationPermissions,
  getPermissionStatus,
  type NotifPrefs,
  type PermissionStatus,
} from '@/src/lib/notifications';
import { PRIVACY_POLICY_URL } from '@/constants/links';
import type { Profile, Workday } from '@/src/lib/types';

const PURPLE = '#5ba371';
const DAYS: { id: Workday; label: string }[] = [
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' },
  { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
];

const hm = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return { h, m: m ?? 0 };
};
const toTime = (h: number, m: number) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;

export default function SettingsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bed, setBed] = useState({ h: 23, m: 0 });
  const [wake, setWake] = useState({ h: 7, m: 0 });
  const [workdays, setWorkdays] = useState<Workday[]>([]);
  const [prefs, setPrefs] = useState<NotifPrefs>({ winddown: true, lastcall: true, morning: true });
  const [perm, setPerm] = useState<PermissionStatus>('undetermined');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, np, ps, em] = await Promise.all([
      getProfile(),
      getNotifPrefs(),
      getPermissionStatus(),
      getCurrentEmail(),
    ]);
    setPrefs(np);
    setPerm(ps);
    setEmail(em);
    if (p) {
      setProfile(p);
      setBed(hm(p.target_bedtime));
      setWake(hm(p.wake_time));
      setWorkdays(p.workdays);
    }
    return p;
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function saveSchedule() {
    if (!profile) return;
    setBusy(true);
    const saved = await saveProfile({
      target_bedtime: toTime(bed.h, bed.m),
      wake_time: toTime(wake.h, wake.m),
      workdays,
      timezone: profile.timezone,
      baseline_barriers: profile.baseline_barriers,
    });
    setBusy(false);
    if (!saved) {
      Alert.alert('Save failed', 'Check your connection and try again.');
      return;
    }
    setProfile(saved);
    await scheduleReminders(saved.target_bedtime, saved.wake_time);
    Alert.alert('Saved', 'Your schedule and reminders are updated.');
  }

  async function togglePref(key: keyof NotifPrefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    await saveNotifPrefs(next);
    if (value && perm !== 'granted') setPerm(await requestNotificationPermissions());
    if (profile) await scheduleReminders(profile.target_bedtime, profile.wake_time);
  }

  async function exportData() {
    const [p, logs] = await Promise.all([getProfile(), getLogs(1000)]);
    await Share.share({ message: JSON.stringify({ profile: p, sleep_logs: logs }, null, 2) });
  }

  function clearDemo() {
    Alert.alert('Clear demo data?', 'Removes sample nights only. Your own logs are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        onPress: async () => {
          await setDemoMode(false);
          const ok = await deleteSeedLogs();
          Alert.alert(ok ? 'Done' : 'Failed', ok ? 'Demo data removed.' : 'Try again later.');
        },
      },
    ]);
  }

  function deleteAccount() {
    Alert.alert(
      'Delete account & data?',
      'This permanently deletes your profile and all sleep logs. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const { error } = await supabase.functions.invoke('delete-account');
            if (error) {
              setBusy(false);
              Alert.alert('Could not delete', 'Check your connection and try again.');
              return;
            }
            await cancelReminders();
            await AsyncStorage.clear();
            await signOut(); // root layout's auth listener switches to /login automatically
            setBusy(false);
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.scroll}>
      <StatusBar style="light" />

      <Text style={s.section}>Sleep schedule</Text>
      <View style={s.card}>
        <QuickTimePicker
          label="Target bedtime"
          hour={bed.h}
          minute={bed.m}
          onHourChange={(h) => setBed((b) => ({ ...b, h }))}
          onMinuteChange={(m) => setBed((b) => ({ ...b, m }))}
        />
        <QuickTimePicker
          label="Wake time"
          hour={wake.h}
          minute={wake.m}
          onHourChange={(h) => setWake((w) => ({ ...w, h }))}
          onMinuteChange={(m) => setWake((w) => ({ ...w, m }))}
        />
        <View style={s.chips}>
          {DAYS.map((d) => {
            const on = workdays.includes(d.id);
            return (
              <TouchableOpacity
                key={d.id}
                style={[s.chip, on && s.chipOn]}
                onPress={() =>
                  setWorkdays((w) => (on ? w.filter((x) => x !== d.id) : [...w, d.id]))
                }
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[s.chipText, on && s.chipTextOn]}>{d.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={s.primary} onPress={saveSchedule} disabled={busy || !profile}>
          <Text style={s.primaryText}>{busy ? 'Saving…' : 'Save schedule'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.section}>Reminders</Text>
      <View style={s.card}>
        {perm === 'denied' && (
          <TouchableOpacity onPress={() => Linking.openSettings()}>
            <Text style={s.warn}>Notifications are blocked — tap to open system settings.</Text>
          </TouchableOpacity>
        )}
        {(
          [
            ['winddown', 'Wind-down (2 hours before bed)'],
            ['lastcall', 'Last call (15 minutes before)'],
            ['morning', 'Morning log reminder'],
          ] as const
        ).map(([key, label]) => (
          <View key={key} style={s.row}>
            <Text style={s.rowText}>{label}</Text>
            <Switch
              value={prefs[key]}
              onValueChange={(v) => togglePref(key, v)}
              trackColor={{ true: PURPLE }}
            />
          </View>
        ))}
      </View>

      <Text style={s.section}>Account</Text>
      <View style={s.card}>
        <Text style={s.body}>{email ? `Signed in as ${email}` : 'Signed in'}</Text>
        <TouchableOpacity style={s.link} onPress={async () => { await signOut(); }}>
          <Text style={s.linkText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.section}>Your data</Text>
      <View style={s.card}>
        <TouchableOpacity style={s.link} onPress={exportData}>
          <Text style={s.linkText}>Export my data</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.link} onPress={clearDemo}>
          <Text style={s.linkText}>Clear demo data</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.link} onPress={deleteAccount} disabled={busy}>
          <Text style={[s.linkText, { color: '#E06060' }]}>Delete my account & data</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.section}>About</Text>
      <View style={s.card}>
        <Text style={s.body}>
          Sleep Early! is a habit-support tool, not a medical device, and does not diagnose or treat
          any condition. If you have persistent sleep problems, talk to a doctor.
        </Text>
        {!!PRIVACY_POLICY_URL && (
          <TouchableOpacity style={s.link} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
            <Text style={s.linkText}>Privacy policy</Text>
          </TouchableOpacity>
        )}
        <Text style={s.version}>Version {Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F0F1A' },
  scroll: { padding: 20, paddingBottom: 60, gap: 8 },
  section: { color: '#9090B0', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 16, textTransform: 'uppercase' },
  card: { backgroundColor: '#1E1E2E', borderRadius: 16, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowText: { color: '#fff', fontSize: 15, flex: 1, paddingRight: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#2A2A3E' },
  chipOn: { backgroundColor: PURPLE },
  chipText: { color: '#9090B0', fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  primary: { backgroundColor: PURPLE, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { paddingVertical: 6 },
  linkText: { color: '#fff', fontSize: 15 },
  warn: { color: '#E0A060', fontSize: 13 },
  body: { color: '#9090B0', fontSize: 13, lineHeight: 19 },
  version: { color: '#666', fontSize: 12 },
});
