import { Alert } from 'react-native';

import { confirmReset } from '../confirmReset';

describe('confirmReset', () => {
  it('asks before wiping settings and only resets on the destructive choice', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const reset = jest.fn();
    confirmReset(reset);
    expect(reset).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2]!;
    expect(buttons.map((b) => [b.text, b.style])).toEqual([
      ['Cancel', 'cancel'],
      ['Reset', 'destructive'],
    ]);
    buttons[1].onPress!();
    expect(reset).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
});
