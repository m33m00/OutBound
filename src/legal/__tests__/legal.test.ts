import { LEGAL_URL, legalPage, parseLegalDoc, supportLink } from '../legal';

// Node's own modules, typed loosely: the app's tsconfig has no Node types.
declare const require: (m: string) => any;
declare const __dirname: string;
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const root: string = join(__dirname, '../../..');

describe('privacy policy and terms', () => {
  it('cover what Apple checks for', () => {
    const privacy = JSON.stringify(legalPage('privacy')).toLowerCase();
    // 5.1.1(i): what's collected, who it's shared with, how long it's kept, how to delete it.
    for (const words of ['what we collect', 'who helps run', 'how long we keep', 'delete your account']) expect(privacy).toContain(words);
    const terms = JSON.stringify(legalPage('terms')).toLowerCase();
    // 1.2: no tolerance for objectionable content, flagging and blocking.
    expect(terms).toContain('no tolerance');
    expect(terms).toContain('flag');
    expect(terms).toContain('hide reports');
    // 5.2: not affiliated with any airline.
    expect(terms).toContain('affiliated');
  });

  it('only opens known pages', () => {
    expect(parseLegalDoc('terms')).toBe('terms');
    expect(parseLegalDoc('../etc')).toBeNull();
  });

  it('points help at a page that exists', () => {
    expect(supportLink()).toMatch(/^(mailto:|https:\/\/)/);
    expect(LEGAL_URL.privacy).toMatch(/^https:\/\/.+privacy\.html$/);
  });

  it('keeps the public web pages in step with the app (run node scripts/build-legal-pages.mjs)', () => {
    const before = ['privacy', 'terms', 'support'].map((d: string) => readFileSync(join(root, 'docs', `${d}.html`), 'utf8'));
    execFileSync('node', [join(root, 'scripts/build-legal-pages.mjs')]);
    const after = ['privacy', 'terms', 'support'].map((d: string) => readFileSync(join(root, 'docs', `${d}.html`), 'utf8'));
    expect(after).toEqual(before);
  });
});
