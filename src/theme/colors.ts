/**
 * Ice Mix color tokens, light and dark.
 *
 * All values confirmed in design/DECISIONS.md (originally from the Ice Mix
 * look in reference/globe-prototype-v9.1.html; Q-004).
 */

export type ColorScheme = 'light' | 'dark';

export const colors = {
  light: {
    // Surfaces
    // The light Departure board (round 118, John asked for a light version): a cool grey board with
    // white panels, near-black type and a deep amber that still reads as text.
    bg: '#eef1f5',
    surface: '#ffffff',
    surface2: '#eef2f7',
    line: '#d5dbe3',
    line2: '#c3cbd6',

    // Text
    text: '#0b1119',
    muted: '#4d5b6e',
    faint: '#56657a',

    // The board's raised panel: the picked route's header and My Trips' tops.
    ink: '#ffffff',

    // Departure board amber, deepened so it reads on white (round 118).
    accent: '#8f5200',
    onAccent: '#ffffff',
    accentSoft: '#fbefd9',

    // "You" only
    you: '#c46a10',
    youText: '#9a5200',
    youBg: '#fcecd9',

    // Seat tiers: color = mark/fill, Fg = text on Bg
    wide: '#0b7f6a',
    wideBg: '#dcf3ee',
    wideFg: '#08594a',
    good: '#1f9e6a',
    goodBg: '#e2f5ec',
    goodFg: '#11613f',
    okay: '#7f9a1d',
    okayBg: '#eef4d8',
    okayFg: '#4d5e0f',
    tight: '#c9861a',
    tightBg: '#fbf0dc',
    tightFg: '#7a4f08',
    full: '#d8474a',
    fullBg: '#fbe5e5',
    fullFg: '#8f2426',
    unknown: '#8a94a6',
    unknownBg: '#eceff4',
    unknownFg: '#4c5568',

    // Weather: Caution (violet), Likely delays (magenta)
    caution: '#5b4bd6',
    cautionBg: '#ebe8fd',
    likelyDelays: '#a3269a',
    likelyDelaysBg: '#f9e2f6',

    // Canceled / diverted row tag (Q-050). Provisional, pending John: magenta
    // likelyDelays, the Full-tier red, or this dedicated red (kept distinct
    // from Full so a canceled flight never reads as a full one).
    canceled: '#c8102e',
    canceledBg: '#fde0e3',
    canceledFg: '#9e0d24',

    // A time that moved, tinted by how far (John, 2026-11-02): early green; late yellow, orange, red.
    // Text colors, kept soft so they tint the number rather than shout.
    timeEarly: '#14744a',
    timeSlight: '#7d6400',
    timeLate: '#b0510a',
    timeVeryLate: '#c0262b',
  },
  dark: {
    bg: '#0b1119',
    surface: '#111a25',
    surface2: '#172231',
    line: '#1f2c3b',
    line2: '#2a3a4d',

    text: '#e8eef5',
    muted: '#9cadc0',
    faint: '#8d9db0',

    // The board's raised panel (round 117): the picked route's header and My Trips' tops.
    ink: '#111a25',

    // Departure board amber (round 117, John picked look A on 2026-11-03).
    accent: '#f5b544',
    onAccent: '#0b1119',
    accentSoft: '#2a2213',

    you: '#ffb25a',
    youText: '#ffc27a',
    youBg: '#2c1d10',

    wide: '#2fd1b0',
    wideBg: '#0d2a25',
    wideFg: '#8ff0dc',
    good: '#3bd08f',
    goodBg: '#10271d',
    goodFg: '#9af0c7',
    okay: '#c3d64a',
    okayBg: '#232a10',
    okayFg: '#dbe98f',
    tight: '#f0b541',
    tightBg: '#2a2313',
    tightFg: '#ffd98c',
    full: '#ff6b6b',
    fullBg: '#2c1618',
    fullFg: '#ffb9b9',
    unknown: '#8792a8',
    unknownBg: '#1c2230',
    unknownFg: '#b8c0d0',

    caution: '#b7adff',
    cautionBg: '#201c40',
    likelyDelays: '#f283e8',
    likelyDelaysBg: '#3a1533',

    // Provisional, pending John (see light).
    canceled: '#ff4d5e',
    canceledBg: '#3a1018',
    canceledFg: '#ffa3ad',

    timeEarly: '#7fdca6',
    timeSlight: '#e8d27a',
    timeLate: '#f3a868',
    timeVeryLate: '#ff9090',
  },
} as const;

export type ColorToken = keyof typeof colors.light;
export type Palette = Record<ColorToken, string>;

/**
 * Colors for the board's raised panel (round 117/118): the palette with the surfaces moved onto the
 * panel. Kept as its own palette so a panel can be tinted apart from the page later.
 */
export const inkColors: Record<ColorScheme, Palette> = {
  light: { ...colors.light, bg: colors.light.ink, surface: colors.light.ink },
  // On the board the raised panel is just the dark palette lifted a step (round 117).
  dark: { ...colors.dark, bg: colors.dark.ink, surface: colors.dark.ink, surface2: colors.dark.surface2 },
};
