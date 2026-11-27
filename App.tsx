import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { DEFAULT_OPTIONS, GameOptions } from './config';
import { LookProvider, makeLook } from './look';
import { Game } from './screens/Game';
import { Menu } from './screens/Menu';
import { Setup } from './screens/Setup';
import { DEFAULT_SETTINGS, Settings } from './theme';

// Menu (pick a size) -> setup (opponent, theme, colors) -> game.
type Screen = { name: 'menu' } | { name: 'setup' | 'game'; size: number };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [options, setOptions] = useState<GameOptions>(DEFAULT_OPTIONS);
  const look = useMemo(() => makeLook(settings), [settings]);

  return (
    <SafeAreaProvider>
      <LookProvider value={look}>
        <SafeAreaView style={[styles.root, { backgroundColor: look.theme.bg }]}>
          <StatusBar style={look.theme.statusBar} />
          {screen.name === 'menu' && (
            <Menu onPick={(size) => setScreen({ name: 'setup', size })} />
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
