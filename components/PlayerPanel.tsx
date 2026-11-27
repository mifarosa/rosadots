import { StyleSheet, Text, View } from 'react-native';
import { GameState, isOver, Move, Player, winner } from '../game';
import { useLook } from '../look';
import { ConfirmButton } from './Buttons';

// local:  a person on this phone (has a confirm button)
// cpu:    the computer
// remote: a person on another phone, seen from here
export type PanelKind = 'local' | 'cpu' | 'remote';

function panelText(o: {
  state: GameState;
  p: Player;
  kind: PanelKind;
  pending: Move | null;
  missed: boolean;
  offline: boolean;
}): string {
  const { state, p, kind, pending, missed, offline } = o;
  if (isOver(state)) {
    const w = winner(state);
    if (w === 'draw') return 'Berabere! 🤝';
    if (kind === 'cpu') return w === p ? 'Kazandım! 😎' : 'Kazandın, tebrikler!';
    if (kind === 'remote') return w === p ? 'Rakip kazandı' : 'Rakip kaybetti';
    return w === p ? '🎉 Kazandın!' : 'Oyun bitti';
  }
  if (kind === 'remote' && offline) return 'Bağlantı koptu, bekleniyor…';
  if (state.current !== p) return kind === 'local' ? 'Rakip oynuyor…' : 'Sıra sende!';
  if (kind !== 'local') return 'Düşünüyor… 🤔';
  if (missed) return 'Çizgiye biraz daha yakın dokun 👆';
  return pending ? 'Bu çizgi mi? Tekrar dokun ya da ✓ Çiz' : 'Sıra sende! Bir çizgi seç';
}

export function PlayerPanel({
  p,
  name,
  kind,
  state,
  pending,
  missed,
  flipped,
  offline = false,
  seconds = null,
  onConfirm,
}: {
  p: Player;
  name: string;
  kind: PanelKind;
  state: GameState;
  pending: Move | null;
  missed: boolean;
  flipped: boolean; // rotate 180 degrees so the player across the table can read it
  offline?: boolean; // a remote player lost the connection
  seconds?: number | null; // time left to move, when there is a limit
  onConfirm: () => void;
}) {
  const { theme, colors, tints } = useLook();
  const active = !isOver(state) && state.current === p;

  return (
    <View
      style={[
        styles.panel,
        { borderColor: colors[p], backgroundColor: active ? tints[p] : theme.panel },
        flipped && { transform: [{ rotate: '180deg' }] },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.score}>
          <Text style={[styles.name, { color: colors[p] }]}>{name}</Text>
          <Text style={[styles.scoreValue, { color: theme.ink }]}>{state.scores[p]}</Text>
          {active && seconds !== null && (
            <Text style={[styles.clock, { color: seconds <= 5 ? '#e5484d' : theme.muted }]}>⏱ {seconds}</Text>
          )}
        </View>
        {kind === 'local' && (
          <ConfirmButton color={colors[p]} disabled={!active || pending === null} onPress={onConfirm} />
        )}
      </View>
      <Text style={[styles.text, { color: theme.ink }]}>
        {panelText({ state, p, kind, pending, missed, offline })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { alignSelf: 'stretch', borderWidth: 2, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  score: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 14, fontWeight: '700' },
  scoreValue: { fontSize: 28, fontWeight: '800' },
  clock: { fontSize: 16, fontWeight: '700' },
  text: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
