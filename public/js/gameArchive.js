/**
 * Communal Game Archive Manager
 * Stores completed games to database (Firebase Realtime Database & WebSocket server)
 * and localStorage, synchronizes room archives, and renders interactive past games cards.
 */

export class GameArchiveManager {
  constructor(db, currentRoomId) {
    this.db = db;
    this.currentRoomId = currentRoomId;
    this.archives = [];
    this.listeners = [];
    this.initStorage();
  }

  initStorage() {
    try {
      const stored = localStorage.getItem('communal_game_archives');
      if (stored) {
        this.archives = JSON.parse(stored);
      }
    } catch (e) {
      this.archives = [];
    }
  }

  setRoom(roomId) {
    this.currentRoomId = roomId;
    this.listenToRoomArchives();
  }

  listenToRoomArchives() {
    if (!this.db || !this.currentRoomId) return;

    // Listen on rooms/${roomId}/archives
    const archivesRef = this.db.ref(`rooms/${this.currentRoomId}/archives`);
    archivesRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        const remoteList = Object.values(data);
        // Merge with local archives without duplicates
        const map = new Map();
        this.archives.forEach(g => map.set(g.id, g));
        remoteList.forEach(g => {
          if (g && g.id) map.set(g.id, g);
        });
        this.archives = Array.from(map.values()).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
        this.persistLocal();
        this.notify();
      }
    });

    // Also listen on global game_history
    const historyRef = this.db.ref('game_history');
    historyRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        const remoteList = Object.values(data);
        const map = new Map();
        this.archives.forEach(g => map.set(g.id, g));
        remoteList.forEach(g => {
          if (g && g.id && (!g.roomId || g.roomId === this.currentRoomId)) {
            map.set(g.id, g);
          }
        });
        this.archives = Array.from(map.values()).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
        this.persistLocal();
        this.notify();
      }
    });
  }

  persistLocal() {
    try {
      localStorage.setItem('communal_game_archives', JSON.stringify(this.archives.slice(0, 50)));
    } catch (e) {}
  }

  onChange(callback) {
    this.listeners.push(callback);
  }

  notify() {
    this.listeners.forEach(cb => cb(this.getPastGames()));
  }

  /**
   * Save a completed or archived game record
   */
  async saveGame(record) {
    if (!record || !record.history || record.history.length === 0) return null;

    const gameId = record.id || `game_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    // Extract unique player names
    const whitePlayers = [...new Set((record.history || [])
      .filter((m, idx) => m.color === 'w' || m.color === 'red' || idx % 2 === 0)
      .map(m => m.playerName || 'Player'))];
    const blackPlayers = [...new Set((record.history || [])
      .filter((m, idx) => m.color === 'b' || m.color === 'black' || idx % 2 === 1)
      .map(m => m.playerName || 'Player'))];

    const fullRecord = {
      id: gameId,
      roomId: record.roomId || this.currentRoomId,
      gameType: record.gameType || 'chess',
      status: record.status || 'completed',
      winner: record.winner || 'draw',
      reason: record.reason || 'Game Completed',
      createdAt: record.createdAt || (record.history[0] ? record.history[0].timestamp : Date.now()),
      completedAt: Date.now(),
      moveCount: record.history.length,
      history: record.history,
      initialFen: record.initialFen || null,
      finalFen: record.finalFen || record.fen || null,
      players: {
        white: whitePlayers,
        black: blackPlayers
      }
    };

    // Save locally
    const existingIdx = this.archives.findIndex(g => g.id === gameId);
    if (existingIdx >= 0) {
      this.archives[existingIdx] = fullRecord;
    } else {
      this.archives.unshift(fullRecord);
    }
    this.persistLocal();
    this.notify();

    // Save to Firebase RTDB & WebSocket
    if (this.db) {
      try {
        const roomArchiveRef = this.db.ref(`rooms/${fullRecord.roomId}/archives/${gameId}`);
        await roomArchiveRef.set(fullRecord);

        const globalHistoryRef = this.db.ref(`game_history/${gameId}`);
        await globalHistoryRef.set(fullRecord);
      } catch (err) {
        console.warn("[GameArchive] Error syncing archive to database:", err.message);
      }
    }

    return fullRecord;
  }

  getPastGames() {
    return this.archives.filter(g => !g.roomId || g.roomId === this.currentRoomId);
  }

  getGameById(gameId) {
    return this.archives.find(g => g.id === gameId);
  }

  formatDate(ts) {
    if (!ts) return 'Recent';
    const date = new Date(ts);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Render the past games list into container
   */
  renderArchiveList(containerEl, onReplay, onAnalyze) {
    if (!containerEl) return;
    containerEl.innerHTML = '';

    const games = this.getPastGames();

    if (games.length === 0) {
      containerEl.innerHTML = `
        <div class="archive-empty">
          <div class="archive-empty-icon">🏆</div>
          <h4>No Past Games in this Room Yet</h4>
          <p>Complete a match or click <strong>⚡ Reset</strong> during a live game to automatically save the game to history.</p>
        </div>
      `;
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'archive-list-wrapper';

    games.forEach((game, idx) => {
      const card = document.createElement('div');
      card.className = 'archive-game-card';

      const isWhiteWin = game.winner === 'w' || game.winner === 'red';
      const isBlackWin = game.winner === 'b' || game.winner === 'black';
      const isDraw = game.winner === 'draw';

      let outcomeBadge = '⚡ Finished';
      let outcomeClass = 'outcome-draw';
      if (isWhiteWin) {
        outcomeBadge = '⚪ White Victory';
        outcomeClass = 'outcome-white';
      } else if (isBlackWin) {
        outcomeBadge = '⚫ Black Victory';
        outcomeClass = 'outcome-black';
      } else if (isDraw) {
        outcomeBadge = '🤝 Draw';
        outcomeClass = 'outcome-draw';
      }

      const whiteMoverNames = (game.players && game.players.white && game.players.white.length > 0)
        ? game.players.white.join(', ')
        : 'Unknown';
      const blackMoverNames = (game.players && game.players.black && game.players.black.length > 0)
        ? game.players.black.join(', ')
        : 'Unknown';

      const gameTypeIcon = game.gameType === 'xiangqi' ? '🀄' :
                           game.gameType === 'go' ? '⚫' :
                           game.gameType === 'shogi' ? '☖' : '♟️';

      card.innerHTML = `
        <div class="archive-card-header">
          <span class="archive-game-type">${gameTypeIcon} ${(game.gameType || 'chess').toUpperCase()}</span>
          <span class="archive-outcome-pill ${outcomeClass}">${outcomeBadge}</span>
          <span class="archive-date">${this.formatDate(game.completedAt)}</span>
        </div>

        <div class="archive-card-body">
          <div class="archive-movers-line">
            <div class="mover-group">
              <span class="mover-label">⚪ White Movers:</span>
              <strong class="mover-names">${this.escapeHtml(whiteMoverNames)}</strong>
            </div>
            <div class="mover-group">
              <span class="mover-label">⚫ Black Movers:</span>
              <strong class="mover-names">${this.escapeHtml(blackMoverNames)}</strong>
            </div>
          </div>
          <div class="archive-stats-row">
            <span>Moves: <strong>${game.moveCount || (game.history ? game.history.length : 0)} plies</strong></span>
            <span>Reason: <em>${this.escapeHtml(game.reason || game.status || 'Checkmate')}</em></span>
          </div>
        </div>

        <div class="archive-card-actions">
          <button class="btn-archive-replay" title="Step through board moves locally">
            👁️ Replay Moves
          </button>
          <button class="btn-archive-analyze" title="Run Stockfish evaluation on this match">
            📊 Analyze Game
          </button>
        </div>
      `;

      card.querySelector('.btn-archive-replay').addEventListener('click', () => {
        if (onReplay) onReplay(game);
      });

      card.querySelector('.btn-archive-analyze').addEventListener('click', () => {
        if (onAnalyze) onAnalyze(game);
      });

      wrapper.appendChild(card);
    });

    containerEl.appendChild(wrapper);
  }
}
