# Rosadots: Dots & Boxes

Mobile (iOS + Android) Dots and Boxes game built with React Native + Expo. Owner handle: mifarosa. Developer works on Windows/Linux (no Mac), tests with Expo Go.

## Working rules

- Talk to the user in Turkish. Code comments in English.
- Keep dependencies minimal. Prefer plain React Native views over extra libraries.
- Game rules live ONLY in `game.ts` (pure TypeScript, no React/RN imports). The same file will later run on the online server to validate moves.
- Run `npx tsx game.test.ts` after any change to `game.ts`, and `npx tsc --noEmit` after any change to `App.tsx`.

## Game rules (implemented)

- Players take turns drawing one line between two adjacent dots.
- The player who draws the 4th side of a box owns it (colored tint + X mark, like the paper version) and plays again. One line can close two boxes at once.
- Game ends when all boxes are owned; most boxes wins.
- Board sizes in the menu: 4x4, 6x6, 8x8, 12x12 (square boards; `game.ts` supports any rows x cols).

## Files

- `game.ts`: state, `newGame`, `applyMove`, `isLegal`, `isOver`, `winner`, `undo` (replays history). State is immutable. `h` lines are (rows+1) x cols, `v` lines are rows x (cols+1). Each line stores which player drew it (0 | 1 | null).
- `game.test.ts`: logic sanity tests (bonus move, double box, undo, random full 12x12 game).
- `App.tsx`: menu + game screen. A transparent `Pressable` overlay sits on top of a `pointerEvents="none"` visual layer, so tap coordinates are exact. A tap anywhere inside a box picks the nearest FREE edge of that box (`pickMove`), which keeps 12x12 playable on small screens.

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
4. Play vs computer (simple AI: take any box that closes, avoid giving the third side, otherwise random).
5. Online multiplayer: Node + WebSocket (`ws`) room server on the user's free Oracle Cloud Always Free instance. Server imports `game.ts` to validate every move. Room codes to invite a friend, reconnect support, server is the source of truth.
6. Store prep: icon, splash, privacy policy, EAS Build for iOS/Android.

## Known notes

- Undo replays the whole history from an empty board (fine at max ~312 moves).
- UI strings are Turkish and hard-coded in `App.tsx`; extract to a small i18n map when adding English.
