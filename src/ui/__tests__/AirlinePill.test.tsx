import { act, create } from 'react-test-renderer';

import { AirlineMark, airlineLogoUrl, logosOn } from '../AirlinePill';

jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: (props: object) => <View {...props} testID="logo-image" /> };
});

describe('real airline logos (round 133)', () => {
  it('builds a Logo.dev address from the airline domain only when a key is set', () => {
    expect(airlineLogoUrl('WN', 16, undefined)).toBeNull();
    expect(airlineLogoUrl('ZZ', 16, 'pk_test')).toBeNull();
    const url = airlineLogoUrl('WN', 16, 'pk_test')!;
    expect(url.startsWith('https://img.logo.dev/southwest.com?')).toBe(true);
    expect(url).toContain('token=pk_test');
    expect(url).toContain('size=32');
    expect(url).toContain('fallback=404');
    expect(logosOn(undefined)).toBe(false);
    expect(logosOn('pk_test')).toBe(true);
  });

  it('keeps the tail mark when logos are off', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<AirlineMark airline="AA" size={16} logoKey={undefined} />);
    });
    expect(r.root.findAll((n) => n.props.testID === 'airline-mark' && typeof n.type === 'string')).toHaveLength(1);
    expect(r.root.findAll((n) => n.props.testID === 'logo-image')).toHaveLength(0);
  });

  it('shows the logo with a key, and falls back to the tail if it fails to load', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<AirlineMark airline="DL" size={16} logoKey="pk_test" />);
    });
    const img = r.root.find((n) => n.props.testID === 'logo-image' && typeof n.props.onError === 'function');
    expect(img.props.source.uri).toContain('delta.com');
    act(() => img.props.onError());
    expect(r.root.findAll((n) => n.props.testID === 'logo-image')).toHaveLength(0);
    expect(r.root.findAll((n) => n.props.testID === 'airline-mark' && typeof n.type === 'string')).toHaveLength(1);
  });
});
