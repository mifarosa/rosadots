import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { chooseMove } from '../ai';
import { Board } from '../components/Board';
import { QuietButton } from '../components/Buttons';
import { PlayerPanel } from '../components/PlayerPanel';
import { GameOptions, playerNames } from '../config';
import { applyMove, isLegal, isOver, Move, newGame, undo, undoTo } from '../game';

// The computer shows its chosen line for a moment before drawing it.
const CPU_THINK_MS = 600;
const CPU_SHOW_MS = 450;

const same = (a: Move, b: Move) => a.kind === b.kind && a.r === b.r && a.c === b.c;

export function Game({
  size,
  options,
  onExit,
}: {
  size: number;
  options: GameOptions;
  onExit: () => void;
}) {
  const vsCpu = options.opponent === 'cpu';
  const names = playerNames(options);
  const [state, setState] = useState(() => newGame(size));
  // Line selected but not confirmed yet (the human's, or the computer's while it "thinks").
  const [pending, setPending] = useState<Move | null>(null);
  // True after a tap that did not land close enough to any line.
  const [missed, setMissed] = useState(false);
  // Free space between the two player panels, measured at layout time.
  const [area, setArea] = useState({ w: 0, h: 0 });

  const over = isOver(state);
  const cpuTurn = vsCpu && !over && state.current === 1;
  const boardSize = Math.min(area.w, area.h) - 8;

  // Computer move: show the chosen line, then draw it. Any state change
  // (undo, new game) cancels the timers through the cleanup.
  useEffect(() => {
    if (!cpuTurn) return;
    const move = chooseMove(state, options.level);
    const show = setTimeout(() => setPending(move), CPU_THINK_MS);
    const draw = setTimeout(() => {
      setPending(null);
      setState(applyMove(state, move));
    }, CPU_THINK_MS + CPU_SHOW_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(draw);
    };
  }, [state, cpuTurn, options.level]);

  const confirm = () => {
    if (pending && isLegal(state, pending)) setState(applyMove(state, pending));
    setPending(null);
  };

  // First tap selects a line, tapping the same line again confirms it.
  const onTap = (m: Move) => {
    if (over || cpuTurn) return;
    setMissed(false);
    if (pending && same(pending, m)) confirm();
    else setPending(m);
  };

  const reset = (next: typeof state) => {
    setPending(null);
    setMissed(false);
    setState(next);
  };

  const panel = (p: 0 | 1) => (
    <PlayerPanel
      p={p}
      name={names[p]}
      state={state}
      pending={pending}
      missed={missed}
      // Face to face: the top panel is upside down, unless the computer sits there.
      flipped={p === 1 && !vsCpu}
      isCpu={vsCpu && p === 1}
      onConfirm={confirm}
    />
  );

  return (
    <View style={styles.game}>
      {panel(1)}
      <View
        style={styles.boardArea}
        onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {boardSize > 0 && (
          <Board
            state={state}
            size={boardSize}
            pending={pending}
            onTap={onTap}
            onMiss={() => !over && !cpuTurn && setMissed(true)}
          />
        )}
      </View>
      {panel(0)}
      <View style={styles.buttons}>
        <QuietButton label="Menü" onPress={onExit} />
        <QuietButton
          label="Geri Al"
          disabled={state.history.length === 0}
          onPress={() => reset(vsCpu ? undoTo(state, 0) : undo(state))}
        />
        <QuietButton label="Yeni Oyun" onPress={() => reset(newGame(size))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  game: { flex: 1, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, gap: 6 },
  boardArea: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  // Extra space above keeps the quiet buttons away from the player 1 panel.
  buttons: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 6 },
});
