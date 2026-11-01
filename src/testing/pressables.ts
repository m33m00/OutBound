import { StyleSheet, type ViewStyle } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

/**
 * Test helpers for tappable things. A ScalePressable is an animated wrapper around a Pressable,
 * so both carry the same props in the test tree: keep the outermost of each pair.
 */
export function outermost(nodes: ReactTestInstance[]): ReactTestInstance[] {
  return nodes.filter((n) => !nodes.includes(n.parent as ReactTestInstance));
}

/** A tappable's resting style, whether it's a pressStyle function or a plain or animated style. */
export function restingStyle(n: ReactTestInstance): ViewStyle {
  const raw = typeof n.props.style === 'function' ? n.props.style({ pressed: false }) : n.props.style;
  const flat = { ...(StyleSheet.flatten(raw) as ViewStyle) } as Record<string, unknown>;
  for (const [k, v] of Object.entries(flat)) {
    if (v && typeof v === 'object' && typeof (v as { __getValue?: unknown }).__getValue === 'function') {
      flat[k] = (v as { __getValue: () => unknown }).__getValue();
    }
  }
  return flat as ViewStyle;
}
