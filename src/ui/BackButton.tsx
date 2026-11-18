import { PillButton } from './Buttons';

/**
 * Back: a soft capsule with a chevron and the word (design round 5; a real button shape since
 * round 79, John 2026-11-01). With no word (tight widths) it's a round chevron button.
 */
export function BackButton({
  label,
  onPress,
  accessibilityLabel,
  plain = false,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Just the arrow, no tint behind it, pulled to the page edge (round 215: the results bar's "< Home"). */
  plain?: boolean;
}) {
  return (
    <PillButton
      label={label}
      leading="chevron.left"
      fallback="‹"
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      tone={plain ? 'plain' : 'soft'}
      hitSlop={{ left: 8 }}
      style={[{ alignSelf: 'flex-start' }, plain && { marginLeft: -10 }]}
    />
  );
}
