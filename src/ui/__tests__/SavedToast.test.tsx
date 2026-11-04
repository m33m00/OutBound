import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { SAVED_TOAST_MS, SavedToast } from '../SavedToast';

describe('SavedToast (round 138, John: accidental swipe saves)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
    jest.useRealTimers();
  });

  it('Undo takes the save back and closes the toast', () => {
    const onUndo = jest.fn();
    const onDone = jest.fn();
    act(() => {
      r = create(<SavedToast onUndo={onUndo} onDone={onDone} />);
    });
    const undo = r!.root.find((n) => n.props.testID === 'saved-toast-undo' && n.props.onPress);
    act(() => undo.props.onPress());
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('goes away on its own after a few seconds', () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    act(() => {
      r = create(<SavedToast onUndo={jest.fn()} onDone={onDone} />);
    });
    act(() => jest.advanceTimersByTime(SAVED_TOAST_MS - 1));
    expect(onDone).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
