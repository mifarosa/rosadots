import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, QuietButton, Segmented } from '../components/Buttons';
import { GameOptions, playerNames } from '../config';
import { useLook } from '../look';
import { COLOR_IDS, COLOR_NAMES, PALETTE, pickColor, Settings, textOn } from '../theme';

function Field({ title, children }: { title: string; children: React.ReactNode }) {
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
function ColorField({
  who,
  name,
  settings,
  onSettings,
}: {
  who: 'p1' | 'p2';
  name: string;
  settings: Settings;
  onSettings: (s: Settings) => void;
}) {
  const { theme } = useLook();
  const other = who === 'p1' ? 'p2' : 'p1';
  return (
    <Field title={`${name}: ${COLOR_NAMES[settings[who]]}`}>
      <View style={styles.swatches}>
        {COLOR_IDS.map((id) => {
          const hex = PALETTE[settings.theme][id];
          const badge = id === settings[who] ? '✓' : id === settings[other] ? (other === 'p1' ? '1' : '2') : '';
          return (
            <Pressable
              key={id}
              onPress={() => onSettings(pickColor(settings, who, id))}
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

export function Setup({
  size,
  settings,
  options,
  onSettings,
  onOptions,
  onStart,
  onBack,
}: {
  size: number;
  settings: Settings;
  options: GameOptions;
  onSettings: (s: Settings) => void;
  onOptions: (o: GameOptions) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const { theme } = useLook();
  const names = playerNames(options);
  return (
    <ScrollView contentContainerStyle={styles.setup}>
      <Text style={[styles.title, { color: theme.ink }]}>
        {size} x {size} oyun
      </Text>
      <Field title="Rakip">
        <Segmented
          value={options.opponent}
          onChange={(opponent) => onOptions({ ...options, opponent })}
          options={[
            { value: 'friend', label: '👥 Arkadaş' },
            { value: 'cpu', label: '🤖 Bilgisayar' },
          ]}
        />
      </Field>
      {options.opponent === 'cpu' && (
        <Field title="Zorluk">
          <Segmented
            value={options.level}
            onChange={(level) => onOptions({ ...options, level })}
            options={[
              { value: 'easy', label: 'Kolay' },
              { value: 'medium', label: 'Orta' },
            ]}
          />
        </Field>
      )}
      <Field title="Tema">
        <Segmented
          value={settings.theme}
          onChange={(t) => onSettings({ ...settings, theme: t })}
          options={[
            { value: 'light', label: '☀️ Açık' },
            { value: 'dark', label: '🌙 Koyu' },
          ]}
        />
      </Field>
      <ColorField who="p1" name={names[0]} settings={settings} onSettings={onSettings} />
      <ColorField who="p2" name={names[1]} settings={settings} onSettings={onSettings} />
      <PrimaryButton label="Başla" onPress={onStart} />
      <QuietButton label="Geri" onPress={onBack} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  setup: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 16 },
  title: { fontSize: 28, fontWeight: '800' },
  field: { alignItems: 'center', gap: 8 },
  fieldTitle: { fontSize: 16, fontWeight: '700' },
  swatches: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  swatch: { width: 46, height: 46, borderRadius: 23, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  badge: { fontSize: 18, fontWeight: '800' },
});
