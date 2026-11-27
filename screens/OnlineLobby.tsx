import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { PrimaryButton, QuietButton, Segmented } from '../components/Buttons';
import { ColorField, Field } from '../components/Fields';
import { BOARD_SIZES } from '../game';
import { useLook } from '../look';
import { OnlineSession, OnlineSnapshot } from '../online/session';
import { ErrorReason, normalizeCode, ROOM_CODE_LENGTH, TURN_SECONDS } from '../protocol';
import { Settings } from '../theme';

const ERROR_TEXT: Partial<Record<ErrorReason, string>> = {
  bad_message: 'Bir şeyler ters gitti, tekrar dene',
  not_found: 'Böyle bir oda bulunamadı',
  full: 'Bu oda dolu',
  bad_token: 'Oda bulunamadı',
  rate_limited: 'Çok hızlı denedin, biraz bekle',
  server_busy: 'Sunucu şu an dolu, biraz sonra dene',
};

const SIZE_OPTIONS = BOARD_SIZES.map((n) => ({ value: String(n), label: `${n}x${n}` }));
const TIME_OPTIONS = TURN_SECONDS.map((s) => ({ value: String(s), label: s === 0 ? 'Süresiz' : `${s} sn` }));

// Before there is a room: make one, join one by code, or find a stranger.
export function OnlineLobby({
  snap,
  session,
  settings,
  onSettings,
  onBack,
}: {
  snap: OnlineSnapshot;
  session: OnlineSession;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onBack: () => void;
}) {
  const { theme } = useLook();
  const [size, setSize] = useState(6);
  const [turnSeconds, setTurnSeconds] = useState(0);
  const [code, setCode] = useState('');
  const connected = snap.link === 'online';
  const color = settings.p1;

  return (
    <ScrollView contentContainerStyle={styles.lobby} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: theme.ink }]}>Online oyun</Text>
      {!connected && (
        <Text style={[styles.status, { color: theme.muted }]}>Sunucuya bağlanılıyor…</Text>
      )}
      {snap.error && ERROR_TEXT[snap.error] && (
        <Text style={styles.error} onPress={session.dismissError}>
          {ERROR_TEXT[snap.error]}
        </Text>
      )}

      <ColorField who="p1" name="Rengin" settings={settings} onSettings={onSettings} solo />
      <Field title="Tahta">
        <Segmented value={String(size)} onChange={(v) => setSize(Number(v))} options={SIZE_OPTIONS} />
      </Field>

      {snap.queued ? (
        <Field title="Rakip aranıyor… 🔎">
          <QuietButton label="Vazgeç" onPress={session.cancelQuick} />
        </Field>
      ) : (
        <PrimaryButton label="Hızlı eşleşme" disabled={!connected} onPress={() => session.quick(size, color)} />
      )}

      <Field title="Arkadaşınla oyna">
        <Segmented
          value={String(turnSeconds)}
          onChange={(v) => setTurnSeconds(Number(v))}
          options={TIME_OPTIONS}
        />
        <PrimaryButton label="Oda kur" disabled={!connected} onPress={() => session.create(size, turnSeconds, color)} />
        <TextInput
          value={code}
          onChangeText={(t) => setCode(normalizeCode(t))}
          placeholder="ODA KODU"
          placeholderTextColor={theme.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={ROOM_CODE_LENGTH}
          style={[styles.input, { color: theme.ink, borderColor: theme.border, backgroundColor: theme.panel }]}
        />
        <PrimaryButton
          label="Koda katıl"
          disabled={!connected || code.length !== ROOM_CODE_LENGTH}
          onPress={() => session.join(code, color)}
        />
      </Field>

      <QuietButton label="Geri" onPress={onBack} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  lobby: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 16 },
  title: { fontSize: 28, fontWeight: '800' },
  status: { fontSize: 14 },
  error: { color: '#e5484d', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  input: {
    width: 200,
    paddingVertical: 10,
    borderWidth: 2,
    borderRadius: 14,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
  },
});
