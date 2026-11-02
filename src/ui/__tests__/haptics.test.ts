import * as Haptics from 'expo-haptics';

import { impactTick, selectionTick, successTap, withTick } from '../haptics';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

describe('haptics (design round 10)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('withTick ticks, then runs the handler with its arguments', () => {
    const fn = jest.fn();
    withTick(fn)('DAL', 2);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('DAL', 2);
  });

  it('never throws when haptics are unavailable', () => {
    (Haptics.selectionAsync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no engine');
    });
    expect(() => selectionTick()).not.toThrow();
    (Haptics.selectionAsync as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('no engine')));
    expect(() => selectionTick()).not.toThrow();
  });

  it('primary buttons get a light thump and "done" actions the success tap (round 113)', () => {
    impactTick();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    successTap();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    (Haptics.impactAsync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no engine');
    });
    expect(() => impactTick()).not.toThrow();
  });
});
