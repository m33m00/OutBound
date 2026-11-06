import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { AccountProvider, canUseApp, LOCAL_DATA_KEYS, useAccount, type AccountContextValue } from '../AccountProvider';
import type { AccountBackend, AccountUser } from '../backend';
import { NOT_AIRLINE_EMAIL } from '../rules';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

function fakeBackend(start: AccountUser | null = null) {
  let listener: ((u: AccountUser | null) => void) | null = null;
  const pat = { id: 'u1', email: 'pat@wnco.com' };
  const set = (u: AccountUser | null) => listener?.(u);
  const b = {
    current: jest.fn(async () => start),
    onChange: jest.fn((cb: (u: AccountUser | null) => void) => {
      listener = cb;
      return () => (listener = null);
    }),
    emailAllowed: jest.fn(async (e: string) => e.endsWith('@wnco.com')),
    signUp: jest.fn(async () => ({ needsCode: true })),
    verifyCode: jest.fn(async () => set(pat)),
    resendCode: jest.fn(async () => {}),
    logIn: jest.fn(async () => set(pat)),
    sendReset: jest.fn(async () => {}),
    setPassword: jest.fn(async () => {}),
    logOut: jest.fn(async () => set(null)),
    deleteAccount: jest.fn(async () => set(null)),
  } satisfies AccountBackend;
  return b;
}

async function mount(backend: AccountBackend | null) {
  let value!: AccountContextValue;
  const Probe = () => {
    value = useAccount();
    return null;
  };
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(
      <AccountProvider backend={backend}>
        <Probe />
      </AccountProvider>,
    );
  });
  return { get: () => value, r };
}

describe('AccountProvider', () => {
  beforeEach(() => AsyncStorage.clear());

  it('starts signed out, and stays out of the app', async () => {
    const { get } = await mount(fakeBackend());
    expect(get().status).toBe('signedOut');
    expect(canUseApp(get())).toBe(false);
  });

  it('refuses a non-airline email before making an account', async () => {
    const b = fakeBackend();
    const { get } = await mount(b);
    let r: Awaited<ReturnType<AccountContextValue['signUp']>> | undefined;
    await act(async () => {
      r = await get().signUp('pat@example.com', 'boarding1');
    });
    expect(r).toEqual({ ok: false, error: NOT_AIRLINE_EMAIL });
    expect(b.signUp).not.toHaveBeenCalled();
  });

  it('signs up, then the code lets you in', async () => {
    const b = fakeBackend();
    const { get } = await mount(b);
    let r: Awaited<ReturnType<AccountContextValue['signUp']>> | undefined;
    await act(async () => {
      r = await get().signUp('pat@wnco.com', 'boarding1');
    });
    expect(r).toEqual({ ok: true, needsCode: true });
    await act(async () => {
      await get().verifyCode('pat@wnco.com', '123456', 'signup');
    });
    expect(get().status).toBe('signedIn');
    expect(canUseApp(get())).toBe(true);
  });

  it('holds a reset at the new password page until it is saved', async () => {
    const b = fakeBackend();
    const { get } = await mount(b);
    await act(async () => {
      await get().verifyCode('pat@wnco.com', '123456', 'reset');
    });
    expect(get().status).toBe('signedIn');
    expect(get().settingPassword).toBe(true);
    expect(canUseApp(get())).toBe(false);
    await act(async () => {
      await get().setPassword('boarding2');
    });
    expect(canUseApp(get())).toBe(true);
  });

  it('sends a fresh code when the email was never confirmed', async () => {
    const b = fakeBackend();
    b.logIn.mockRejectedValueOnce({ code: 'email_not_confirmed', message: 'Email not confirmed' });
    const { get } = await mount(b);
    let r: Awaited<ReturnType<AccountContextValue['logIn']>> | undefined;
    await act(async () => {
      r = await get().logIn('pat@wnco.com', 'boarding1');
    });
    expect(r).toMatchObject({ ok: false, needsCode: true });
    expect(b.resendCode).toHaveBeenCalledWith('pat@wnco.com', 'signup');
  });

  it('deletes the account and clears what the phone kept', async () => {
    const b = fakeBackend({ id: 'u1', email: 'pat@wnco.com' });
    await AsyncStorage.setItem('outbound.logbook.v1', '[]');
    const { get } = await mount(b);
    expect(get().status).toBe('signedIn');
    const before = get().epoch;
    await act(async () => {
      await get().deleteAccount();
    });
    expect(b.deleteAccount).toHaveBeenCalled();
    expect(get().status).toBe('signedOut');
    expect(get().epoch).toBe(before + 1);
    for (const key of LOCAL_DATA_KEYS) expect(await AsyncStorage.getItem(key)).toBeNull();
  });

  it('keeps the account when the server refuses the delete', async () => {
    const b = fakeBackend({ id: 'u1', email: 'pat@wnco.com' });
    b.deleteAccount.mockRejectedValueOnce(new TypeError('Network request failed'));
    const { get } = await mount(b);
    let r: Awaited<ReturnType<AccountContextValue['deleteAccount']>> | undefined;
    await act(async () => {
      r = await get().deleteAccount();
    });
    expect(r).toMatchObject({ ok: false });
    expect(get().status).toBe('signedIn');
  });

  it('lets a preview build look around, and Log Out brings the welcome back', async () => {
    const { get } = await mount(fakeBackend());
    expect(get().canPreview).toBe(true);
    await act(async () => get().startPreview());
    expect(get().status).toBe('preview');
    expect(canUseApp(get())).toBe(true);
    await act(async () => {
      await get().logOut();
    });
    expect(get().status).toBe('signedOut');
  });

  it('with no server, says accounts aren’t set up instead of failing', async () => {
    const { get } = await mount(null);
    expect(get().serverReady).toBe(false);
    let r: Awaited<ReturnType<AccountContextValue['logIn']>> | undefined;
    await act(async () => {
      r = await get().logIn('pat@wnco.com', 'boarding1');
    });
    expect(r).toMatchObject({ ok: false });
  });
});
