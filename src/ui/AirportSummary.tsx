import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SFSymbol } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { airportInfo, checkedText, type AirportInfo } from '@/airports/airportInfo';
import { AIRPORTS, placeLabel } from '@/engine';
import { formatTime } from '@/search/format';
import { spacing, textStyles, useColors, radius } from '@/theme';

import { useCardSurface } from './cardSurface';
import { selectionTick } from './haptics';
import { Icon } from './Icon';
import { SheetHeader } from './SheetHeader';
import { useSheetContent } from './useSheetContent';

/** Opens the airport summary for a code; null where no summary is set up. */
const OpenContext = createContext<((code: string) => void) | null>(null);

/** Hold an airport anywhere inside to open its summary (round 174). */
export function AirportSummaryProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<string | null>(null);
  const open = useCallback((c: string) => {
    if (!AIRPORTS[c]) return;
    selectionTick();
    setCode(c);
  }, []);
  return (
    <OpenContext.Provider value={open}>
      {children}
      <AirportSummarySheet code={code} onClose={() => setCode(null)} />
    </OpenContext.Provider>
  );
}

/** The opener, or null outside a provider (tests, previews). */
export function useOpenAirportSummary(): ((code: string) => void) | null {
  return useContext(OpenContext);
}

/** Props to spread on an airport's pill so holding it opens the summary, with a VoiceOver action to match. */
export function useAirportHold(code: string | null | undefined) {
  const open = useOpenAirportSummary();
  return useMemo(() => {
    if (!open || !code || !AIRPORTS[code]) return {};
    return {
      onLongPress: () => open(code),
      delayLongPress: 350,
      accessibilityActions: [{ name: 'airportInfo', label: 'Airport info' }],
      onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) => {
        if (e.nativeEvent.actionName === 'airportInfo') open(code);
      },
    };
  }, [open, code]);
}

/**
 * The airport summary: getting there by public transit, when it's open and where the rental cars are.
 * Only checked facts show; anything we couldn't confirm says so.
 */
export function AirportSummarySheet({
  code,
  onClose,
  now = Date.now(),
}: {
  code: string | null;
  onClose: () => void;
  now?: number;
}) {
  const c = useColors();
  const sheet = useSheetContent(code);
  const shown = sheet.shown;
  const airport = shown ? AIRPORTS[shown] : undefined;
  const info = shown ? airportInfo(shown) : null;
  const [clock, setClock] = useState(now);
  useEffect(() => {
    if (code) setClock(Date.now());
  }, [code]);
  const place = shown ? placeLabel(shown) : '';
  return (
    <Modal visible={sheet.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        {airport && shown ? (
          <>
            <SheetHeader
              title={airport.name}
              subtitle={place !== shown ? `${shown} · ${place}` : shown}
              action="Done"
              onAction={onClose}
            />
            <ScrollView contentContainerStyle={styles.body} testID="airport-summary">
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.muted }]} testID="airport-local-time">
                {`Local time ${formatTime(clock, airport.tz)}`}
              </Text>
              <SummaryCard icon="tram.fill" title="Public transit" testID="airport-transit">
                {info?.transit?.length ? (
                  info.transit.map((t) => (
                    <View key={t.name} style={styles.line}>
                      <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, { color: c.text }]}>
                        {t.name}
                      </Text>
                      <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
                        {t.detail}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Missing info={info} />
                )}
              </SummaryCard>
              <SummaryCard icon="clock.fill" title="Hours" testID="airport-hours">
                {info?.hours ? (
                  <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.text }]}>
                    {info.hours}
                  </Text>
                ) : (
                  <Missing info={info} />
                )}
              </SummaryCard>
              <SummaryCard icon="car.fill" title="Rental cars" testID="airport-rental">
                {info?.rentalCars ? (
                  <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.text }]}>
                    {info.rentalCars}
                  </Text>
                ) : (
                  <Missing info={info} />
                )}
              </SummaryCard>
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]} testID="airport-checked">
                {info
                  ? `From the airport’s and transit agencies’ own sites, checked ${checkedText(info.checked)}. Things change, so check before you go.`
                  : 'We haven’t added this airport’s details yet.'}
              </Text>
            </ScrollView>
          </>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

function SummaryCard({ icon, title, children, testID }: { icon: SFSymbol; title: string; children: ReactNode; testID?: string }) {
  const c = useColors();
  const card = useCardSurface();
  return (
    <View style={[card, styles.card]} testID={testID}>
      <View style={styles.cardHead}>
        <View style={[styles.iconTile, { backgroundColor: c.accentSoft }]}>
          <Icon name={icon} size={16} tintColor={c.accent} fallback={null} />
        </View>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: c.text }]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function Missing({ info }: { info: AirportInfo | null }) {
  const c = useColors();
  return (
    <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.muted }]}>
      {info ? 'Couldn’t confirm this one yet' : 'Not added yet'}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page },
  body: { gap: spacing.section, paddingBottom: spacing.page },
  card: { padding: spacing.rowX, gap: spacing.group },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  iconTile: { width: 28, height: 28, borderRadius: radius.all, alignItems: 'center', justifyContent: 'center' },
  line: { gap: 1 },
});
