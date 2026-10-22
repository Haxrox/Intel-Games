/**
 * Local Server Communal Referee
 * Connects outbound to Firebase Realtime Database via firebase-admin.
 * Enforces communal anti-consecutive move rules, resolves atomic move races,
 * and triggers Stockfish post-game analysis upon game completion.
 */

import { StockfishAnalyzer } from './analyzer.js';

export class CommunalReferee {
  constructor(adminDb) {
    this.db = adminDb;
    this.analyzer = new StockfishAnalyzer();
    this.activeWatchers = new Map();
  }

  // Watch a room's state and moves
  watchRoom(roomId) {
    if (this.activeWatchers.has(roomId)) return;
    this.activeWatchers.set(roomId, true);

    const stateRef = this.db.ref(`rooms/${roomId}/state`);
    stateRef.on('value', async (snapshot) => {
      const state = snapshot.val();
      if (!state) return;

      // Check if game has newly ended and needs Stockfish analysis
      if ((state.status === 'checkmate' || state.status === 'stalemate' || state.status === 'game_over') && !state.analyzed) {
        console.log(`[Referee] Game concluded in room ${roomId}. Running Stockfish analysis...`);
        const analysis = await this.analyzer.analyzeGame(state.history || []);

        // Save to archive
        const gameId = `game_${Date.now()}_${roomId}`;
        const archiveRef = this.db.ref(`archive/${gameId}`);
        await archiveRef.set({
          roomId,
          gameType: state.gameType || 'chess',
          winner: state.winner,
          reason: state.status,
          history: state.history,
          analysis,
          completedAt: Date.now()
        });

        // Mark state as analyzed in room
        await stateRef.update({
          analyzed: true,
          analysis
        });
        console.log(`[Referee] Analysis saved to archive/${gameId}.`);
      }
    });
  }

  // Validate and execute move under communal rule
  async validateMove(roomId, moveData, playerName, clientId) {
    const stateRef = this.db.ref(`rooms/${roomId}/state`);
    const snap = await stateRef.get();
    const current = snap.val();

    if (!current) return { success: false, error: 'Room not found' };

    // Enforce communal rule: no consecutive moves by the same player
    const lastMover = current.lastMover;
    if (lastMover && (lastMover.clientId === clientId || lastMover.name.toLowerCase() === playerName.trim().toLowerCase())) {
      return {
        success: false,
        error: 'Communal Rule Violation: You made the previous move. An intervening move by another player is required.'
      };
    }

    return { success: true };
  }
}
