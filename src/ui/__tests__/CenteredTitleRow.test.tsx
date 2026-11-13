import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { CenteredTitleRow } from '../CenteredTitleRow';

describe('CenteredTitleRow', () => {
  it('gives both sides the wider control’s width so the title sits at the center (John, 2026-11-01)', () => {
    let r: ReactTestRenderer;
    act(() => {
      r = create(
        <CenteredTitleRow left={<Text>‹ Routes</Text>} title={<Text>DFW → LAX</Text>} right={<Text>‹ 1 of 9 ›</Text>} />,
      );
    });
    const sides = () => r!.root.findAll((n) => n.props.testID === 'title-side' && typeof n.type === 'string');
    const inner = (i: number) => sides()[i].children[0] as unknown as { props: { onLayout: (e: unknown) => void } };
    const lay = (i: number, width: number) => act(() => inner(i).props.onLayout({ nativeEvent: { layout: { width } } }));
    lay(0, 90);
    lay(1, 120);
    const minW = (i: number) => Object.assign({}, ...[sides()[i].props.style].flat()).minWidth;
    expect(minW(0)).toBe(120);
    expect(minW(1)).toBe(120);
  });
});
