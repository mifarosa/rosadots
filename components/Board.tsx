import { GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Cell, GameState, Move } from '../game';
import { useLook } from '../look';
import { pickMove } from '../pickMove';

interface Line {
  m: Move;
  owner: Cell;
}

// Every line of the board, free ones first so drawn lines paint on top of the
// faint guides where they meet at a dot.
function allLines(s: GameState): Line[] {
  const toLines = (rows: Cell[][], kind: 'h' | 'v') =>
    rows.flatMap((row, r) => row.map((owner, c) => ({ m: { kind, r, c } as Move, owner })));
  const lines = [...toLines(s.h, 'h'), ...toLines(s.v, 'v')];
  return lines.sort((a, b) => Number(b.owner === null) - Number(a.owner === null));
}

const key = (m: Move) => `${m.kind}${m.r}-${m.c}`;

export function Board({
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
  const { theme, colors, tints } = useLook();
  const dot = Math.max(5, Math.min(10, size / (state.cols * 6)));
  const pad = dot + 2;
  const cell = Math.floor((size - pad * 2) / Math.max(state.rows, state.cols));
  const thick = Math.max(3, Math.min(8, cell / 6));
  const guide = Math.max(2, thick * 0.45);

  // Rectangle of a line with thickness `t`, centered on the line.
  const rect = (m: Move, t: number) =>
    m.kind === 'h'
      ? { left: pad + m.c * cell, top: pad + m.r * cell - t / 2, width: cell, height: t }
      : { left: pad + m.c * cell - t / 2, top: pad + m.r * cell, width: t, height: cell };

  const onPress = (e: GestureResponderEvent) => {
    const m = pickMove(state, e.nativeEvent.locationX - pad, e.nativeEvent.locationY - pad, cell);
    if (m) onTap(m);
    else onMiss();
  };

  const last = state.history[state.history.length - 1];

  return (
    <View style={{ width: cell * state.cols + pad * 2, height: cell * state.rows + pad * 2 }}>
      {/* Visual layer: never receives touches, so tap coordinates stay exact. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {state.owner.map((row, r) =>
          row.map((o, c) =>
            o === null ? null : (
              <View
                key={`b${r}-${c}`}
                style={[
                  styles.box,
                  { left: pad + c * cell, top: pad + r * cell, width: cell, height: cell },
                  { backgroundColor: tints[o] },
                ]}
              >
                <Text style={[styles.mark, { color: colors[o], fontSize: cell * 0.6 }]}>✕</Text>
              </View>
            ),
          ),
        )}
        {allLines(state).map(({ m, owner }) => {
          const t = owner === null ? guide : thick;
          const isLast = !!last && key(last) === key(m);
          return (
            <View
              key={key(m)}
              style={[
                styles.abs,
                rect(m, t),
                {
                  borderRadius: t / 2,
                  backgroundColor: owner === null ? theme.guide : colors[owner],
                  opacity: owner === null || isLast ? 1 : 0.85,
                },
              ]}
            />
          );
        })}
        {pending && (
          <>
            <View
              style={[
                styles.abs,
                rect(pending, thick * 3),
                { backgroundColor: tints[state.current], borderRadius: thick * 1.5 },
              ]}
            />
            <View
              style={[
                styles.abs,
                rect(pending, thick * 1.5),
                { backgroundColor: colors[state.current], borderRadius: thick },
              ]}
            />
          </>
        )}
        {Array.from({ length: state.rows + 1 }, (_, r) =>
          Array.from({ length: state.cols + 1 }, (_, c) => (
            <View
              key={`d${r}-${c}`}
              style={[
                styles.abs,
                {
                  left: pad + c * cell - dot,
                  top: pad + r * cell - dot,
                  width: dot * 2,
                  height: dot * 2,
                  borderRadius: dot,
                  backgroundColor: theme.ink,
                },
              ]}
            />
          )),
        )}
      </View>
      {/* Touch layer on top. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  box: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  mark: { fontWeight: '700', includeFontPadding: false },
});
