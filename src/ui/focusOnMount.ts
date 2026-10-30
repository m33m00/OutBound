import { useEffect, useRef, type ComponentRef } from 'react';
import { AccessibilityInfo, findNodeHandle, type Text } from 'react-native';

/** Ref for a Text; when `active` turns on, VoiceOver moves to it (once the page has drawn). */
export function useFocusOnMount(active: boolean) {
  const ref = useRef<ComponentRef<typeof Text>>(null);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      const node = ref.current ? findNodeHandle(ref.current) : null;
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 150);
    return () => clearTimeout(t);
  }, [active]);
  return ref;
}
