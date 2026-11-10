import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { SFSymbol } from 'expo-symbols';

import { MAPS_APP_NAME, type MapsApp } from '@/search/directions';
import {
  APPEARANCE_LABEL,
  APPEARANCE_PREFS,
  minTapTarget,
  radius,
  spacing,
  textStyles,
  useColors,
  type AppearancePref,
} from '@/theme';

import { withTick } from './haptics';
import { Icon } from './Icon';
import { pressStyle } from './press';

/** Controls shared by the Settings tab and its section pages (round 174). */

/**
 * A setting with a switch: the whole row toggles it and VoiceOver reads it
 * as one switch (label, caption as the hint, on or off).
 */
export function SwitchRow({
  label,
  caption,
  hint,
  value,
  onChange,
  divided,
}: {
  label: string;
  caption?: string;
  hint?: string;
  value: boolean;
  onChange: (on: boolean) => void;
  divided?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={hint ?? caption}
      style={pressStyle([styles.row, divided && [styles.divided, { borderTopColor: c.line }]])}>
      <View style={styles.label}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.text }]}>
          {label}
        </Text>
        {caption ? (
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
            {caption}
          </Text>
        ) : null}
      </View>
      {/* The row takes the tap and speaks for it. */}
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Switch value={value} trackColor={{ true: c.accent, false: c.faint }} />
      </View>
    </Pressable>
  );
}

/** Which maps app the leave-by card opens (provisional; John left it open, 2026-10-30). */
export function MapsChoice({ value, onChange }: { value: MapsApp; onChange: (app: MapsApp) => void }) {
  const c = useColors();
  return (
    <View style={[styles.divided, styles.maps, { borderTopColor: c.line }]}>
      <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.text }]}>
        Directions open in
      </Text>
      <Segments
        label="Directions open in"
        options={['apple', 'google'] as const}
        value={value}
        name={(app) => MAPS_APP_NAME[app]}
        onChange={onChange}
      />
      {/* Always shown, so picking doesn't make the layout jump. */}
      <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
        Google Maps opens in Safari if the app isn’t on this iPhone.
      </Text>
    </View>
  );
}

/** Light, Dark or System, as one row of segments (round 173). */
export function AppearanceChoice({ value, onChange }: { value: AppearancePref; onChange: (pref: AppearancePref) => void }) {
  return (
    <Segments
      label="Appearance"
      testID="appearance-choice"
      options={APPEARANCE_PREFS}
      value={value}
      name={(pref) => APPEARANCE_LABEL[pref]}
      onChange={onChange}
    />
  );
}

/** A row of equal segments, the picked one filled blue; VoiceOver reads it as a radio group. */
export function Segments<T extends string>({
  label,
  options,
  value,
  name,
  onChange,
  testID,
}: {
  label: string;
  options: readonly T[];
  value: T;
  name: (v: T) => string;
  onChange: (v: T) => void;
  testID?: string;
}) {
  const c = useColors();
  return (
    <View testID={testID} style={styles.segments} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((opt) => {
        const on = value === opt;
        return (
          <Pressable
            key={opt}
            testID={testID ? `${testID}-${opt}` : undefined}
            onPress={withTick(() => onChange(opt))}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={name(opt)}
            style={pressStyle([styles.segment, { backgroundColor: on ? c.accent : c.surface2 }])}>
            <Text
              style={[textStyles.bodyStrong, { color: on ? c.onAccent : c.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}>
              {name(opt)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A switch row inside a ListGroup card, matching ListRow (icon tile, label, detail), so a setting
 * that's only on or off sits right on the Settings tab instead of a page of its own (round 174).
 */
export function ListSwitchRow({
  label,
  detail,
  icon,
  value,
  onChange,
  testID,
}: {
  label: string;
  detail?: string;
  icon?: SFSymbol;
  value: boolean;
  onChange: (on: boolean) => void;
  testID?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={detail}
      style={({ pressed }) => [styles.listRow, pressed ? { backgroundColor: c.surface2 } : null]}>
      {icon ? <IconTile icon={icon} /> : null}
      <View style={styles.label}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.text }]}>
          {label}
        </Text>
        {detail ? (
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Switch value={value} trackColor={{ true: c.accent, false: c.faint }} />
      </View>
    </Pressable>
  );
}

/** A labelled control (segments) inside a ListGroup card, with the same icon tile as its rows. */
export function ListControlRow({ label, icon, children }: { label: string; icon?: SFSymbol; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.controlRow}>
      <View style={styles.controlHead}>
        {icon ? <IconTile icon={icon} /> : null}
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.text }]}>
          {label}
        </Text>
      </View>
      {children}
    </View>
  );
}

function IconTile({ icon }: { icon: SFSymbol }) {
  const c = useColors();
  return (
    <View style={[styles.iconTile, { backgroundColor: c.surface2 }]}>
      <Icon name={icon} size={15} tintColor={c.text} fallback={null} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.group, minHeight: minTapTarget },
  label: { flex: 1, gap: 2 },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.group },
  maps: { gap: spacing.group },
  segments: { flexDirection: 'row', gap: spacing.group },
  segment: {
    flex: 1,
    minHeight: minTapTarget,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.group,
  },
  // Same box as ListRow (ListGroup.tsx).
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.group,
    minHeight: minTapTarget,
    paddingHorizontal: spacing.rowX,
    paddingVertical: spacing.rowY,
  },
  controlRow: { paddingHorizontal: spacing.rowX, paddingVertical: spacing.rowY, gap: spacing.group },
  controlHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  iconTile: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
});
