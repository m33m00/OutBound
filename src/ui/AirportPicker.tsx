import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Airport } from '@/engine';
import { matchAirports } from '@/search/airports';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { pressStyle } from './press';

export interface AirportPickerProps {
  visible: boolean;
  title: string;
  onPick: (code: string) => void;
  onClose: () => void;
}

export function AirportPicker({ visible, title, onPick, onClose }: AirportPickerProps) {
  const c = useColors();
  const [query, setQuery] = useState('');
  const results = matchAirports(query);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={[textStyles.title, { color: c.text }]} accessibilityRole="header">
            {title}
          </Text>
          <Button label="Cancel" kind="secondary" onPress={close} />
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Airport code or city"
          placeholderTextColor={c.faint}
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Search airports"
          style={[styles.input, textStyles.body, { color: c.text, backgroundColor: c.surface, borderColor: c.line }]}
        />
        <FlatList
          data={results}
          keyExtractor={(a) => a.code}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }: { item: Airport }) => (
            <Pressable
              onPress={() => {
                setQuery('');
                onPick(item.code);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${item.code}, ${item.name}`}
              style={pressStyle([styles.item, { borderColor: c.line }])}>
              <Text style={[textStyles.number, styles.code, { color: c.text }]}>{item.code}</Text>
              <Text style={[textStyles.body, { color: c.muted }]}>{item.name}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={[textStyles.body, styles.empty, { color: c.muted }]}>
              No airports match “{query.trim()}”.
            </Text>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.section,
  },
  input: {
    minHeight: minTapTarget,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.rowX,
    marginBottom: spacing.section,
  },
  item: {
    minHeight: minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.section,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.rowY,
  },
  code: { width: 52 },
  empty: { paddingVertical: spacing.page },
});
