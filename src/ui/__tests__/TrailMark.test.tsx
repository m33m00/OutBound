import { Text, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { colors } from '@/theme';

import { SectionHeader } from '../ListGroup';
import { MetaLine } from '../MetaLine';
import { marketArrows, RouteText, trailMarkSize } from '../TrailMark';

// Round 209 (John): "Instead of a slanted trail for the market can it be horizontal", then "Apply it everywhere
// for s market". Every route between airport codes shows the level plane and contrail in boarding blue.
describe('the plane and contrail between airport codes (round 209)', () => {
  let r: ReactTestRenderer;
  const marks = () => r.root.findAll((n) => n.props.testID === 'route-trail-mark' && typeof n.type === 'string');
  const flat = (st: unknown) => Object.assign({}, ...([st] as unknown[]).flat(5).filter(Boolean));

  it('turns each arrow into the mark, in boarding blue, and still reads as words', () => {
    act(() => {
      r = create(<RouteText text="DAL → PHX → LAX" style={{ fontSize: 22 }} />);
    });
    expect(marks()).toHaveLength(2);
    expect(flat(marks()[0].props.style).tintColor).toBe(colors.light.accent);
    const text = r.root.find((n) => n.type === Text);
    expect(text.props.accessibilityLabel).toBe('DAL to PHX to LAX');
    expect(r.root.findAll((n) => typeof n.props.children === 'string' && n.props.children.includes('→'))).toHaveLength(0);
  });

  it('leaves text with no route alone', () => {
    act(() => {
      r = create(<RouteText text="Tue, Oct 20" />);
    });
    expect(marks()).toHaveLength(0);
    expect(r.root.find((n) => n.type === Text).props.children).toBe('Tue, Oct 20');
  });

  it('is level and sized to the text beside it', () => {
    const small = trailMarkSize(12);
    const big = trailMarkSize(22);
    expect(big.height).toBeGreaterThan(small.height);
    // Much wider than tall: a level trail, not the slanted one from the logo.
    expect(big.width / big.height).toBeGreaterThan(2);
  });

  it('keeps code, mark, code on one line: no breakable space on either side of the mark (round 210)', () => {
    act(() => {
      r = create(<RouteText text="WN 1340 | DAL → DEN" style={{ fontSize: 17 }} />);
    });
    const strings: string[] = [];
    const walk = (n: unknown): void => {
      if (typeof n === 'string') strings.push(n);
      else if (Array.isArray(n)) n.forEach(walk);
      else if (n && typeof n === 'object' && 'children' in n) walk((n as { children: unknown }).children);
    };
    walk(r.toJSON());
    // Around the mark there's a no-break space and a word joiner, never a plain space.
    expect(strings).toContain('\u00A0\u2060');
    expect(strings).toContain('\u2060\u00A0');
    expect(strings.some((t) => t.endsWith('DAL ') || t.startsWith(' DEN'))).toBe(false);
  });

  it('shows in sheet subtitles and list headings too', () => {
    act(() => {
      r = create(
        <View>
          <MetaLine text="WN 1720 · DAL → LAX" />
          <SectionHeader title={`${marketArrows('DAL to DEN to LAX')}, 2 legs`} />
        </View>,
      );
    });
    expect(marks()).toHaveLength(3);
    expect(r.root.find((n) => n.props.accessibilityRole === 'header').props.accessibilityLabel).toBe('DAL to DEN to LAX, 2 legs');
  });

  it('puts arrows only between codes in a route said in words', () => {
    expect(marketArrows('DAL to DEN to LAX')).toBe('DAL → DEN → LAX');
    expect(marketArrows('Walk to gate 12')).toBe('Walk to gate 12');
  });
});
