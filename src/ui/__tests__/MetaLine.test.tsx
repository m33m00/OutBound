import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Divided, INLINE_DIVIDER, MetaLine, metaParts } from '../MetaLine';

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

  it('puts a thin divider between items, and after a lead', () => {
    let r: ReactTestRenderer;
    act(() => {
      r = create(<MetaLine text="Likely · 1 stop · 11h 5m" />);
    });
    expect(r!.root.findAll((n) => n.props.testID === 'meta-divider' && typeof n.type === 'string')).toHaveLength(2);
    act(() => r!.update(<MetaLine lead={<></>} parts={['1 stop']} />));
    expect(r!.root.findAll((n) => n.props.testID === 'meta-divider' && typeof n.type === 'string')).toHaveLength(1);
    act(() => r!.unmount());
  });

  it('inline, each dot becomes a faint bar inside the same run of text', () => {
    let r: ReactTestRenderer;
    act(() => {
      r = create(<Divided text=" · asked 5m ago" />);
    });
    const bars = r!.root.findAll((n) => n.props.testID === 'inline-divider' && typeof n.type === 'string');
    expect(bars).toHaveLength(1);
    expect(bars[0].props.children).toBe(INLINE_DIVIDER);
    expect(metaParts('a · b · c')).toEqual(['a', 'b', 'c']);
    act(() => r!.unmount());
  });
});
