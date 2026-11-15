import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { radius, useColors, useColorSchemeName } from '@/theme';

/**
 * Glass (round 211, John: "Less containers where you think it's necessary. More glassy look where containers
 * exist"). Where a box stays, it's iOS's own Liquid Glass: the page shows through, softly blurred, with a light
 * edge. Reduce Transparency in iOS settings turns it back into a solid card, and a phone without Liquid Glass
 * gets a see-through card that looks the same at rest.
 */

/** iOS's Reduce Transparency switch, kept up to date while the app is open. */
export function useReduceTransparency(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((v) => live && setOn(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', (v: boolean) => setOn(v));
    return () => {
      live = false;
      sub?.remove();
    };
  }, []);
  return on;
}

function liquidGlassHere(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

/** True when this phone draws real Liquid Glass and the person hasn't asked for less transparency. */
export function useLiquidGlass(): boolean {
  const reduced = useReduceTransparency();
  return !reduced && liquidGlassHere();
}

/**
 * The card's fill where there's no Liquid Glass: see-through so whatever sits behind (the map, a picture)
 * shows a little, solid with Reduce Transparency on.
 */
export function useGlassFill(): Pick<ViewStyle, 'backgroundColor' | 'borderColor' | 'borderWidth'> {
  const c = useColors();
  const dark = useColorSchemeName() === 'dark';
  const reduced = useReduceTransparency();
  if (reduced) return { backgroundColor: c.surface, borderColor: c.cardEdge, borderWidth: dark ? StyleSheet.hairlineWidth : 0 };
  return dark
    ? { backgroundColor: 'rgba(40,40,44,0.72)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: StyleSheet.hairlineWidth }
    : { backgroundColor: 'rgba(255,255,255,0.78)', borderColor: 'rgba(255,255,255,0.9)', borderWidth: 0 };
}

type GlassProps = ViewProps & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** A bar that runs edge to edge (the tab bar, a pinned button bar): square corners, no lift. */
  bar?: boolean;
};

/**
 * A box drawn in glass. Takes the same style as the View it replaces; its corners are the app's one radius
 * unless `bar`.
 */
export function Glass({ style, children, bar = false, ...rest }: GlassProps) {
  const c = useColors();
  const scheme = useColorSchemeName();
  const liquid = useLiquidGlass();
  const fill = useGlassFill();
  const shape: ViewStyle = { borderRadius: bar ? 0 : radius.all };
  const lift: ViewStyle | null =
    bar || scheme === 'dark'
      ? null
      : { shadowColor: c.text, shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } };
  if (liquid) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme={scheme} style={[shape, lift, style]} testID="glass" {...rest}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[shape, fill, lift, style]} {...rest}>
      {children}
    </View>
  );
}

/** The neutral layer over a glass bar, per scheme (round 213, John: "Fix all of them"). */
export const BACKDROP_VEIL = { light: 'rgba(246,246,248,0.62)', dark: 'rgba(30,30,33,0.55)' } as const;

/**
 * The fill for a box that sits on a glass sheet (the date chips, From and To on Home): a lighter pane of the
 * same glass rather than a flat gray or white card (round 213). Without Liquid Glass the sheet is solid, so
 * the box takes the usual quiet gray.
 */
export function useGlassWell(): string {
  const c = useColors();
  const dark = useColorSchemeName() === 'dark';
  const liquid = useLiquidGlass();
  if (!liquid) return c.surface2;
  return dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.6)';
}

/**
 * Glass laid behind something that has its own shape and motion (a sheet, the tab bar, a pinned bar): fills its
 * parent. Without Liquid Glass it's the plain solid surface, since a see-through bar over the map without the
 * blur would make its words harder to read.
 */
export function GlassBackdrop({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const scheme = useColorSchemeName();
  const liquid = useLiquidGlass();
  if (liquid) {
    return (
      <>
        <GlassView
          glassEffectStyle="regular"
          colorScheme={scheme}
          style={[StyleSheet.absoluteFill, style]}
          pointerEvents="none"
          testID="glass-backdrop"
        />
        {/* A soft neutral veil (round 213): the map and radar showed through as a blotchy blue, and every bar
            got a different tint. With it the sheet, the tab bar and the pinned bars all read the same even gray. */}
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: BACKDROP_VEIL[scheme] }, style]}
          pointerEvents="none"
          testID="glass-veil"
        />
      </>
    );
  }
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: c.surface }, style]} pointerEvents="none" />;
}
