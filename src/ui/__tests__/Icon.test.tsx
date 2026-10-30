import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Platform, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Icon, MATERIAL } from '../Icon';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The real component loads its font file, which jest can't; keep the real glyph names.
jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const glyphMap = jest.requireActual('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json');
  const MaterialIcon = (props: object) => jest.requireActual('react').createElement('MaterialIcon', props);
  MaterialIcon.glyphMap = glyphMap;
  return { __esModule: true, default: MaterialIcon };
});

function withOS(os: typeof Platform.OS, run: () => void) {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  try {
    run();
  } finally {
    Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
  }
}

describe('Icon', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('draws a Material icon on Android for a mapped symbol', () => {
    withOS('android', () => {
      act(() => {
        r = create(<Icon name="magnifyingglass" size={20} tintColor="#123456" fallback={<Text>x</Text>} />);
      });
    });
    const glyph = r!.root.findAll((n) => n.props.name === 'search');
    expect(glyph.length).toBeGreaterThan(0);
    expect(glyph[0].props.color).toBe('#123456');
  });

  it('shows the fallback on Android when there is no match', () => {
    withOS('android', () => {
      act(() => {
        r = create(<Icon name="star.fill" fallback={<Text>Star</Text>} />);
      });
    });
    expect(r!.root.findAllByType(Text).map((t) => t.props.children)).toContain('Star');
  });

  it('maps the tab bar, buttons and empty states to real Material glyphs', () => {
    for (const name of ['magnifyingglass', 'text.bubble', 'suitcase', 'person.crop.circle', 'chevron.left', 'chevron.right', 'plus'] as const) {
      expect(MATERIAL[name]).toBeDefined();
    }
    for (const glyph of Object.values(MATERIAL)) expect(glyph! in MaterialIcons.glyphMap).toBe(true);
  });
});
