import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseBoardingPass, type PassLeg } from '@/logbook/bcbp';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { pressStyle } from './press';

/** Every barcode kind boarding passes use. */
export const PASS_BARCODES = ['pdf417', 'aztec', 'qr', 'datamatrix'] as const;

export interface PassScannerProps {
  visible: boolean;
  now: number;
  onScanned: (legs: PassLeg[]) => void;
  onClose: () => void;
}

/**
 * Full-screen camera that reads a boarding pass barcode, paper or on a
 * screen. Only the flight is kept (see bcbp.ts); nothing is sent anywhere.
 */
export function PassScanner({ visible, now, onScanned, onClose }: PassScannerProps) {
  const c = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [wrong, setWrong] = useState(false);
  // The camera reports the same code many times a second; read each one once.
  const seen = useRef<string | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (!visible) return;
    seen.current = null;
    done.current = false;
    setWrong(false);
  }, [visible]);

  const onBarcode = ({ data }: BarcodeScanningResult) => {
    if (done.current || data === seen.current) return;
    seen.current = data;
    const legs = parseBoardingPass(data, now);
    if (!legs) {
      setWrong(true);
      return;
    }
    done.current = true;
    onScanned(legs);
  };

  const close = () => onClose();

  let body;
  if (!permission) body = null;
  else if (!permission.granted) {
    body = (
      <View style={styles.ask}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, styles.center, { color: c.text }]}>
          Camera is off for OutBound
        </Text>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, styles.center, { color: c.muted }]}>
          It reads the barcode on your boarding pass. Nothing is saved but the flight.
        </Text>
        {permission.canAskAgain ? (
          <Button label="Allow Camera" icon="camera" onPress={() => requestPermission()} />
        ) : (
          <Button label="Open Settings" icon="gear" onPress={() => Linking.openSettings()} />
        )}
      </View>
    );
  } else {
    body = (
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...PASS_BARCODES] }}
          onBarcodeScanned={visible ? onBarcode : undefined}
        />
        <View style={styles.overlay} pointerEvents="none">
          <View style={[styles.frame, { borderColor: '#ffffff' }]} />
          <View style={styles.hint}>
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, styles.center, styles.hintText]} accessibilityLiveRegion="polite">
              {wrong
                ? 'That code isn’t a boarding pass. Try the other barcode on it.'
                : 'Point at the barcode on your boarding pass. A pass on another screen works too.'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <SafeAreaView style={[styles.screen, { backgroundColor: permission?.granted ? '#000000' : c.bg }]} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            testID="scanner-cancel"
            style={pressStyle(styles.cancel, 'link')}>
            <Text style={[textStyles.heading, { color: permission?.granted ? '#ffffff' : c.accent }]}>Cancel</Text>
          </Pressable>
          <Text
            style={[textStyles.heading, styles.title, { color: permission?.granted ? '#ffffff' : c.text }]}
            accessibilityRole="header">
            Scan Boarding Pass
          </Text>
        </View>
        {body}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.page, minHeight: minTapTarget },
  cancel: { minHeight: minTapTarget, justifyContent: 'center', zIndex: 1 },
  title: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  ask: { flex: 1, justifyContent: 'center', gap: spacing.section, padding: spacing.page * 2 },
  center: { textAlign: 'center' },
  cameraWrap: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: spacing.page * 2 },
  frame: { width: '100%', aspectRatio: 1.6, borderWidth: 3, borderRadius: radius.md },
  hint: {
    marginTop: spacing.page * 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.group,
  },
  hintText: { color: '#ffffff' },
});
