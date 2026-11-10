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

describe('round badges (round 161, John)', () => {
  const flat = (st: unknown) => Object.assign({}, ...[st].flat(5).filter(Boolean));
  it('draws every mark as the same circle, logo or not', () => {
    for (const key of ['pk_test', undefined]) {
      let r!: ReturnType<typeof create>;
      act(() => {
        r = create(<AirlineMark airline="DL" size={24} logoKey={key} />);
      });
      const badge = r.root.find((n) => ['airline-logo', 'airline-mark'].includes(n.props.testID) && typeof n.type === 'string');
      const st = flat(badge.props.style);
      expect(st).toMatchObject({ width: 24, height: 24, borderRadius: 12, overflow: 'hidden' });
      expect(st.borderWidth).toBeGreaterThan(0);
    }
  });

  it('fills the circle with the logo, so a square logo reads as a round one', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<AirlineMark airline="DL" size={24} logoKey="pk_test" />);
    });
    const img = r.root.find((n) => n.props.testID === 'logo-image' && typeof n.props.onError === 'function');
    expect(img.props.contentFit).toBe('cover');
    // The white disc always gets the light logo.
    expect(img.props.source.uri).not.toContain('theme=dark');
  });
});
