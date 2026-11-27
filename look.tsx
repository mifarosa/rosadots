import { createContext, useContext } from 'react';
import { Player } from './game';
import {
  ColorId,
  DEFAULT_SETTINGS,
  opponentColor,
  PALETTE,
  Settings,
  Theme,
  THEMES,
  ThemeId,
  tint,
} from './theme';

// Everything a component needs to paint itself with the chosen theme/colors.
export interface Look {
  theme: Theme;
  colors: [string, string]; // solid color per player
  tints: [string, string]; // translucent color per player
}

function lookFor(themeId: ThemeId, ids: [ColorId, ColorId]): Look {
  const theme = THEMES[themeId];
  const colors: [string, string] = [PALETTE[themeId][ids[0]], PALETTE[themeId][ids[1]]];
  return {
    theme,
    colors,
    tints: [tint(colors[0], theme.tintAlpha), tint(colors[1], theme.tintAlpha)],
  };
}

export const makeLook = (s: Settings): Look => lookFor(s.theme, [s.p1, s.p2]);

// Online: on this phone the player in `seat` wears my color (`s.p1`), the other
// one the opponent's color, changed if it clashes with mine.
export function makeOnlineLook(s: Settings, seat: Player, theirs: ColorId | undefined): Look {
  const other = opponentColor(s.p1, theirs);
  return lookFor(s.theme, seat === 0 ? [s.p1, other] : [other, s.p1]);
}

const LookContext = createContext<Look>(makeLook(DEFAULT_SETTINGS));
export const LookProvider = LookContext.Provider;
export const useLook = () => useContext(LookContext);
