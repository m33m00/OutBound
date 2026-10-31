import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, AccessibilityInfo, StyleSheet, View } from 'react-native';

import { logbookHighlights, logbookMonths, logbookTotals, type LoggedFlight } from '@/logbook/logbook';
import { useLogbook } from '@/logbook/LogbookProvider';
import { spacing } from '@/theme';
import { AddFlightSheet } from '@/ui/AddFlightSheet';
import { Button } from '@/ui/Buttons';
import { EmptyState } from '@/ui/EmptyState';
import { selectionTick } from '@/ui/haptics';
import { ListGroup, SectionFooter } from '@/ui/ListGroup';
import { LoggedFlightRow } from '@/ui/LoggedFlightRow';
import { LogbookTotalsCard } from '@/ui/LogbookTotalsCard';
import { TabScreen } from '@/ui/TabScreen';

/**
 * Logbook (John 2026-10-30, option A): flights you've taken, with totals up
 * top (flights, miles, airports) and the list by month. Kept on this phone.
 * A map of where you've been can follow later.
 */
export default function LogbookScreen() {
  const { flights, loaded, add, remove, replace } = useLogbook();
  const [adding, setAdding] = useState(false);
  // A logged flight opened to fix its details (round 61).
  const [editing, setEditing] = useState<LoggedFlight | null>(null);
  // Read the clock each time the tab shows, so "Today" turns into "Yesterday" overnight.
  const [now, setNow] = useState(Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  const months = logbookMonths(flights);

  const confirmRemove = (f: LoggedFlight) =>
    Alert.alert(`Remove ${f.from} → ${f.to}?`, 'It comes off your logbook on this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove(f.id) },
    ]);

  const sheet = (
    <AddFlightSheet
      visible={adding || editing != null}
      now={now}
      editing={editing}
      has={(id) => flights.some((f) => f.id === id)}
      onClose={() => {
        setAdding(false);
        setEditing(null);
      }}
      onAdd={(added) => {
        if (editing) replace(editing.id, added[0]);
        else add(added);
        setAdding(false);
        setEditing(null);
        selectionTick();
        AccessibilityInfo.announceForAccessibility(
          editing ? 'Flight saved' : added.length > 1 ? `Added ${added.length} flights` : 'Flight added',
        );
      }}
    />
  );
  const addButton = (kind: 'primary' | 'secondary') => (
    <Button label="Add Flight" icon="plus" kind={kind} onPress={() => setAdding(true)} style={styles.add} />
  );

  if (!flights.length) {
    return (
      <TabScreen title="Logbook">
        {loaded ? (
          <EmptyState
            icon="book.closed"
            title="No flights logged yet"
            body="Keep a record of where you’ve flown, with your totals up top."
            points={['Scan the barcode on your boarding pass', 'Or pick a screenshot of one', 'Or type the flight in']}
            action={addButton('primary')}
          />
        ) : null}
        {sheet}
      </TabScreen>
    );
  }

  return (
    <TabScreen title="Logbook">
      <LogbookTotalsCard totals={logbookTotals(flights)} highlights={logbookHighlights(flights)} />
      {addButton('primary')}
      {months.map((m) => (
        <View key={m.title} style={styles.section}>
          <ListGroup title={m.title}>
            {m.flights.map((f) => (
              <LoggedFlightRow key={f.id} flight={f} now={now} onEdit={() => setEditing(f)} onRemove={() => confirmRemove(f)} />
            ))}
          </ListGroup>
        </View>
      ))}
      <SectionFooter>Your logbook stays on this phone.</SectionFooter>
      {sheet}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.group },
  add: { alignSelf: 'stretch' },
});
