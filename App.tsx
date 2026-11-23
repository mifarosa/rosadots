import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
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
  onMove,
}: {
  state: GameState;
  size: number;
  onMove: (m: Move) => void;
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
    if (m) onMove(m);
  };

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
            o === null ? null : (
              <View
                key={`h${r}-${c}`}
                style={{
                  position: 'absolute',
                  left: pad + c * cell,
                  top: pad + r * cell - thick / 2,
                  width: cell,
                  height: thick,
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
                  backgroundColor: COLORS[o],
                  opacity: isLast('v', r, c) ? 1 : 0.85,
                }}
              />
            ),
          ),
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

function Game({ size, onExit }: { size: number; onExit: () => void }) {
  const [state, setState] = useState(() => newGame(size));
  const { width, height } = useWindowDimensions();
  const boardSize = Math.min(width - 24, height - 260);
  const over = isOver(state);
  const w = winner(state);

  const message = over
    ? w === 'draw'
      ? 'Berabere!'
      : `${playerName(w as Player)} kazandı!`
    : `Sıra: ${playerName(state.current)}`;

  return (
    <View style={styles.game}>
      <View style={styles.scoreRow}>
        {([0, 1] as Player[]).map((p) => (
          <View
            key={p}
            style={[
              styles.scoreBox,
              { borderColor: COLORS[p] },
              !over && state.current === p && { backgroundColor: TINTS[p] },
            ]}
          >
            <Text style={[styles.scoreName, { color: COLORS[p] }]}>{playerName(p)}</Text>
            <Text style={styles.scoreValue}>{state.scores[p]}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.status}>{message}</Text>
      <Board
        state={state}
        size={boardSize}
        onMove={(m) => setState((s) => (isLegal(s, m) ? applyMove(s, m) : s))}
      />
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
          onPress={() => setState(undo)}
        >
          <Text style={styles.smallButtonText}>Geri Al</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
          onPress={() => setState(newGame(size))}
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
  game: { flex: 1, alignItems: 'center', justifyContent: 'space-evenly' },
  scoreRow: { flexDirection: 'row', gap: 16 },
  scoreBox: {
    minWidth: 120,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  scoreName: { fontSize: 14, fontWeight: '700' },
  scoreValue: { fontSize: 28, fontWeight: '800', color: INK },
  status: { fontSize: 20, fontWeight: '700', color: INK },
  box: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  mark: { fontWeight: '700', includeFontPadding: false },
  buttonRow: { flexDirection: 'row', gap: 10 },
  smallButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: INK,
  },
  smallButtonText: { color: '#fff', fontWeight: '700' },
});
