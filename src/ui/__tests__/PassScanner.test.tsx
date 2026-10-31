import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { PassScanner } from '../PassScanner';

let mockGranted = true;
jest.mock('expo-camera', () => ({
  CameraView: (props: object) => {
    const { View } = require('react-native');
    return <View testID="camera" {...props} />;
  },
  useCameraPermissions: () => [{ granted: mockGranted, canAskAgain: false }, jest.fn()],
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 30, 18);
const PASS = `M1${'YAGER/JOHN'.padEnd(20)}EABC123 DFWLAXAA 1234 303Y012C0025 100`;

describe('PassScanner', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
    mockGranted = true;
  });

  const texts = () =>
    r!.root.findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string').map((n) => n.props.children as string);

  it('reads a pass once, and says when a code isn’t one', async () => {
    const onScanned = jest.fn();
    await act(async () => {
      r = create(<PassScanner visible now={NOW} onScanned={onScanned} onClose={() => {}} />);
    });
    const camera = () => r!.root.findByProps({ testID: 'camera' });
    expect(camera().props.barcodeScannerSettings.barcodeTypes).toEqual(['pdf417', 'aztec', 'qr', 'datamatrix']);
    act(() => camera().props.onBarcodeScanned({ data: 'https://example.com' }));
    expect(texts()).toContain('That code isn’t a boarding pass. Try the other barcode on it.');
    act(() => camera().props.onBarcodeScanned({ data: PASS }));
    act(() => camera().props.onBarcodeScanned({ data: PASS }));
    expect(onScanned).toHaveBeenCalledTimes(1);
    expect(onScanned.mock.calls[0][0]).toEqual([
      { airline: 'AA', flightNumber: '1234', from: 'DFW', to: 'LAX', date: '2026-10-30', seat: '12C' },
    ]);
  });

  it('points to Settings when the camera is off', async () => {
    mockGranted = false;
    await act(async () => {
      r = create(<PassScanner visible now={NOW} onScanned={() => {}} onClose={() => {}} />);
    });
    expect(texts()).toEqual(expect.arrayContaining(['Camera is off for OutBound', 'Open Settings']));
  });
});
