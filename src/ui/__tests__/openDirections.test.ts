import { Linking } from 'react-native';

import { AIRPORTS } from '@/engine';

import { openDirections } from '../openDirections';

describe('openDirections', () => {
  afterEach(() => jest.restoreAllMocks());

  it('falls back to the Google Maps web page when the app is not installed', async () => {
    const open = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValueOnce(new Error('not installed'))
      .mockResolvedValueOnce(undefined);
    await expect(openDirections(AIRPORTS.DFW, 'google')).resolves.toBe(true);
    expect(open).toHaveBeenCalledTimes(2);
    expect(String(open.mock.calls[1][0]).startsWith('https://www.google.com/maps/dir/')).toBe(true);
  });

  it('says so when nothing could open', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no'));
    await expect(openDirections(AIRPORTS.DFW, 'apple')).resolves.toBe(false);
  });
});
