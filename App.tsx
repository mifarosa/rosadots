import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  applyMove,
  GameState,
  isLegal,
  isOver,
  Move,
  newGame,
  Player,
  undo,
  winner,
} from './game';

const COLORS = ['#e0457b', '#2f80ed'] as const; // player 0 (rose), player 1 (blue)
const TINTS = ['rgba(224,69,123,0.22)', 'rgba(47,128,237,0.22)'] as const;
const BG = '#fff8fa';
const GUIDE = '#e9dfe5'; // faint slot shown for every free line
const INK = '#2b2b3a';
const SIZES = [4, 6, 8, 12];

const playerName = (p: Player) => `Oyuncu ${p + 1}`;

// Pick the free edge of the tapped box that is closest to the tap point.
// (x, y) are in board coordinates with the dot padding already removed.
function pickMove(s: GameState, x: number, y: number, cell: number): Move | null {
  const c = Math.floor(x / cell);
  const r = Math.floor(y / cell);
  if (r < 0 || c < 0 || r >= s.rows || c >= s.cols) return null;
  const dx = x - c * cell;
  const dy = y - r * cell;
  // Dead zone: a tap in the middle of a big box is ambiguous (all four edges
  // are about equally close), so select nothing instead of guessing.
  if (cell >= 40 && Math.min(dx, dy, cell - dx, cell - dy) > cell * 0.35) return null;
  const candidates: Array<[number, Move]> = [
    [dy, { kind: 'h', r, c }], // top
    [cell - dy, { kind: 'h', r: r + 1, c }], // bottom
    [dx, { kind: 'v', r, c }], // left
    [cell - dx, { kind: 'v', r, c: c + 1 }], // right
  ];
  let best: Move | null = null;
  let bestDist = Infinity;
  for (const [d, m] of candidates) {
    if (d < bestDist && isLegal(s, m)) {
      best = m;
      bestDist = d;
    }
  }
  return best;
}

function Menu({ onStart }: { onStart: (size: number) => void }) {
  return (
    <View style={styles.menu}>
      <Text style={styles.title}>Rosadots</Text>
      <Text style={styles.subtitle}>Noktalar ve Kutular</Text>
      <Text style={styles.label}>Tahta boyutu</Text>
      {SIZES.map((n) => (
        <Pressable
          key={n}
          style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
          onPress={() => onStart(n)}
        >
          <Text style={styles.menuButtonText}>
            {n} x {n}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function Board({
  state,
  size,
  pending,
  onTap,
  onMiss,
}: {
  state: GameState;
  size: number;
  pending: Move | null;
  onTap: (m: Move) => void;
  onMiss: () => void;
}) {
  const dot = Math.max(5, Math.min(10, size / (state.cols * 6)));
  const pad = dot + 2;
  const cell = Math.floor((size - pad * 2) / Math.max(state.rows, state.cols));
  const width = cell * state.cols + pad * 2;
  const height = cell * state.rows + pad * 2;
  const thick = Math.max(3, Math.min(8, cell / 6));

  const onPress = (e: GestureResponderEvent) => {
    const m = pickMove(
      state,
      e.nativeEvent.locationX - pad,
      e.nativeEvent.locationY - pad,
      cell,
    );
    if (m) onTap(m);
    else onMiss();
  };

  const guide = Math.max(2, thick * 0.45);
  // Rectangle of a line with the given thickness, centered on the line.
  const rect = (m: Move, t: number) =>
    m.kind === 'h'
      ? { left: pad + m.c * cell, top: pad + m.r * cell - t / 2, width: cell, height: t }
      : { left: pad + m.c * cell - t / 2, top: pad + m.r * cell, width: t, height: cell };
  const color = COLORS[state.current];

  const lastMove = state.history[state.history.length - 1];
  const isLast = (kind: 'h' | 'v', r: number, c: number) =>
    !!lastMove && lastMove.kind === kind && lastMove.r === r && lastMove.c === c;

  return (
    <View style={{ width, height }}>
      {/* Visual layer: never receives touches, so tap coordinates stay exact. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {state.owner.map((row, r) =>
          row.map((o, c) =>
            o === null ? null : (
              <View
                key={`b${r}-${c}`}
                style={[
                  styles.box,
                  {
                    left: pad + c * cell,
                    top: pad + r * cell,
                    width: cell,
                    height: cell,
                    backgroundColor: TINTS[o],
                  },
                ]}
              >
                <Text style={[styles.mark, { color: COLORS[o], fontSize: cell * 0.6 }]}>✕</Text>
              </View>
            ),
          ),
        )}
        {state.h.map((row, r) =>
          row.map((o, c) =>
            o !== null ? null : (
              <View
                key={`gh${r}-${c}`}
                style={[
                  styles.abs,
                  { ...rect({ kind: 'h', r, c }, guide), backgroundColor: GUIDE, borderRadius: guide },
                ]}
              />
            ),
          ),
        )}
        {state.v.map((row, r) =>
          row.map((o, c) =>
            o !== null ? null : (
              <View
                key={`gv${r}-${c}`}
                style={[
                  styles.abs,
                  { ...rect({ kind: 'v', r, c }, guide), backgroundColor: GUIDE, borderRadius: guide },
                ]}
              />
            ),
          ),
        )}
        {state.h.map((row, r) =>
          row.map((o, c) =>
            o === null ? null : (
              <View
                key={`h${r}-${c}`}
                style={{
                  position: 'absolute',
                  left: pad + c * cell,
                  top: pad + r * cell - thick / 2,
                  width: cell,
                  height: thick,
                  borderRadius: thick / 2,
                  backgroundColor: COLORS[o],
                  opacity: isLast('h', r, c) ? 1 : 0.85,
                }}
              />
            ),
          ),
        )}
        {state.v.map((row, r) =>
          row.map((o, c) =>
            o === null ? null : (
              <View
                key={`v${r}-${c}`}
                style={{
                  position: 'absolute',
                  left: pad + c * cell - thick / 2,
                  top: pad + r * cell,
                  width: thick,
                  height: cell,
                  borderRadius: thick / 2,
                  backgroundColor: COLORS[o],
                  opacity: isLast('v', r, c) ? 1 : 0.85,
                }}
              />
            ),
          ),
        )}
        {pending && (
          <>
            <View
              style={[
                styles.abs,
                { ...rect(pending, thick * 3), backgroundColor: TINTS[state.current], borderRadius: thick * 1.5 },
              ]}
            />
            <View
              style={[
                styles.abs,
                { ...rect(pending, thick * 1.5), backgroundColor: color, borderRadius: thick },
              ]}
            />
          </>
        )}
        {Array.from({ length: state.rows + 1 }, (_, r) =>
          Array.from({ length: state.cols + 1 }, (_, c) => (
            <View
              key={`d${r}-${c}`}
              style={{
                position: 'absolute',
                left: pad + c * cell - dot,
                top: pad + r * cell - dot,
                width: dot * 2,
                height: dot * 2,
                borderRadius: dot,
                backgroundColor: INK,
              }}
            />
          )),
        )}
      </View>
      {/* Touch layer on top. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress} />
    </View>
  );
}

function PlayerPanel({
  p,
  state,
  pending,
  missed,
  flipped,
  onConfirm,
}: {
  p: Player;
  state: GameState;
  pending: Move | null;
  missed: boolean;
  flipped: boolean;
  onConfirm: () => void;
}) {
  const over = isOver(state);
  const active = !over && state.current === p;
  const w = winner(state);
  const canConfirm = active && pending !== null;

  const text = over
    ? w === 'draw'
      ? 'Berabere! 🤝'
      : w === p
        ? '🎉 Kazandın!'
        : 'Oyun bitti'
    : !active
      ? 'Rakip oynuyor…'
      : missed
        ? 'Çizgiye biraz daha yakın dokun 👆'
        : pending
          ? 'Bu çizgi mi? Tekrar dokun ya da ✓ Çiz'
          : 'Sıra sende! Bir çizgi seç';

  return (
    // The top player's panel is rotated 180 degrees so it faces them.
    <View
      style={[
        styles.panel,
        { borderColor: COLORS[p] },
        active && { backgroundColor: TINTS[p] },
        flipped && { transform: [{ rotate: '180deg' }] },
      ]}
    >
      <View style={styles.panelRow}>
        <View style={styles.panelScore}>
          <Text style={[styles.scoreName, { color: COLORS[p] }]}>{playerName(p)}</Text>
          <Text style={styles.scoreValue}>{state.scores[p]}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.confirmButton,
            { backgroundColor: COLORS[p] },
            !canConfirm && styles.disabled,
            pressed && styles.pressed,
          ]}
          disabled={!canConfirm}
          onPress={onConfirm}
        >
          <Text style={styles.confirmText}>✓ Çiz</Text>
        </Pressable>
      </View>
      <Text style={styles.panelText}>{text}</Text>
    </View>
  );
}

function Game({ size, onExit }: { size: number; onExit: () => void }) {
  const [state, setState] = useState(() => newGame(size));
  // Line the player has selected but not confirmed yet.
  const [pending, setPending] = useState<Move | null>(null);
  // True after a tap that did not land close enough to any line.
  const [missed, setMissed] = useState(false);
  // Free space between the two player panels, measured at layout time.
  const [area, setArea] = useState({ w: 0, h: 0 });
  const boardSize = Math.min(area.w, area.h) - 8;
  const over = isOver(state);

  const confirm = () => {
    if (pending && isLegal(state, pending)) setState(applyMove(state, pending));
    setPending(null);
  };
  // First tap selects a line, tapping the same line again confirms it.
  const onTap = (m: Move) => {
    if (over) return;
    setMissed(false);
    if (pending && pending.kind === m.kind && pending.r === m.r && pending.c === m.c) confirm();
    else setPending(m);
  };

  const panelProps = { state, pending, missed, onConfirm: confirm };

  return (
    <View style={styles.game}>
      <PlayerPanel p={1} flipped {...panelProps} />
      <View
        style={styles.boardArea}
        onLayout={(e) =>
          setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }
      >
        {boardSize > 0 && (
          <Board
            state={state}
            size={boardSize}
            pending={pending}
            onTap={onTap}
            onMiss={() => !over && setMissed(true)}
          />
        )}
      </View>
      <PlayerPanel p={0} flipped={false} {...panelProps} />
      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
          onPress={onExit}
        >
          <Text style={styles.smallButtonText}>Menü</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.smallButton,
            state.history.length === 0 && styles.disabled,
            pressed && styles.pressed,
          ]}
          disabled={state.history.length === 0}
          onPress={() => {
            setPending(null);
            setMissed(false);
            setState(undo);
          }}
        >
          <Text style={styles.smallButtonText}>Geri Al</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
          onPress={() => {
            setPending(null);
            setMissed(false);
            setState(newGame(size));
          }}
        >
          <Text style={styles.smallButtonText}>Yeni Oyun</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function App() {
  const [size, setSize] = useState<number | null>(null);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        {size === null ? (
          <Menu onStart={setSize} />
        ) : (
          <Game size={size} onExit={() => setSize(null)} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  menu: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 44, fontWeight: '800', color: COLORS[0] },
  subtitle: { fontSize: 18, color: INK, marginBottom: 24 },
  label: { fontSize: 14, color: '#777', marginBottom: 4 },
  menuButton: {
    width: 220,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS[0],
    alignItems: 'center',
  },
  menuButtonText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.35 },
  game: { flex: 1, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, gap: 6 },
  boardArea: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  panel: {
    alignSelf: 'stretch',
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
    backgroundColor: '#fff',
  },
  panelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelScore: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelText: { fontSize: 14, fontWeight: '600', color: INK, textAlign: 'center' },
  scoreName: { fontSize: 14, fontWeight: '700' },
  scoreValue: { fontSize: 28, fontWeight: '800', color: INK },
  abs: { position: 'absolute' },
  confirmButton: { paddingVertical: 12, paddingHorizontal: 32, borderRadius: 28 },
  confirmText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  box: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  mark: { fontWeight: '700', includeFontPadding: false },
  // Extra space above keeps the quiet buttons away from the player 1 panel.
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 6 },
  // Quiet secondary buttons: outline only, muted text.
  smallButton: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dccfd6',
  },
  smallButtonText: { color: '#8f838a', fontWeight: '600', fontSize: 13 },
});
