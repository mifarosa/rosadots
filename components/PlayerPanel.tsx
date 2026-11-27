import { StyleSheet, Text, View } from 'react-native';
import { GameState, isOver, Move, Player, winner } from '../game';
import { useLook } from '../look';
import { ConfirmButton } from './Buttons';

function panelText(o: {
  state: GameState;
  p: Player;
  isCpu: boolean;
  pending: Move | null;
  missed: boolean;
}): string {
  const { state, p, isCpu, pending, missed } = o;
  if (isOver(state)) {
    const w = winner(state);
    if (w === 'draw') return 'Berabere! 🤝';
    if (isCpu) return w === p ? 'Kazandım! 😎' : 'Kazandın, tebrikler!';
    return w === p ? '🎉 Kazandın!' : 'Oyun bitti';
  }
  if (state.current !== p) return isCpu ? 'Sıra sende!' : 'Rakip oynuyor…';
  if (isCpu) return 'Düşünüyor… 🤔';
  if (missed) return 'Çizgiye biraz daha yakın dokun 👆';
  return pending ? 'Bu çizgi mi? Tekrar dokun ya da ✓ Çiz' : 'Sıra sende! Bir çizgi seç';
}

export function PlayerPanel({
  p,
  name,
  state,
  pending,
  missed,
  flipped,
  isCpu,
  onConfirm,
}: {
  p: Player;
  name: string;
  state: GameState;
  pending: Move | null;
  missed: boolean;
  flipped: boolean; // rotate 180 degrees so the player across the table can read it
  isCpu: boolean; // the computer has no buttons to press
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
        </View>
        {!isCpu && (
          <ConfirmButton
            color={colors[p]}
            disabled={!active || pending === null}
            onPress={onConfirm}
          />
        )}
      </View>
      <Text style={[styles.text, { color: theme.ink }]}>
        {panelText({ state, p, isCpu, pending, missed })}
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
  text: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
