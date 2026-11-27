import AsyncStorage from '@react-native-async-storage/async-storage';
import { RoomStorage, SavedRoom } from './session';

const KEY = 'rosadots.room';

export const roomStorage: RoomStorage = {
  async load() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const x = raw ? (JSON.parse(raw) as Partial<SavedRoom>) : null;
      return x && typeof x.code === 'string' && typeof x.token === 'string' ? { code: x.code, token: x.token } : null;
    } catch {
      return null;
    }
  },
  async save(room) {
    try {
      if (room) await AsyncStorage.setItem(KEY, JSON.stringify(room));
      else await AsyncStorage.removeItem(KEY);
    } catch {
      // Not being able to save only costs us the automatic rejoin.
    }
  },
};
