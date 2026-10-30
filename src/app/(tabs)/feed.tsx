import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { answerText, requestTitle, sampleFeed, type LoadAnswer } from '@/requests/requests';
import { useRequests } from '@/requests/RequestsProvider';
import { forSpeech } from '@/search/format';
import { SCHEDULE_SOURCE } from '@/search/useRouteSearch';
import { EmptyState } from '@/ui/EmptyState';
import { ListGroup, SectionFooter } from '@/ui/ListGroup';
import { ReportSheet } from '@/ui/ReportSheet';
import { RequestRow } from '@/ui/RequestRow';
import { TabScreen } from '@/ui/TabScreen';
import { useSheetContent } from '@/ui/useSheetContent';

/**
 * Request feed (Q-042): asks about your airline’s flights, answered with what
 * you see on the board (DECISIONS.md "Reports and requests"). Until the
 * requests backend exists, it shows example asks on sample flights so the
 * screen looks the way it will (design round 31); answers stay on this screen.
 */
export default function FeedScreen() {
  // Read the clock each time the tab shows, so "asked 12m ago" stays true.
  const [now, setNow] = useState(Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  const asks = useMemo(() => (SCHEDULE_SOURCE === 'live' ? [] : sampleFeed(now)), [now]);
  const { report } = useRequests();
  const [answers, setAnswers] = useState<Record<string, LoadAnswer>>({});
  const [reporting, setReporting] = useState<string | null>(null);
  const sheet = useSheetContent(reporting);
  const sheetFlight = asks.find((r) => r.id === sheet.shown)?.flight ?? null;

  const withAnswers = asks.map((r) => (answers[r.id] ? { ...r, answer: answers[r.id] } : r));
  const open = withAnswers.filter((r) => !r.answer);
  const done = withAnswers.filter((r) => r.answer);

  const submit = (o: number, l: number) => {
    const req = asks.find((r) => r.id === reporting);
    if (!req) return;
    const answer: LoadAnswer = { open: o, listed: l, at: Date.now(), byYou: true };
    setAnswers((a) => ({ ...a, [req.id]: answer }));
    // Your answer is your report on that flight, so Search shows it too.
    report(req.flight, o, l);
    setReporting(null);
    AccessibilityInfo.announceForAccessibility(
      forSpeech(`Answered ${requestTitle(req)}: ${answerText(answer)}`),
    );
  };

  return (
    <TabScreen title="Feed">
      {open.length ? (
        <View style={styles.section}>
          <ListGroup title="Asks on your airline’s flights">
            {open.map((r) => (
              <RequestRow key={r.id} request={r} now={now} onAnswer={() => setReporting(r.id)} />
            ))}
          </ListGroup>
          <SectionFooter>Answer with what you see on the board. Askers only see the numbers, never who answered.</SectionFooter>
        </View>
      ) : (
        <EmptyState
          icon="text.bubble"
          title="No requests right now"
          body="When someone asks about one of your airline’s flights, it shows up here so you can answer with open seats and nonrevs listed."
        />
      )}
      {done.length ? (
        <ListGroup title="You answered">
          {done.map((r) => (
            <RequestRow key={r.id} request={r} now={now} />
          ))}
        </ListGroup>
      ) : null}
      <ReportSheet
        flight={sheetFlight}
        visible={sheet.visible}
        now={now}
        onCancel={() => setReporting(null)}
        onSubmit={submit}
      />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.group },
});
