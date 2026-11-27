import { useEffect, useState } from 'react';
import { chooseMove } from '../ai';
import { QuietButton } from '../components/Buttons';
import { GameView } from '../components/GameView';
import { GameOptions, playerNames } from '../config';
import { applyMove, isLegal, isOver, Move, newGame, undo, undoTo } from '../game';

// The computer shows its chosen line for a moment before drawing it.
const CPU_THINK_MS = 600;
const CPU_SHOW_MS = 450;

const same = (a: Move, b: Move) => a.kind === b.kind && a.r === b.r && a.c === b.c;

// One phone: two people taking turns, or one person against the computer.
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
  const [state, setState] = useState(() => newGame(size));
  // Line selected but not confirmed yet (the human's, or the computer's while it "thinks").
  const [pending, setPending] = useState<Move | null>(null);
  // True after a tap that did not land close enough to any line.
  const [missed, setMissed] = useState(false);

  const over = isOver(state);
  const cpuTurn = vsCpu && !over && state.current === 1;

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

  return (
    <GameView
      state={state}
      pending={pending}
      missed={missed}
      bottom={0}
      kinds={['local', vsCpu ? 'cpu' : 'local']}
      names={playerNames(options)}
      // Face to face: the top panel is upside down, unless the computer sits there.
      flipTop={!vsCpu}
      onTap={onTap}
      onMiss={() => !over && !cpuTurn && setMissed(true)}
      onConfirm={confirm}
      footer={
        <>
          <QuietButton label="Menü" onPress={onExit} />
          <QuietButton
            label="Geri Al"
            disabled={state.history.length === 0}
            onPress={() => reset(vsCpu ? undoTo(state, 0) : undo(state))}
          />
          <QuietButton label="Yeni Oyun" onPress={() => reset(newGame(size))} />
        </>
      }
    />
  );
}
