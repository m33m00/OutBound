import { chromium } from 'playwright-core';
import fs from 'node:fs';
const tag = process.argv[2];
fs.mkdirSync('out', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({
  viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  colorScheme: 'light', timezoneId: 'America/Chicago', locale: 'en-US',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
const log = [];
page.on('console', (m) => log.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => log.push(`[pageerror] ${e.message}`));
const shot = async (name) => { await page.waitForTimeout(1500); await page.screenshot({ path: `out/${tag}-${name}.png` }); log.push(`shot ${name}`); };
const tapText = async (t) => { const l = page.getByText(t, { exact: true }).first(); if (await l.count()) { await l.click({ timeout: 3000 }).catch(() => {}); log.push(`tapped ${t}`); return true; } log.push(`no ${t}`); return false; };
const go = async (p) => { await page.goto('http://localhost:8081' + p, { waitUntil: 'networkidle' }).catch((e) => log.push('goto ' + e.message)); await page.waitForTimeout(2500); };
try {
  await go('/');
  await shot('00-first');
  for (const t of ['Look Around First', 'Not Now', 'Skip', 'Continue']) await tapText(t);
  await shot('01-search');
  fs.writeFileSync(`out/${tag}-01-search.txt`, await page.evaluate(() => document.body.innerText));
  for (const p of ['/trips', '/feed', '/logbook', '/profile', '/settings']) { await go(p); await shot(p.slice(1)); }
} catch (e) { log.push('ERR ' + e.stack); }
fs.writeFileSync(`out/${tag}-log.txt`, log.join('\n'));
await browser.close();
