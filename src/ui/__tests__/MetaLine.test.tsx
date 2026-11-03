import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { MetaLine, metaParts, spaced } from '../MetaLine';

describe('MetaLine (round 123: no dots between text)', () => {
  it('splits dotted text into separate items with no dot left', () => {
    let r: ReactTestRenderer;
    act(() => {
      r = create(<MetaLine text="1 stop · 11h 5m" />);
    });
    const texts = r!.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
      .map((n) => n.props.children);
    expect(texts).toEqual(['1 stop', '11h 5m']);
    act(() => r!.unmount());
  });

  it('takes ready items, skips empty ones, and draws nothing when empty', () => {
    let r: ReactTestRenderer;
    act(() => {
      r = create(<MetaLine parts={['Nonstop', null, '2h 10m']} />);
    });
    const texts = r!.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
      .map((n) => n.props.children);
    expect(texts).toEqual(['Nonstop', '2h 10m']);
    act(() => r!.update(<MetaLine parts={[null]} />));
    expect(r!.toJSON()).toBeNull();
    act(() => r!.unmount());
  });

  it('turns dots into a wide space when the text has to stay one run', () => {
    expect(spaced('Departed · Los Angeles')).toBe('Departed Los Angeles');
    expect(spaced(' · asked 5m ago')).toBe(' asked 5m ago');
    expect(metaParts('a · b · c')).toEqual(['a', 'b', 'c']);
  });
});
