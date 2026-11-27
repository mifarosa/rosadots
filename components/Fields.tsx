import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLook } from '../look';
import { COLOR_IDS, COLOR_NAMES, PALETTE, pickColor, Settings, textOn } from '../theme';

export function Field({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useLook();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldTitle, { color: theme.ink }]}>{title}</Text>
      {children}
    </View>
  );
}

// Round color choices for one player. A color held by the other player shows
// that player's number; tapping it swaps the two colors.
export function ColorField({
  who,
  name,
  settings,
  onSettings,
  solo,
}: {
  who: 'p1' | 'p2';
  name: string;
  settings: Settings;
  onSettings: (s: Settings) => void;
  solo?: boolean; // only this player picks: no swapping, no badge of the other player
}) {
  const { theme } = useLook();
  const other = who === 'p1' ? 'p2' : 'p1';
  return (
    <Field title={`${name}: ${COLOR_NAMES[settings[who]]}`}>
      <View style={styles.swatches}>
        {COLOR_IDS.map((id) => {
          const hex = PALETTE[settings.theme][id];
          const badge =
            id === settings[who] ? '✓' : !solo && id === settings[other] ? (other === 'p1' ? '1' : '2') : '';
          return (
            <Pressable
              key={id}
              onPress={() => onSettings(solo ? { ...settings, [who]: id } : pickColor(settings, who, id))}
              style={[
                styles.swatch,
                { backgroundColor: hex, borderColor: id === settings[who] ? theme.ink : 'transparent' },
              ]}
            >
              <Text style={[styles.badge, { color: textOn(hex) }]}>{badge}</Text>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

const styles = StyleSheet.create({
  field: { alignItems: 'center', gap: 8 },
  fieldTitle: { fontSize: 16, fontWeight: '700' },
  swatches: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  swatch: { width: 46, height: 46, borderRadius: 23, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  badge: { fontSize: 18, fontWeight: '800' },
});
