// Node's fs runs under jest; the app's types don't include Node, so it's declared here.
declare const require: (m: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require('fs') as { readFileSync: (path: string, enc: 'utf8') => string };
const read = (file: string) => readFileSync(`${__dirname}/../${file}`, 'utf8');

// Expo only bakes EXPO_PUBLIC_* values into a published build where the code reads
// process.env.EXPO_PUBLIC_NAME directly. Passing process.env around as an object left radar and
// live delays off in Expo Go even with the keys set (2026-11-01).
describe('public env', () => {
  const src = read('airportStatus.ts');

  it.each(['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SCHEDULES'])(
    'reads %s by name so Expo inlines it',
    (name) => {
      expect(src).toContain(`process.env.${name}`);
    },
  );

  it('never defaults to the whole process.env object', () => {
    const files = ['airportStatus.ts', 'schedules.ts'].map(read);
    for (const f of files) expect(f).not.toMatch(/=\s*process\.env\)/);
  });
});
