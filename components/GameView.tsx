import { ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GameState, Move, Player } from '../game';
import { Board } from './Board';
import { PanelKind, PlayerPanel } from './PlayerPanel';

// The game screen shared by local, computer and online play: two player
// panels with the board between them and a footer. It only draws; the parent
// owns the game state and decides what a tap means.
export function GameView({
  state,
  pending,
  missed,
  bottom,
  kinds,
  names,
  flipTop,
  clock = null,
  offline = [false, false],
  banner,
  footer,
  onTap,
  onMiss,
  onConfirm,
}: {
  state: GameState;
  pending: Move | null;
  missed: boolean;
  bottom: Player; // whose panel sits at the bottom of the screen
  kinds: [PanelKind, PanelKind]; // per player
  names: [string, string]; // per player
  flipTop: boolean; // turn the top panel upside down (two people around one phone)
  clock?: { player: Player; seconds: number } | null;
  offline?: [boolean, boolean];
  banner?: ReactNode; // optional strip between the board and the bottom panel
  footer: ReactNode;
  onTap: (m: Move) => void;
  onMiss: () => void;
  onConfirm: () => void;
}) {
  // Free space between the two panels, measured at layout time.
  const [area, setArea] = useState({ w: 0, h: 0 });
  const boardSize = Math.min(area.w, area.h) - 8;

  const panel = (p: Player, flipped: boolean) => (
    <PlayerPanel
      p={p}
      name={names[p]}
      kind={kinds[p]}
      state={state}
      pending={pending}
      missed={missed}
      flipped={flipped}
      offline={offline[p]}
      seconds={clock?.player === p ? clock.seconds : null}
      onConfirm={onConfirm}
    />
  );

  return (
    <View style={styles.game}>
      {panel((1 - bottom) as Player, flipTop)}
      <View
        style={styles.boardArea}
        onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {boardSize > 0 && (
          <Board state={state} size={boardSize} pending={pending} onTap={onTap} onMiss={onMiss} />
        )}
      </View>
      {banner}
      {panel(bottom, false)}
      <View style={styles.footer}>{footer}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  game: { flex: 1, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, gap: 6 },
  boardArea: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  // Extra space above keeps the quiet buttons away from the bottom panel.
  footer: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 6 },
});
