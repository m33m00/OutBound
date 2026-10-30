import { Alert } from 'react-native';

import { confirmRemove } from '../confirmRemove';

describe('confirmRemove', () => {
  it('asks before removing a saved route and only removes on the destructive choice', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const remove = jest.fn();
    confirmRemove('DFW → LAX', remove);
    expect(remove).not.toHaveBeenCalled();
    expect(alert.mock.calls[0][0]).toBe('Remove DFW → LAX?');
    const buttons = alert.mock.calls[0][2]!;
    expect(buttons.map((b) => [b.text, b.style])).toEqual([
      ['Cancel', 'cancel'],
      ['Remove', 'destructive'],
    ]);
    buttons[1].onPress!();
    expect(remove).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
});
