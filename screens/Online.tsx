import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { OnlineSession } from '../online/session';
import { Settings } from '../theme';
import { OnlineGame } from './OnlineGame';
import { OnlineLobby } from './OnlineLobby';

// Keeps the connection alive while this screen is open and shows the lobby
// (no room yet) or the game (in a room).
export function Online({
  session,
  settings,
  onSettings,
  onExit,
}: {
  session: OnlineSession;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onExit: () => void;
}) {
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot);

  useEffect(() => {
    void session.open();
    // A phone often cuts the socket in the background: reconnect on return.
    const sub = AppState.addEventListener('change', (s) => s === 'active' && session.reconnectNow());
    return () => {
      sub.remove();
      session.close();
    };
  }, [session]);

  return snap.room ? (
    <OnlineGame snap={snap} session={session} settings={settings} onExit={onExit} />
  ) : (
    <OnlineLobby snap={snap} session={session} settings={settings} onSettings={onSettings} onBack={onExit} />
  );
}
