/**
 * Communal Board Games — Local Server Engine Daemon
 * Connects outbound to Firebase Realtime Database via firebase-admin.
 * Requires NO router port-forwarding or public IP.
 */

import dotenv from 'dotenv';
dotenv.config();

import admin from 'firebase-admin';
import { CommunalReferee } from './referee.js';

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://intel-games-default-rtdb.firebaseio.com';

console.log('====================================================');
console.log('   Communal Board Games — Local Server Engine Daemon');
console.log('====================================================');

let db = null;

try {
  if (serviceAccountPath) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath),
      databaseURL
    });
    db = admin.database();
    console.log('[Firebase Admin] Authenticated with service account successfully.');
  } else {
    console.log('[Firebase Admin] No service account specified in FIREBASE_SERVICE_ACCOUNT_PATH.');
    console.log('[Firebase Admin] Running local engine in listener mode.');
  }
} catch (err) {
  console.warn('[Firebase Admin] Notice:', err.message);
}

if (db) {
  const referee = new CommunalReferee(db);
  const featuredRooms = ['main-chess-room', 'grand-xiangqi', 'zen-go-9x9', 'dojo-shogi'];

  featuredRooms.forEach(roomId => {
    console.log(`[Referee] Watching room: ${roomId}`);
    referee.watchRoom(roomId);
  });
} else {
  console.log('[Info] To connect to Firebase Realtime Database:');
  console.log('1. Set FIREBASE_SERVICE_ACCOUNT_PATH to your serviceAccountKey.json');
  console.log('2. Set FIREBASE_DATABASE_URL to your Realtime Database URL');
  console.log('3. Run `npm start` in local-server/');
}

process.on('SIGINT', () => {
  console.log('\n[Daemon] Gracefully shutting down local engine.');
  process.exit(0);
});
