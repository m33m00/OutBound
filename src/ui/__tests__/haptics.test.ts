import * as Haptics from 'expo-haptics';

import { selectionTick, withTick } from '../haptics';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));

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
});
