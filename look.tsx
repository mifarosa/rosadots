import { createContext, useContext } from 'react';
import { PALETTE, Settings, Theme, THEMES, tint, DEFAULT_SETTINGS } from './theme';

// Everything a component needs to paint itself with the chosen theme/colors.
export interface Look {
  theme: Theme;
  colors: [string, string]; // solid color per player
  tints: [string, string]; // translucent color per player
}

export function makeLook(s: Settings): Look {
  const theme = THEMES[s.theme];
  const colors: [string, string] = [PALETTE[s.theme][s.p1], PALETTE[s.theme][s.p2]];
  return {
    theme,
    colors,
    tints: [tint(colors[0], theme.tintAlpha), tint(colors[1], theme.tintAlpha)],
  };
}

const LookContext = createContext<Look>(makeLook(DEFAULT_SETTINGS));
export const LookProvider = LookContext.Provider;
export const useLook = () => useContext(LookContext);
