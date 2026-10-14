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
    bg: '#f6f8fb',
    surface: '#ffffff',
    surface2: '#eef2f7',
    line: '#dfe5ec',
    line2: '#cbd4de',

    // Text
    text: '#101824',
    muted: '#56657a',
    // Darker than the prototype #66758a to meet 4.5:1 (Q-006).
    faint: '#606f84',

    // Primary
    accent: '#1d3d84',
    onAccent: '#ffffff',
    accentSoft: '#e7ecf6',

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

    accent: '#9bb8ef',
    onAccent: '#0a1530',
    accentSoft: '#17233b',

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
  },
} as const;

export type ColorToken = keyof typeof colors.light;
export type Palette = Record<ColorToken, string>;
