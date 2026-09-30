/**
 * TimePicker.tsx — Minimal inline HH:MM spinner for React Native.
 * No extra packages required. Renders two scroll-wheel columns (hour / minute).
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 3; // items shown in the picker window

interface Props {
  hour: number;    // 0-23
  minute: number;  // 0 or 30
  onChange: (hour: number, minute: number) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export default function TimePicker({ hour, minute, onChange }: Props) {
  const hourRef = useRef<ScrollView>(null);
  const minRef  = useRef<ScrollView>(null);

  // Scroll to selected value on mount / when controlled value changes externally
  useEffect(() => {
    hourRef.current?.scrollTo({ y: hour * ITEM_HEIGHT, animated: false });
  }, [hour]);

  useEffect(() => {
    const minIndex = MINUTES.indexOf(minute);
    minRef.current?.scrollTo({ y: (minIndex >= 0 ? minIndex : 0) * ITEM_HEIGHT, animated: false });
  }, [minute]);

  function onHourScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(23, index));
    if (clamped !== hour) onChange(clamped, minute);
  }

  function onMinuteScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(MINUTES.length - 1, index));
    if (MINUTES[clamped] !== minute) onChange(hour, MINUTES[clamped]);
  }

  const pickerHeight = ITEM_HEIGHT * VISIBLE_ITEMS;

  return (
    <View style={styles.wrapper}>
      {/* Hour column */}
      <View style={[styles.column, { height: pickerHeight }]}>
        <ScrollView
          ref={hourRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={onHourScroll}
          contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        >
          {HOURS.map((h) => (
            <View key={h} style={styles.item}>
              <Text style={[styles.itemText, h === hour && styles.selectedText]}>
                {String(h).padStart(2, '0')}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <Text style={styles.colon}>:</Text>

      {/* Minute column */}
      <View style={[styles.column, { height: pickerHeight }]}>
        <ScrollView
          ref={minRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={onMinuteScroll}
          contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        >
          {MINUTES.map((m) => (
            <View key={m} style={styles.item}>
              <Text style={[styles.itemText, m === minute && styles.selectedText]}>
                {String(m).padStart(2, '0')}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Selection highlight overlay */}
      <View style={[styles.selectionBar, { top: ITEM_HEIGHT }]} pointerEvents="none" />
    </View>
  );
}

// Quick ± button variant used inline on the onboarding card
interface QuickPickerProps {
  label: string;
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
}

export function QuickTimePicker({ label, hour, minute, onHourChange, onMinuteChange }: QuickPickerProps) {
  function fmt(h: number, m: number) {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
  }

  return (
    <View style={q.container}>
      <Text style={q.label}>{label}</Text>
      <View style={q.row}>
        {/* Hour */}
        <TouchableOpacity onPress={() => onHourChange((hour + 23) % 24)} style={q.btn}>
          <Text style={q.arrow}>‹</Text>
        </TouchableOpacity>
        <Text style={q.time}>{fmt(hour, minute)}</Text>
        <TouchableOpacity onPress={() => onHourChange((hour + 1) % 24)} style={q.btn}>
          <Text style={q.arrow}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={q.minRow}>
        {[0, 15, 30, 45].map((m) => (
          <TouchableOpacity
            key={m}
            style={[q.minChip, minute === m && q.minChipActive]}
            onPress={() => onMinuteChange(m)}
          >
            <Text style={[q.minText, minute === m && q.minTextActive]}>
              :{String(m).padStart(2, '0')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  column: {
    width: 56,
    overflow: 'hidden',
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 22,
    color: '#555',
    fontWeight: '500',
  },
  selectedText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
  },
  colon: {
    fontSize: 28,
    color: '#fff',
    marginHorizontal: 4,
    fontWeight: '700',
  },
  selectionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#5ba37144',
    borderRadius: 8,
  },
});

const q = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#2E2E4E',
  },
  label: {
    color: '#9090B0',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2A3E',
    borderRadius: 20,
  },
  arrow: {
    color: '#5ba371',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  time: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 1,
    minWidth: 120,
    textAlign: 'center',
  },
  minRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  minChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#2A2A3E',
  },
  minChipActive: {
    backgroundColor: '#5ba371',
  },
  minText: {
    color: '#777',
    fontSize: 13,
    fontWeight: '600',
  },
  minTextActive: {
    color: '#fff',
  },
});
