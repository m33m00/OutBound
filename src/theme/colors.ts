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
    // The Clean look (round 120, John picked look B on 2026-11-03): a pale page, white floating
    // cards, quiet tinted boxes inside them and one accent: boarding blue since round 139.
    // Round 207 (John: "look like an app Apple, Anthropic or OpenAI made", "Less containers"): the blue-gray
    // grays turned true neutral, like a first-party app, so the boarding blue is the only color with a hue.
    bg: '#f5f5f7',
    surface: '#ffffff',
    surface2: '#f2f2f5',
    line: '#e6e6eb',
    line2: '#d4d4da',
    // A result card's own edge, a touch darker than the lines inside it so each ticket stands apart (round 150,
    // John). Soft since round 207: the shadow and the page gray do most of the separating now.
    cardEdge: '#dcdce2',
    // A results ticket's stub under the perforation, a shade warmer than the paper above it (round 221, John
    // picked the paper grain look).
    ticketStub: '#faf9f7',

    // Text
    text: '#1c1c1f',
    muted: '#6b6b72',
    // Meets 4.5:1 on white and on the page gray (Q-006).
    faint: '#6b6b72',

    // A card's header panel: the same white as the card in the Clean look.
    ink: '#ffffff',

    // Primary. The text rule (round 136, John: "What's with the navy colors and we have black text"):
    // everything you read is `text` (or `muted` for what's secondary); `accent` navy is only for what
    // you can press (buttons, links, toggles, arrows) and the one marker of where you are.
    // Boarding blue (round 139, John picked B over the Ice Mix navy #1d3d84): the navy sat at 1.7:1
    // against the text black, so taps and text read as one color. This blue is 5.8:1 on white and 3.1:1
    // against the text, so what you can press stands apart. accentSoft is the tint behind secondary buttons.
    accent: '#1c5fd4',
    onAccent: '#ffffff',
    accentSoft: '#e6eefc',

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
    // A canceled nonstop's whole card, a light wash of red (round 160, John).
    canceledTint: '#fef1f2',
    canceledFg: '#9e0d24',

    // Departed and Arrived pills (round 156, John: "A color for the pill when it has departed or arrived"):
    // a sky cyan no other meaning uses (blue is for things you tap, green to red for seats and lateness).
    done: '#0b6782',
    doneBg: '#dcf1f7',
    // Arrived gets its own graphite pill (round 201, John: "Different colors for departed and arrived"):
    // a finished flight reads quiet, next to the gray of a card that has landed. Cyan stays for Departed.
    landed: '#384250',
    landedBg: '#dfe4eb',

    // A tight connection, At risk or Missed (round 202, John: "Can we also make it a different color? Like
    // yellow/gold?"): a gold of its own, yellower than the amber that means "you" and the amber seat tier.
    risk: '#a88300',
    riskBg: '#fbf1c7',
    riskFg: '#6b5300',

    // A time that moved, tinted by how far (John, 2026-11-02): early green; late yellow, orange, red.
    // Text colors, kept soft so they tint the number rather than shout.
    timeEarly: '#14744a',
    timeSlight: '#7d6400',
    timeLate: '#b0510a',
    timeVeryLate: '#c0262b',
  },
  dark: {
    // Neutral since round 207, like the light grays: near-black page, raised gray cards.
    bg: '#0b0b0c',
    surface: '#1b1b1e',
    surface2: '#242428',
    line: '#2a2a2f',
    line2: '#38383e',
    cardEdge: '#34343a',
    ticketStub: '#1f1f22',

    text: '#f2f2f4',
    muted: '#a1a1a8',
    faint: '#95959c',

    // A card's header panel: the same as the card in the Clean look (round 120).
    ink: '#1b1b1e',

    accent: '#7aa7ff',
    onAccent: '#0a1530',
    accentSoft: '#15233f',

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
    canceledTint: '#24141d',
    canceledFg: '#ffa3ad',

    done: '#8adcf0',
    doneBg: '#0e2a33',
    landed: '#cbd3de',
    landedBg: '#29323e',
    risk: '#e5c03a',
    riskBg: '#2f2608',
    riskFg: '#f3d76b',

    timeEarly: '#7fdca6',
    timeSlight: '#e8d27a',
    timeLate: '#f3a868',
    timeVeryLate: '#ff9090',
  },
} as const;

export type ColorToken = keyof typeof colors.light;
export type Palette = Record<ColorToken, string>;

/**
 * Colors for a card's header panel (rounds 117 to 120): the palette with the surfaces moved onto the
 * panel. Kept as its own palette so a panel can be tinted apart from the page later.
 */
export const inkColors: Record<ColorScheme, Palette> = {
  light: { ...colors.light, bg: colors.light.ink, surface: colors.light.ink },
  dark: { ...colors.dark, bg: colors.dark.ink, surface: colors.dark.ink, surface2: colors.dark.surface2 },
};
