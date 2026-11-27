# Rosadots: Dots & Boxes

Mobile (iOS + Android) Dots and Boxes game built with React Native + Expo. Owner handle: mifarosa. Developer works on Windows/Linux (no Mac), tests with Expo Go.

## Working rules

- Talk to the user in Turkish. Code comments in English.
- Keep dependencies minimal. Prefer plain React Native views over extra libraries.
- Game rules live ONLY in `game.ts` (pure TypeScript, no React/RN imports). The same file will later run on the online server to validate moves.
- Run `npm test` after any change to the pure files (`game.ts`, `ai.ts`, `pickMove.ts`, `theme.ts`), and `npm run typecheck` after any change to UI files (`App.tsx`, `screens/`, `components/`, `look.tsx`).

## Game rules (implemented)

- Players take turns drawing one line between two adjacent dots.
- The player who draws the 4th side of a box owns it (colored tint + X mark, like the paper version) and plays again. One line can close two boxes at once.
- Game ends when all boxes are owned; most boxes wins.
- Board sizes in the menu: 4x4, 6x6, 8x8, 12x12 (square boards; `game.ts` supports any rows x cols).

## Files

Pure TypeScript at the repo root (no React / RN imports, so the online server can reuse them):

- `game.ts`: state, `newGame`, `applyMove`, `isLegal`, `isOver`, `winner`, `undo` (replays history), `undoTo` (undo until a given player's turn), `closingMoves`, `legalMoves`. State is immutable. `h` lines are (rows+1) x cols, `v` lines are rows x (cols+1). Each line stores which player drew it (0 | 1 | null).
- `ai.ts`: `chooseMove(state, level, rng?)` for the computer. `easy`: takes a box if it can, else random. `medium`: takes a box, else avoids giving the third side, else gives away as little as possible (`sacrificeCost`). A `hard` level (chains / search) is planned.
- `pickMove.ts`: turns a tap into a line (nearest free edge of the tapped box, ignores the middle of big boxes).
- `theme.ts`: light/dark themes, player color palettes (deeper in light, brighter in dark), `pickColor` (picking the other player's color swaps), `tint`, `textOn`.
- `config.ts`: `GameOptions` (opponent friend/cpu, level) and player names. The computer is always player 2 (top panel).
- Tests next to each file: `game.test.ts`, `ai.test.ts`, `pickMove.test.ts`, `theme.test.ts`.

UI (React Native):

- `App.tsx`: only the screen flow menu -> setup -> game and the shared theme/options state.
- `look.tsx`: `LookContext` (theme + per-player colors). Colors are never hard-coded; read them with `useLook()`.
- `screens/Menu.tsx`, `screens/Setup.tsx` (opponent, level, theme, colors), `screens/Game.tsx` (turn logic, computer timers, undo).
- `components/Board.tsx`: a transparent `Pressable` overlay sits on top of a `pointerEvents="none"` visual layer, so tap coordinates are exact. `components/PlayerPanel.tsx`: score + own confirm button; the top panel is rotated 180 degrees for face-to-face play (not when the computer sits there). `components/Buttons.tsx`: `PrimaryButton`, `QuietButton`, `ConfirmButton`, `Segmented`.
- Line drawing is select-then-confirm: first tap highlights a line, tapping it again (or the player's own "Çiz" button) draws it.

## Setup

```
npx create-expo-app@latest rosadots
cd rosadots
npx expo install react-native-safe-area-context
# replace App.tsx, add game.ts, game.test.ts, CLAUDE.md
npx expo start
```

### app.json values

```json
{
  "expo": {
    "name": "Rosadots: Dots & Boxes",
    "slug": "rosadots",
    "ios": { "bundleIdentifier": "com.mifarosa.rosadots" },
    "android": { "package": "com.mifarosa.rosadots" }
  }
}
```

The bundle id / package cannot change after store release.

## Naming and store decisions

- Final name: Rosadots (brand mifarosa + "dots"), store title Rosadots: Dots & Boxes (22 chars, under the 30 limit).
- The game is public domain (Dots and Boxes, described by Lucas in 1889), so differentiation comes from quality: smooth online play, clean design, free and ad-free, Turkish UI.
- Store keywords: dots and boxes, pen and paper game, 2 player strategy, pass and play, connect the dots, box capture, territory game, extra turn, local multiplayer, turn-based strategy, classic paper game, brain game, casual puzzle, online multiplayer, offline game
- Before release: check App Store, Google Play, rosadots domain and social handles.

## Roadmap

1. Test on a real phone via Expo Go. Check tap comfort on 12x12.
2. Preview-then-confirm mode (first tap highlights the line, second tap confirms), keep Undo.
3. Haptics (`expo-haptics`) on line draw and box capture; optional sound.
4. Play vs computer: easy and medium are done. Next: hard level (chain counting / double-cross, alpha-beta search with a depth limit on big boards).
5. Online multiplayer: Node + WebSocket (`ws`) room server on the user's free Oracle Cloud Always Free instance. Server imports `game.ts` to validate every move. Room codes to invite a friend, reconnect support, server is the source of truth.
6. Store prep: icon, splash, privacy policy, EAS Build for iOS/Android.

## Known notes

- Undo replays the whole history from an empty board (fine at max ~312 moves).
- UI strings are Turkish and hard-coded in `App.tsx`; extract to a small i18n map when adding English.
