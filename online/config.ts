// Address of the online server. Production builds need wss:// (TLS): iOS blocks
// plain ws://. While developing with Expo Go, point it at your computer, for
// example EXPO_PUBLIC_ONLINE_URL=ws://192.168.1.20:8787 in a .env file.
export const ONLINE_URL = process.env.EXPO_PUBLIC_ONLINE_URL ?? 'wss://rosadots.mifarosa.com';
