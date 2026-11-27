import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../components/Buttons';
import { BOARD_SIZES } from '../game';
import { useLook } from '../look';

export function Menu({ onPick, onOnline }: { onPick: (size: number) => void; onOnline: () => void }) {
  const { theme, colors } = useLook();
  return (
    <View style={styles.menu}>
      <Text style={[styles.title, { color: colors[0] }]}>Rosadots</Text>
      <Text style={[styles.subtitle, { color: theme.ink }]}>Noktalar ve Kutular</Text>
      <Text style={[styles.label, { color: theme.muted }]}>Tahta boyutu</Text>
      {BOARD_SIZES.map((n) => (
        <PrimaryButton key={n} label={`${n} x ${n}`} onPress={() => onPick(n)} />
      ))}
      <Text style={[styles.label, styles.gap, { color: theme.muted }]}>İnternetten</Text>
      <PrimaryButton label="🌐 Online oyna" onPress={onOnline} />
    </View>
  );
}

const styles = StyleSheet.create({
  menu: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 44, fontWeight: '800' },
  subtitle: { fontSize: 18, marginBottom: 24 },
  label: { fontSize: 14, marginBottom: 4 },
  gap: { marginTop: 14 },
});
