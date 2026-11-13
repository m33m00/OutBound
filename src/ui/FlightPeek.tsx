import { type ComponentRef, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { fonts, radius, textStyles, useColors } from '@/theme';

import { AIRLINE_MARKS, AirlineMark, airlineName } from './AirlinePill';
import { selectionTick } from './haptics';
import { useReducedMotion } from './useReducedMotion';

/** The logo's size on a result ticket. */
export const PEEK_LOGO = 24;
/** The little window's width, centred over the logo where the screen allows. */
const PEEK_W = 180;
/** Gap between the logo and the window above it. */
const PEEK_GAP = 6;
/** Keeps the window off the screen's edges. */
const EDGE = 8;

/**
 * A leg's airline on a result ticket as just its logo, no tile and no flight number (round 156, John: "The
 * flight summary page should only be Airline logos and transparent backgrounds not squares. No flight
 * number is needed. If a user selects the Airline logo it pulls up Flight Number Aircraft Type ... a mini
 * window where you hold or click to view and click anywhere else to dismiss"). A tap or a hold opens a
 * small window over the logo with the flight number and the aircraft type; a tap anywhere else closes it.
 * An airline we have no logo for shows its code instead.
 */
export function FlightPeek({
  airline,
  number,
  aircraft,
  size = PEEK_LOGO,
}: {
  airline: string;
  number: string;
  aircraft?: string | null;
  /** The logo's size: the ticket's by default, a little bigger on the opened route (round 158). */
  size?: number;
}) {
  const c = useColors();
  const reduce = useReducedMotion();
  const win = useWindowDimensions();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  // Open as soon as it's pressed; where the logo sits arrives a moment later, and the window stays
  // invisible until then so it never flashes in the wrong place.
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const known = !!AIRLINE_MARKS[airline];
  const show = () => {
    selectionTick();
    setAt(null);
    setOpen(true);
    anchor.current?.measureInWindow?.((x: number, y: number, w: number) => setAt({ x: x + w / 2, y }));
  };
  const close = () => setOpen(false);
  const left = at ? Math.min(Math.max(EDGE, at.x - PEEK_W / 2), win.width - PEEK_W - EDGE) : 0;
  return (
    <>
      <View ref={anchor} collapsable={false}>
        <Pressable
          onPress={show}
          onLongPress={show}
          delayLongPress={250}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${airlineName(airline)} ${number}${aircraft ? `, ${aircraft}` : ''}`}
          accessibilityHint="Shows the flight number and aircraft"
          style={({ pressed }) => [styles.logo, { minWidth: size, height: size }, pressed && { opacity: 0.6 }]}
          testID="flight-peek-logo">
          {known ? (
            <AirlineMark airline={airline} size={size} bare />
          ) : (
            <Text style={[styles.code, { color: c.text }]} maxFontSizeMultiplier={1.2}>
              {airline}
            </Text>
          )}
        </Pressable>
      </View>
      <Modal visible={open} transparent statusBarTranslucent animationType={reduce ? 'none' : 'fade'} onRequestClose={close}>
        {/* Anywhere else on the screen closes it. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" testID="flight-peek-backdrop" />
        {open ? (
          <View
            pointerEvents="box-none"
            style={[styles.peekSlot, at ? { left, bottom: win.height - at.y + PEEK_GAP } : styles.unplaced]}
            testID="flight-peek">
            <Pressable
              onPress={close}
              style={[styles.peek, { backgroundColor: c.surface, borderColor: c.cardEdge, shadowColor: '#000' }]}
              accessibilityRole="text"
              accessibilityLabel={`${airlineName(airline)} ${number}${aircraft ? `, ${aircraft}` : ''}`}>
              <View style={styles.peekTop}>
                {known ? <AirlineMark airline={airline} size={20} bare /> : null}
                <Text style={[styles.number, { color: c.text }]} maxFontSizeMultiplier={1.3} testID="flight-peek-number">
                  {`${airline} ${number}`}
                </Text>
              </View>
              {aircraft ? (
                <Text style={[textStyles.small, { color: c.muted }]} maxFontSizeMultiplier={1.3} testID="flight-peek-aircraft">
                  {aircraft}
                </Text>
              ) : null}
            </Pressable>
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  logo: { minWidth: PEEK_LOGO, height: PEEK_LOGO, alignItems: 'center', justifyContent: 'center' },
  code: { fontFamily: fonts.monoMedium, fontSize: 13, lineHeight: 18 },
  peekSlot: { position: 'absolute', width: PEEK_W, alignItems: 'center' },
  unplaced: { opacity: 0, left: 0, top: 0 },
  peek: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.all,
    borderWidth: 1,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  peekTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  number: { fontFamily: fonts.monoMedium, fontSize: 15, lineHeight: 20 },
});
