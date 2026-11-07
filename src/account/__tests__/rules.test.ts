import { checkPassword, cleanCode, domainOf, friendlyAuthError, isPersonalEmail, looksLikeEmail, NOT_AIRLINE_EMAIL } from '../rules';

describe('account rules', () => {
  it('reads emails loosely and domains exactly', () => {
    expect(looksLikeEmail('  Pat.Lee@WNCO.com ')).toBe(true);
    expect(looksLikeEmail('pat@wnco')).toBe(false);
    expect(looksLikeEmail('pat lee@wnco.com')).toBe(false);
    expect(domainOf('Pat@Ops.WNCO.com')).toBe('ops.wnco.com');
  });

  it('turns personal mail away before asking the server', () => {
    expect(isPersonalEmail('pat@gmail.com')).toBe(true);
    expect(isPersonalEmail('pat@icloud.com')).toBe(true);
    expect(isPersonalEmail('pat@wnco.com')).toBe(false);
  });

  it('asks for 8 characters with a letter and a number', () => {
    expect(checkPassword('short1').ok).toBe(false);
    expect(checkPassword('longenough').ok).toBe(false);
    expect(checkPassword('12345678').ok).toBe(false);
    expect(checkPassword('boarding1').ok).toBe(true);
  });

  it('keeps only the code digits, even pasted with a space', () => {
    expect(cleanCode('123 456')).toBe('123456');
    expect(cleanCode('12-34-56-78')).toBe('123456');
  });

  it('says what went wrong in plain words', () => {
    expect(friendlyAuthError({ message: 'Database error saving new user' })).toBe(NOT_AIRLINE_EMAIL);
    expect(friendlyAuthError({ message: 'OUTBOUND_EMAIL_NOT_ALLOWED: sign up with your airline work email' })).toBe(NOT_AIRLINE_EMAIL);
    expect(friendlyAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toMatch(/don’t match/);
    expect(friendlyAuthError({ code: 'otp_expired', message: 'Token has expired or is invalid' })).toMatch(/code/);
    expect(friendlyAuthError({ code: 'user_already_exists', message: 'User already registered' })).toMatch(/Log in/);
    expect(friendlyAuthError(new TypeError('Network request failed'))).toMatch(/connection/);
    expect(friendlyAuthError({ message: 'weird' })).toBe('Something went wrong. Try again.');
  });
});
