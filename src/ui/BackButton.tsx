import { PillButton } from './Buttons';

/**
 * Back: a soft capsule with a chevron and the word (design round 5; a real button shape since
 * round 79, John 2026-11-01). With no word (tight widths) it's a round chevron button.
 */
export function BackButton({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <PillButton
      label={label}
      leading="chevron.left"
      fallback="‹"
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={{ left: 8 }}
      style={{ alignSelf: 'flex-start' }}
    />
  );
}
