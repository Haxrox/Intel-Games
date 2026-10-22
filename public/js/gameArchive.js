/**
 * Communal Game Archive Manager
 * Stores completed games to database (Firebase Realtime Database & WebSocket server)
 * and localStorage, synchronizes room archives, and renders interactive past games cards.
 */

/**
 * Computes a unique, deterministic fingerprint for a game match based on its
 * room, game type, ply count, starting timestamp (if recorded), and move sequence.
 */
export function getGameFingerprint(record) {
  if (!record) return '';
  const roomId = record.roomId || 'room';
  const gameType = record.gameType || 'chess';
  const history = record.history || [];
  const moveCount = history.length;
  if (moveCount === 0) {
    return record.id || `empty_${roomId}_${record.completedAt || 0}`;
  }
  const firstMoveTs = (history[0] && history[0].timestamp) ? history[0].timestamp : '';
  const moveSequence = history.map(m => `${m.from || ''}${m.to || ''}${m.san || ''}`).join('-');
  return `${roomId}:${gameType}:${moveCount}:${firstMoveTs}:${moveSequence}`;
}

/**
 * Generates a deterministic match ID from the game's contents so that multiple
 * clients or repeated archive calls produce the exact same ID.
 */
export function generateDeterministicId(record) {
  if (record && record.id) return record.id;
  const history = (record && record.history) || [];
  const roomId = (record && record.roomId) || 'room';
  const gameType = (record && record.gameType) || 'chess';
  const moveCount = history.length;
  const firstMoveTs = (history[0] && history[0].timestamp) ? history[0].timestamp : '';
  const moveSequence = history.map(m => `${m.from || ''}${m.to || ''}${m.san || ''}`).join('-');
  const rawKey = `${roomId}_${gameType}_${moveCount}_${firstMoveTs}_${moveSequence}`;

  let hash = 0;
  for (let i = 0; i < rawKey.length; i++) {
    hash = ((hash << 5) - hash) + rawKey.charCodeAt(i);
    hash |= 0;
  }
  const hashStr = Math.abs(hash).toString(36);
  return `game_${gameType}_${moveCount}m_${hashStr}`;
}

export class GameArchiveManager {
  constructor(db, currentRoomId) {
    this.db = db;
    this.currentRoomId = currentRoomId;
    this.archives = [];
    this.listeners = [];
    this.activeArchivesRef = null;
    this.activeArchivesCb = null;
    this.hasAttachedRoomListeners = false;
    this.initStorage();
  }

  /**
   * Deduplicate a list of archives using game fingerprints, keeping the most
   * detailed and canonical record.
   */
  deduplicateArchives(list) {
    if (!Array.isArray(list)) return [];
    const fpMap = new Map();

    list.forEach(game => {
      if (!game) return;
      const fp = getGameFingerprint(game);
      if (!fp) return;

      if (!fpMap.has(fp)) {
        fpMap.set(fp, game);
      } else {
        const existing = fpMap.get(fp);
        // Prefer more detailed reason / status if one is generic
        const preferIncoming =
          (existing.reason === 'Completed before Reset' || existing.reason === 'Manual Save') &&
          (game.reason && game.reason !== 'Completed before Reset' && game.reason !== 'Manual Save');

        if (preferIncoming) {
          fpMap.set(fp, { ...existing, ...game, id: existing.id || game.id });
        }
      }
    });

    return Array.from(fpMap.values()).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  }

  initStorage() {
    try {
      const stored = localStorage.getItem('communal_game_archives');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.archives = this.deduplicateArchives(parsed);
      }
    } catch (e) {
      this.archives = [];
    }
  }

  setRoom(roomId) {
    if (this.currentRoomId === roomId && this.hasAttachedRoomListeners) return;
    this.currentRoomId = roomId;
    this.listenToRoomArchives();
  }

  listenToRoomArchives() {
    if (!this.db || !this.currentRoomId) return;

    // Detach previous room listener if attached
    if (this.activeArchivesRef && this.activeArchivesCb) {
      if (typeof this.activeArchivesRef.off === 'function') {
        this.activeArchivesRef.off('value', this.activeArchivesCb);
      }
    }

    // Listen on rooms/${roomId}/archives
    this.activeArchivesRef = this.db.ref(`rooms/${this.currentRoomId}/archives`);
    this.activeArchivesCb = (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        const remoteList = Object.values(data);
        const merged = [...this.archives, ...remoteList];
        this.archives = this.deduplicateArchives(merged);
        this.persistLocal();
        this.notify();
      }
    };
    this.activeArchivesRef.on('value', this.activeArchivesCb);
    this.hasAttachedRoomListeners = true;
  }

  persistLocal() {
    try {
      this.archives = this.deduplicateArchives(this.archives);
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

    const gameId = record.id || generateDeterministicId(record);
    const gameFp = getGameFingerprint({ ...record, id: gameId });

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

    // Save locally with deduplication by id and fingerprint
    const existingIdx = this.archives.findIndex(g => g.id === gameId || getGameFingerprint(g) === gameFp);
    if (existingIdx >= 0) {
      this.archives[existingIdx] = { ...this.archives[existingIdx], ...fullRecord, id: gameId };
    } else {
      this.archives.unshift(fullRecord);
    }
    this.archives = this.deduplicateArchives(this.archives);
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
    const list = this.archives.filter(g => !g.roomId || g.roomId === this.currentRoomId);
    return this.deduplicateArchives(list);
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

    const seenFp = new Set();
    games.forEach((game) => {
      const fp = getGameFingerprint(game);
      if (seenFp.has(fp)) return;
      seenFp.add(fp);

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

