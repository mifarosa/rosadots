import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../components/Buttons';
import { useLook } from '../look';

const SIZES = [4, 6, 8, 12];

export function Menu({ onPick }: { onPick: (size: number) => void }) {
  const { theme, colors } = useLook();
  return (
    <View style={styles.menu}>
      <Text style={[styles.title, { color: colors[0] }]}>Rosadots</Text>
      <Text style={[styles.subtitle, { color: theme.ink }]}>Noktalar ve Kutular</Text>
      <Text style={[styles.label, { color: theme.muted }]}>Tahta boyutu</Text>
      {SIZES.map((n) => (
        <PrimaryButton key={n} label={`${n} x ${n}`} onPress={() => onPick(n)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 44, fontWeight: '800' },
  subtitle: { fontSize: 18, marginBottom: 24 },
  label: { fontSize: 14, marginBottom: 4 },
});
