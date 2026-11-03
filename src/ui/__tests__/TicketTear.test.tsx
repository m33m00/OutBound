import { act, create, ReactTestRenderer } from 'react-test-renderer';

import { TicketTear, TEAR_NOTCH } from '../TicketTear';

describe('TicketTear', () => {
  it('draws a dashed line with a page-colored notch at each edge, pulled out to the card edges', async () => {
    let r: ReactTestRenderer;
    await act(async () => {
      r = create(<TicketTear notch="#f4f6f9" edge="#dfe5ec" line="#cbd4de" left={21} right={16} />);
    });
    const tear = r!.root.findAll((n) => n.props.testID === 'ticket-tear' && typeof n.type === 'string')[0];
    const flat = (st: unknown) => Object.assign({}, ...([st] as unknown[]).flat(3).filter(Boolean));
    expect(flat(tear.props.style).marginLeft).toBeLessThan(-21);
    expect(flat(tear.props.style).marginRight).toBeLessThan(-16);
    expect(tear.props.accessibilityElementsHidden).toBe(true);
    const parts = tear.children as ReactTestRenderer['root'][];
    expect(parts).toHaveLength(3);
    const [left, dash, right] = parts.map((p) => flat(p.props.style));
    for (const bite of [left, right]) {
      expect(bite.backgroundColor).toBe('#f4f6f9');
      expect(bite.borderColor).toBe('#dfe5ec');
      expect(bite.width).toBeGreaterThan(TEAR_NOTCH);
      expect(bite.width).toBeLessThan(TEAR_NOTCH + 1);
    }
    expect(dash.borderStyle).toBe('dashed');
    expect(dash.borderColor).toBe('#cbd4de');
    r!.unmount();
  });
});
