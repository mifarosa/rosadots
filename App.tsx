import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { DEFAULT_OPTIONS, GameOptions } from './config';
import { LookProvider, makeLook } from './look';
import { ONLINE_URL } from './online/config';
import { OnlineSession } from './online/session';
import { roomStorage } from './online/storage';
import { Game } from './screens/Game';
import { Menu } from './screens/Menu';
import { Online } from './screens/Online';
import { Setup } from './screens/Setup';
import { DEFAULT_SETTINGS, Settings } from './theme';

// Menu (pick a size) -> setup (opponent, theme, colors) -> game, or menu -> online.
type Screen = { name: 'menu' } | { name: 'online' } | { name: 'setup' | 'game'; size: number };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [options, setOptions] = useState<GameOptions>(DEFAULT_OPTIONS);
  const look = useMemo(() => makeLook(settings), [settings]);
  const session = useMemo(() => new OnlineSession(ONLINE_URL, roomStorage), []);

  return (
    <SafeAreaProvider>
      <LookProvider value={look}>
        <SafeAreaView style={[styles.root, { backgroundColor: look.theme.bg }]}>
          <StatusBar style={look.theme.statusBar} />
          {screen.name === 'menu' && (
            <Menu
              onPick={(size) => setScreen({ name: 'setup', size })}
              onOnline={() => setScreen({ name: 'online' })}
            />
          )}
          {screen.name === 'online' && (
            <Online
              session={session}
              settings={settings}
              onSettings={setSettings}
              onExit={() => setScreen({ name: 'menu' })}
            />
          )}
          {screen.name === 'setup' && (
            <Setup
              size={screen.size}
              settings={settings}
              options={options}
              onSettings={setSettings}
              onOptions={setOptions}
              onStart={() => setScreen({ name: 'game', size: screen.size })}
              onBack={() => setScreen({ name: 'menu' })}
            />
          )}
          {screen.name === 'game' && (
            <Game size={screen.size} options={options} onExit={() => setScreen({ name: 'menu' })} />
          )}
        </SafeAreaView>
      </LookProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
