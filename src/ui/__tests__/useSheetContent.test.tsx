import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { SHEET_CLOSE_MS, useSheetContent } from '../useSheetContent';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let out: { shown: string | null; visible: boolean };
function Probe({ open }: { open: string | null }) {
  out = useSheetContent(open);
  return null;
}

describe('useSheetContent (design round 29)', () => {
  let r: ReactTestRenderer | undefined;
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => r?.unmount());
    jest.useRealTimers();
  });

  it('hides at once but keeps the last content until the sheet has slid away', () => {
    act(() => {
      r = create(<Probe open={null} />);
    });
    expect(out).toEqual({ shown: null, visible: false });
    act(() => r!.update(<Probe open="From" />));
    expect(out).toEqual({ shown: 'From', visible: true });
    act(() => r!.update(<Probe open={null} />));
    expect(out).toEqual({ shown: 'From', visible: false });
    act(() => jest.advanceTimersByTime(SHEET_CLOSE_MS));
    expect(out).toEqual({ shown: null, visible: false });
  });

  it('shows the new content right away when reopened for something else', () => {
    act(() => {
      r = create(<Probe open="From" />);
    });
    act(() => r!.update(<Probe open={null} />));
    act(() => r!.update(<Probe open="To" />));
    expect(out).toEqual({ shown: 'To', visible: true });
    act(() => jest.advanceTimersByTime(SHEET_CLOSE_MS * 2));
    expect(out).toEqual({ shown: 'To', visible: true });
  });
});
