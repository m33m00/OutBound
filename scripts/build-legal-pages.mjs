// Writes the public Privacy Policy, Terms of Use and Support pages from src/legal/documents.json
// into docs/, for GitHub Pages (App Store round 2). Apple needs a privacy policy URL and a support
// URL in App Store Connect. Run after editing documents.json:
//   node scripts/build-legal-pages.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docs = JSON.parse(readFileSync(join(root, 'src/legal/documents.json'), 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const shell = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | OutBound</title>
<style>
  :root { --bg:#f4f6f9; --card:#fff; --text:#101824; --muted:#56657a; --line:#dfe5ec; --accent:#1c5fd4; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0b1119; --card:#121a26; --text:#e8eef6; --muted:#9aa8bb; --line:#223044; --accent:#7aa7ff; } }
  body { margin:0; background:var(--bg); color:var(--text); font:16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  main { max-width:720px; margin:0 auto; padding:32px 16px 64px; }
  .brand { font-weight:800; letter-spacing:.3em; color:#1d3d84; font-size:14px; }
  @media (prefers-color-scheme: dark) { .brand { color:#7aa7ff; } }
  h1 { font-size:32px; line-height:1.15; margin:12px 0 4px; letter-spacing:-.02em; }
  .updated { color:var(--muted); font-size:14px; margin:0 0 20px; }
  section { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:4px 20px; margin:14px 0; }
  h2 { font-size:18px; margin:16px 0 8px; }
  p { margin:0 0 14px; }
  a { color:var(--accent); }
  nav { margin-top:28px; font-size:14px; color:var(--muted); }
  nav a { margin-right:16px; }
</style>
</head>
<body><main>
<div class="brand">OUTBOUND</div>
${body}
<nav><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Use</a><a href="support.html">Support</a></nav>
</main></body>
</html>
`;

const contact = () => {
  const c = docs.contact;
  const mail = c.email ? `<p>Email <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>.</p>` : '';
  return `<section><h2>${esc(c.heading)}</h2><p>Questions, problems or privacy requests: see the <a href="support.html">support page</a>.</p>${mail}</section>`;
};

for (const key of ['privacy', 'terms']) {
  const d = docs[key];
  const body = [
    `<h1>${esc(d.title)}</h1>`,
    `<p class="updated">Updated ${esc(docs.updated)}</p>`,
    `<p>${esc(d.intro)}</p>`,
    ...d.sections.map((s) => `<section><h2>${esc(s.heading)}</h2>${s.items.map((i) => `<p>${esc(i)}</p>`).join('')}</section>`),
    contact(),
  ].join('\n');
  writeFileSync(join(root, 'docs', `${key}.html`), shell(d.title, body));
}

const c = docs.contact;
const support = [
  '<h1>Support</h1>',
  `<p class="updated">Updated ${esc(docs.updated)}</p>`,
  '<p>OutBound helps airline employees plan standby travel. It isn’t affiliated with any airline.</p>',
  '<section><h2>Get help</h2>',
  c.email
    ? `<p>Email <a href="mailto:${esc(c.email)}">${esc(c.email)}</a> with what happened and your phone model. We answer within 2 business days.</p>`
    : '<p>Open an issue at <a href="https://github.com/m33m00/OutBound/issues">github.com/m33m00/OutBound/issues</a> with what happened and your phone model.</p>',
  '</section>',
  '<section><h2>Report a problem with a seat report</h2><p>In the app, open the flight, tap the report and choose Flag Report. We review flags within 24 hours.</p></section>',
  '<section><h2>Delete your account</h2><p>In the app: Profile, then Account, then Delete Account. Your account and everything you shared are deleted right away.</p></section>',
].join('\n');
writeFileSync(join(root, 'docs', 'support.html'), shell('Support', support));
writeFileSync(join(root, 'docs', 'index.html'), shell('OutBound', '<h1>OutBound</h1><p>Standby travel for airline employees.</p>'));
console.log('Wrote docs/privacy.html, docs/terms.html, docs/support.html, docs/index.html');
