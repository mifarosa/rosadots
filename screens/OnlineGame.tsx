import { ReactNode, useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, QuietButton } from '../components/Buttons';
import { GameView } from '../components/GameView';
import { isOver, Move, movesBy, Player } from '../game';
import { LookProvider, makeOnlineLook, useLook } from '../look';
import { OnlineSession, OnlineSnapshot } from '../online/session';
import { Settings } from '../theme';

const same = (a: Move, b: Move) => a.kind === b.kind && a.r === b.r && a.c === b.c;

// Re-renders every `ms` while `active`, so a countdown can tick.
function useNow(active: boolean, ms = 250): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

function Waiting({ code, onCancel }: { code: string; onCancel: () => void }) {
  const { theme, colors } = useLook();
  return (
    <View style={styles.waiting}>
      <Text style={[styles.hint, { color: theme.muted }]}>Oda kodu</Text>
      <Text style={[styles.code, { color: colors[0] }]}>{code}</Text>
      <Text style={[styles.hint, { color: theme.ink }]}>Arkadaşına bu kodu ver, katılınca oyun başlar.</Text>
      <PrimaryButton
        label="Kodu paylaş"
        onPress={() => void Share.share({ message: `Rosadots'ta benimle oyna! Oda kodu: ${code}` })}
      />
      <Text style={[styles.hint, { color: theme.muted }]}>Rakip bekleniyor…</Text>
      <QuietButton label="Vazgeç" onPress={onCancel} />
    </View>
  );
}

export function OnlineGame({
  snap,
  session,
  settings,
  onExit,
}: {
  snap: OnlineSnapshot;
  session: OnlineSession;
  settings: Settings;
  onExit: () => void;
}) {
  const room = snap.room!;
  const game = snap.game;
  const seat = room.seat;
  const other = (1 - seat) as Player;
  // This phone's player wears my color, the opponent theirs.
  const look = makeOnlineLook(settings, seat, room.seats[other]?.color);

  // Line selected but not confirmed, and whether it is on its way to the server.
  const [pending, setPending] = useState<Move | null>(null);
  const [sent, setSent] = useState(false);
  const [missed, setMissed] = useState(false);
  const moves = game?.history.length ?? 0;
  // A new game state (or an error) from the server ends the selection.
  useEffect(() => {
    setPending(null);
    setSent(false);
  }, [moves, snap.error]);

  const now = useNow(snap.deadline !== null);

  if (!game) {
    return (
      <LookProvider value={look}>
        <Waiting
          code={room.code}
          onCancel={() => {
            session.leave();
            onExit();
          }}
        />
      </LookProvider>
    );
  }

  const over = isOver(game);
  const myTurn = !over && game.current === seat && !sent;
  const opponentOnline = room.seats[other]?.connected !== false;

  const confirm = () => {
    if (!pending || !myTurn) return;
    session.move(pending);
    setSent(true);
  };
  const onTap = (m: Move) => {
    if (!myTurn) return;
    setMissed(false);
    if (pending && same(pending, m)) confirm();
    else setPending(m);
  };

  const leave = () => {
    session.leave();
    onExit();
  };
  const askLeave = () =>
    over || snap.opponentLeft
      ? leave()
      : Alert.alert('Oyundan çıkılsın mı?', 'Oda kapanır, rakip oyunu kazanmış sayılmaz.', [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Çık', style: 'destructive', onPress: leave },
        ]);

  // One strip at a time, the most important first.
  let banner: ReactNode = null;
  if (snap.opponentLeft) {
    banner = <Strip text="Rakip oyundan ayrıldı"><PrimaryButton label="Lobiye dön" onPress={session.leave} /></Strip>;
  } else if (snap.undo === 'incoming') {
    banner = (
      <Strip text="Rakip son hamlesini geri almak istiyor">
        <QuietButton label="Kabul et" onPress={() => session.answerUndo(true)} />
        <QuietButton label="Reddet" onPress={() => session.answerUndo(false)} />
      </Strip>
    );
  } else if (snap.link !== 'online') {
    banner = <Strip text="Bağlantı koptu, yeniden bağlanılıyor…" />;
  } else if (snap.undo === 'asked') {
    banner = <Strip text="Geri alma isteği gönderildi…" />;
  } else if (snap.notice) {
    banner = <Strip text={snap.notice} />;
  } else if (over) {
    banner = (
      <Strip text={snap.rematch === 'incoming' ? 'Rakip rövanş istiyor' : ''}>
        <PrimaryButton
          label={snap.rematch === 'asked' ? 'Rakip bekleniyor…' : 'Rövanş'}
          disabled={snap.rematch === 'asked'}
          onPress={session.askRematch}
        />
      </Strip>
    );
  }

  const canUndo =
    !over && snap.undo === 'none' && snap.link === 'online' && opponentOnline && movesBy(game, seat) > 0;
  const names: [string, string] = ['', ''];
  names[seat] = 'Sen';
  names[other] = 'Rakip';
  const kinds: ['local' | 'remote', 'local' | 'remote'] = ['remote', 'remote'];
  kinds[seat] = 'local';
  const offline: [boolean, boolean] = [false, false];
  offline[other] = !opponentOnline;

  return (
    <LookProvider value={look}>
      <GameView
        state={game}
        pending={pending}
        missed={missed}
        bottom={seat}
        kinds={kinds}
        names={names}
        flipTop={false}
        clock={
          snap.deadline !== null && !over
            ? { player: game.current, seconds: Math.max(0, Math.ceil((snap.deadline - now) / 1000)) }
            : null
        }
        offline={offline}
        banner={banner}
        onTap={onTap}
        onMiss={() => myTurn && setMissed(true)}
        onConfirm={confirm}
        footer={
          <>
            <QuietButton label="Çık" onPress={askLeave} />
            <QuietButton label="Geri Al İste" disabled={!canUndo} onPress={session.askUndo} />
          </>
        }
      />
    </LookProvider>
  );
}

// A short message with optional buttons, shown above the bottom panel.
function Strip({ text, children }: { text: string; children?: ReactNode }) {
  const { theme } = useLook();
  return (
    <View style={styles.strip}>
      {text !== '' && <Text style={[styles.stripText, { color: theme.ink }]}>{text}</Text>}
      {children && <View style={styles.stripButtons}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 16 },
  code: { fontSize: 56, fontWeight: '800', letterSpacing: 8 },
  hint: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  strip: { alignItems: 'center', gap: 6 },
  stripText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  stripButtons: { flexDirection: 'row', gap: 10 },
});
