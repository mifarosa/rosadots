import { ScrollView, StyleSheet, Text } from 'react-native';
import { PrimaryButton, QuietButton, Segmented } from '../components/Buttons';
import { ColorField, Field } from '../components/Fields';
import { GameOptions, playerNames } from '../config';
import { useLook } from '../look';
import { Settings } from '../theme';

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
});
