// Themes and player color palettes. Pure TypeScript, no React / React Native.

export type ThemeId = 'light' | 'dark';
export type ColorId = 'pembe' | 'mavi' | 'yesil' | 'turuncu' | 'mor' | 'turkuaz';

export const COLOR_IDS: ColorId[] = ['pembe', 'mavi', 'yesil', 'turuncu', 'mor', 'turkuaz'];

export const COLOR_NAMES: Record<ColorId, string> = {
  pembe: 'Pembe',
  mavi: 'Mavi',
  yesil: 'Yeşil',
  turuncu: 'Turuncu',
  mor: 'Mor',
  turkuaz: 'Turkuaz',
};

export interface Theme {
  id: ThemeId;
  bg: string; // screen background
  panel: string; // idle player panel background
  ink: string; // main text, dots
  guide: string; // faint slot drawn for every free line
  muted: string; // quiet secondary text
  border: string; // quiet outlines
  statusBar: 'dark' | 'light';
  tintAlpha: number; // opacity of captured-box tint
}

export const THEMES: Record<ThemeId, Theme> = {
  light: {
    id: 'light',
    bg: '#fff8fa',
    panel: '#ffffff',
    ink: '#2b2b3a',
    guide: '#e9dfe5',
    muted: '#8f838a',
    border: '#dccfd6',
    statusBar: 'dark',
    tintAlpha: 0.22,
  },
  dark: {
    id: 'dark',
    bg: '#15151f',
    panel: '#22222f',
    ink: '#f2f2f7',
    guide: '#34344a',
    muted: '#9a9ab0',
    border: '#3a3a52',
    statusBar: 'light',
    tintAlpha: 0.3,
  },
};

// Deeper colors for the light theme, brighter ones for the dark theme.
export const PALETTE: Record<ThemeId, Record<ColorId, string>> = {
  light: {
    pembe: '#e0457b',
    mavi: '#2f80ed',
    yesil: '#1fa862',
    turuncu: '#f2842a',
    mor: '#8e56e0',
    turkuaz: '#12a7b8',
  },
  dark: {
    pembe: '#ff5c97',
    mavi: '#4f9bff',
    yesil: '#3ddc84',
    turuncu: '#ffa24d',
    mor: '#b18cff',
    turkuaz: '#35d6e8',
  },
};

export interface Settings {
  theme: ThemeId;
  p1: ColorId;
  p2: ColorId;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'light', p1: 'pembe', p2: 'mavi' };

// "#rrggbb" + alpha -> "rgba(r,g,b,a)".
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// Readable text color (white or near-black) for a filled button of this color.
export function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 160 ? '#1b1b27' : '#ffffff';
}

// Choose a color for one player. If the other player already has it, swap,
// so the two players never end up with the same color.
export function pickColor(s: Settings, who: 'p1' | 'p2', color: ColorId): Settings {
  const other = who === 'p1' ? 'p2' : 'p1';
  if (s[other] === color) return { ...s, [other]: s[who], [who]: color };
  return { ...s, [who]: color };
}

// The color to show for the opponent on my screen: theirs, unless I already
// use it, then the first color I do not use.
export function opponentColor(mine: ColorId, theirs: ColorId | undefined): ColorId {
  if (theirs && theirs !== mine) return theirs;
  return COLOR_IDS.find((id) => id !== mine) as ColorId;
}
