import { router } from 'expo-router';
import { useState, type ReactNode, type Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts, minTapTarget, radius, spacing, textStyles, useColors, useColorSchemeName } from '@/theme';
import { BackButton } from '@/ui/BackButton';
import { Icon } from '@/ui/Icon';
import { TITLE_MAX_SCALE } from '@/ui/SheetHeader';

/** One account page: Back, a title, an optional line under it, then the form. */
export function AuthScreen({
  title,
  lead,
  children,
  back = true,
}: {
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  back?: boolean;
}) {
  const c = useColors();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {back ? (
          <View style={styles.header}>
            <BackButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />
          </View>
        ) : null}
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text
            lineBreakStrategyIOS="push-out"
            style={[textStyles.title, { color: c.text }]}
            accessibilityRole="header"
            maxFontSizeMultiplier={TITLE_MAX_SCALE}>
            {title}
          </Text>
          {lead ? (
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, styles.lead, { color: c.muted }]}>
              {lead}
            </Text>
          ) : null}
          <View style={styles.form}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** A labeled text box. Passwords get a Show button. */
export function Field({
  label,
  note,
  secret,
  ref,
  ...input
}: { label: string; note?: string; secret?: boolean; ref?: Ref<TextInputInstance> } & TextInputProps) {
  const c = useColors();
  const scheme = useColorSchemeName();
  const [shown, setShown] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={[textStyles.eyebrow, { color: c.muted }]} importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>
      <View style={[styles.inputWrap, { borderColor: c.line2, backgroundColor: c.surface }]}>
        <TextInput
          {...input}
          ref={ref}
          secureTextEntry={secret && !shown}
          autoCorrect={false}
          spellCheck={false}
          keyboardAppearance={scheme}
          placeholderTextColor={c.faint}
          accessibilityLabel={label}
          accessibilityHint={note}
          style={[textStyles.body, styles.input, { color: c.text }]}
        />
        {secret ? (
          <Pressable
            onPress={() => setShown((s) => !s)}
            accessibilityRole="button"
            accessibilityLabel={shown ? 'Hide password' : 'Show password'}
            hitSlop={8}
            style={styles.eye}>
            <Icon
              name={shown ? 'eye.slash' : 'eye'}
              size={18}
              tintColor={c.accent}
              fallback={<Text style={[textStyles.small, { color: c.accent }]}>{shown ? 'Hide' : 'Show'}</Text>}
            />
          </Pressable>
        ) : null}
      </View>
      {note ? (
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/** What went wrong, read out by VoiceOver as soon as it shows. */
export function ErrorLine({ text }: { text: string | null }) {
  const c = useColors();
  if (!text) return null;
  return (
    <View
      style={[styles.error, { backgroundColor: c.canceledBg }]}
      accessibilityLiveRegion="polite"
      accessible
      accessibilityRole="alert">
      <Icon name="exclamationmark.circle.fill" size={16} tintColor={c.canceledFg} fallback={null} />
      <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, styles.errorText, { color: c.canceledFg }]}>
        {text}
      </Text>
    </View>
  );
}

/** A tick box with its sentence, for agreeing to the terms. */
export function CheckRow({
  checked,
  onToggle,
  children,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
  label: string;
}) {
  const c = useColors();
  return (
    <View style={styles.check}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        hitSlop={10}
        style={[styles.box, { borderColor: checked ? c.accent : c.line2, backgroundColor: checked ? c.accent : c.surface }]}>
        {checked ? (
          <Icon
            name="checkmark"
            size={13}
            weight="bold"
            tintColor={c.onAccent}
            fallback={<Text style={{ color: c.onAccent }}>✓</Text>}
          />
        ) : null}
      </Pressable>
      <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, styles.checkText, { color: c.text }]}>
        {children}
      </Text>
    </View>
  );
}

/** Words inside a sentence that open a page: accent, since they can be tapped. */
export function InlineLink({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Text
      onPress={onPress}
      accessibilityRole="link"
      suppressHighlighting={false}
      style={{ fontFamily: fonts.bodySemiBold, color: c.accent }}>
      {label}
    </Text>
  );
}

export const openLegal = (doc: 'privacy' | 'terms') => router.push({ pathname: '/legal/[doc]', params: { doc } });

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: spacing.page, paddingTop: spacing.group, minHeight: minTapTarget },
  body: { padding: spacing.page, gap: spacing.group, paddingBottom: spacing.page * 3 },
  lead: { marginBottom: spacing.group },
  form: { gap: spacing.section + 4, marginTop: spacing.group },
  field: { gap: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.all, minHeight: 48 },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  eye: { paddingHorizontal: 14, minHeight: minTapTarget, justifyContent: 'center' },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.all },
  errorText: { flex: 1 },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.all,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
  },
  checkText: { flex: 1 },
});
