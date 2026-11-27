import { Level } from './ai';

// Choices made on the setup screen that are not about looks.
export interface GameOptions {
  opponent: 'friend' | 'cpu';
  level: Level;
}

export const DEFAULT_OPTIONS: GameOptions = { opponent: 'friend', level: 'medium' };

// The computer always plays as player 2 (the top panel).
export const playerNames = (o: GameOptions): [string, string] => [
  'Oyuncu 1',
  o.opponent === 'cpu' ? 'Bilgisayar' : 'Oyuncu 2',
];
