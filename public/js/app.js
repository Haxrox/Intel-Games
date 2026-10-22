/**
 * Main Application Coordinator
 * Bridges Game Engines, Board Renderers, Firebase Realtime Database,
 * Communal Turn Rules, Synchronized Move Previews, Presence, and History.
 */

import { initFirebase } from './firebase-config.js';
import { ChessEngine } from './engines/chessEngine.js';
import { XiangqiEngine } from './engines/xiangqiEngine.js';
import { GoEngine } from './engines/goEngine.js';
import { ShogiEngine } from './engines/shogiEngine.js';

import { ChessRenderer } from './renderers/chessRenderer.js';
import { XiangqiRenderer } from './renderers/xiangqiRenderer.js';
import { GoRenderer } from './renderers/goRenderer.js';
import { ShogiRenderer } from './renderers/shogiRenderer.js';

import { PresenceManager } from './presence.js';
import { MoveStagingController } from './moveStaging.js';
import { PlayerListRenderer } from './playerlist.js';
import { HistoryController } from './historyController.js';
import { AnalysisView } from './analysisView.js';
import { sound } from './audio.js';

export class CommunalApp {
  constructor() {
    this.db = initFirebase();
    this.currentRoomId = 'main-chess-room';
    this.gameType = 'chess';
    this.engine = null;
    this.renderer = null;

    // Player identity (session-isolated for multi-browser testing)
    this.clientId = this.getOrCreateClientId();
    const storedName = sessionStorage.getItem('communal_player_name');
    this.playerName = (storedName && !storedName.startsWith('Player_')) ? storedName : this.generateDefaultName();

    // Controllers
    this.presence = null;
    this.staging = null;
    this.playerlist = null;
    this.historyCtrl = null;
    this.analysisView = null;

    this.gameState = null;
    this.isBannedThisTurn = false;

    // Active synchronized move preview ({ basePly, baseFen, moves, stagedBy, updatedAt })
    this.activePreview = null;
  }

  getOrCreateClientId() {
    let id = sessionStorage.getItem('communal_client_id');
    if (!id) {
      id = 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Math.floor(Math.random() * 900 + 100);
      sessionStorage.setItem('communal_client_id', id);
    }
    return id;
  }

  generateDefaultName() {
    const animals = [
      'Lynx', 'Wolf', 'Falcon', 'Tiger', 'Eagle', 'Fox', 'Hawk', 'Panther',
      'Jaguar', 'Otter', 'Panda', 'Badger', 'Raven', 'Bison', 'Leopard', 'Osprey',
      'Cheetah', 'Stag', 'Phoenix', 'Griffin'
    ];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    sessionStorage.setItem('communal_player_name', animal);
    return animal;
  }

  init() {
    this.setupDOM();
    this.initControllers();
    this.switchRoom(this.currentRoomId, 'chess');
    this.setupEventListeners();
  }

  setupDOM() {
    const nameInput = document.getElementById('inputPlayerName');
    if (nameInput) {
      nameInput.value = this.playerName;
      nameInput.addEventListener('change', () => {
        const newName = nameInput.value.trim() || 'Anonymous';
        this.playerName = newName;
        sessionStorage.setItem('communal_player_name', newName);
        if (this.presence) {
          this.presence.playerInfo.name = newName;
          this.presence.broadcastPresence();
        }
      });
    }

    const muteBtn = document.getElementById('btnToggleMute');
    if (muteBtn) {
      muteBtn.textContent = sound.isMuted() ? '🔇 Unmute' : '🔊 Sound';
      muteBtn.addEventListener('click', () => {
        const isMuted = sound.toggleMute();
        muteBtn.textContent = isMuted ? '🔇 Unmute' : '🔊 Sound';
      });
    }

    const flipBtn = document.getElementById('btnFlipBoard');
    if (flipBtn) {
      flipBtn.addEventListener('click', () => {
        if (this.renderer && this.renderer.toggleFlip) {
          this.renderer.setAutoOrient(false);
          this.renderer.toggleFlip();
          this.renderActiveBoard();
        }
      });
    }

    const resetBtn = document.getElementById('btnResetGame');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Start a fresh communal game in this room?')) {
          this.resetRoomGame();
        }
      });
    }
  }

  initControllers() {
    // Move Confirmation & Staged Preview Bar
    const stagingBar = document.getElementById('confirmMoveBar');
    this.staging = new MoveStagingController(
      stagingBar,
      (firstMove) => this.confirmMoveExecution(firstMove),
      () => this.cancelActivePreview(),
      () => this.stepBackActivePreview()
    );

    // Player List
    const playerlistContainer = document.getElementById('playerListContainer');
    this.playerlist = new PlayerListRenderer(playerlistContainer);

    // History Controller
    const historyTable = document.getElementById('historyTableContainer');
    const previewBanner = document.getElementById('historyPreviewBanner');
    this.historyCtrl = new HistoryController(historyTable, previewBanner, (ply) => {
      this.handleHistoryScrub(ply);
    });

    // Analysis View
    const analysisContainer = document.getElementById('analysisContainer');
    this.analysisView = new AnalysisView(analysisContainer, (ply) => {
      this.historyCtrl.goToPly(ply);
    });
  }

  switchRoom(roomId, gameType = 'chess') {
    this.currentRoomId = roomId;
    this.gameType = gameType;

    // Instantiate appropriate game engine
    if (gameType === 'chess') {
      this.engine = new ChessEngine();
    } else if (gameType === 'xiangqi') {
      this.engine = new XiangqiEngine();
    } else if (gameType === 'go') {
      this.engine = new GoEngine(9);
    } else if (gameType === 'shogi') {
      this.engine = new ShogiEngine();
    }

    // Instantiate renderer
    const boardContainer = document.getElementById('gameBoardContainer');
    const rendererOptions = {
      onMoveAttempt: (data) => this.handleMoveAttempt(data),
      onHoverSquare: (sq) => {
        if (this.presence) this.presence.setHoverSquare(sq);
      }
    };

    if (gameType === 'chess') {
      this.renderer = new ChessRenderer(boardContainer, rendererOptions);
    } else if (gameType === 'xiangqi') {
      this.renderer = new XiangqiRenderer(boardContainer, rendererOptions);
    } else if (gameType === 'go') {
      this.renderer = new GoRenderer(boardContainer, rendererOptions);
    } else if (gameType === 'shogi') {
      this.renderer = new ShogiRenderer(boardContainer, rendererOptions);
    }

    // Initialize Presence
    this.presence = new PresenceManager(roomId, {
      clientId: this.clientId,
      name: this.playerName
    }, this.db);

    this.presence.subscribePresence((presenceList) => {
      if (this.playerlist) {
        this.playerlist.render(
          presenceList,
          this.gameState ? this.gameState.lastMover : null,
          this.gameState ? this.gameState.turn : null,
          this.clientId
        );
      }
      if (this.renderer) {
        this.renderer.updatePresence(presenceList);
        this.renderActiveBoard();
      }
    });

    // Subscribe to Room State in Firebase RTDB
    const stateRef = this.db.ref(`rooms/${roomId}/state`);
    stateRef.on('value', (snap) => {
      const remoteState = snap.val();
      if (remoteState) {
        this.applyRemoteState(remoteState);
      } else {
        const initialState = this.engine.init();
        stateRef.set(initialState);
      }
    });

    // Subscribe to Move Previews in Firebase RTDB
    const previewRef = this.db.ref(`rooms/${roomId}/preview`);
    previewRef.on('value', (snap) => {
      this.handleRemotePreview(snap.val());
    });
  }

  applyRemoteState(state) {
    this.gameState = state;

    // Synchronize local engine
    if (this.engine) {
      if (this.gameType === 'chess' && state.fen) {
        this.engine.init(state.fen);
      } else if (state.board) {
        this.engine.board = state.board.map(row => [...row]);
        this.engine.turn = state.turn;
        if (state.hands) this.engine.hands = JSON.parse(JSON.stringify(state.hands));
      }
      this.engine.history = state.history ? [...state.history] : [];
      if (this.engine.reconstructSnapshots && state.history) {
        this.engine.reconstructSnapshots(state.history);
      }
    }

    // Check communal anti-consecutive move rule
    const lastMover = state.lastMover;
    if (lastMover && (lastMover.clientId === this.clientId || lastMover.name.toLowerCase() === this.playerName.trim().toLowerCase())) {
      this.isBannedThisTurn = true;
    } else {
      this.isBannedThisTurn = false;
    }

    this.updateStatusBanner();

    // Sync history controller
    if (this.historyCtrl) {
      this.historyCtrl.updateHistory(state.history, this.engine ? this.engine.moveSnapshots : []);
    }

    // If an active preview exists from a prior ply, clear it
    if (this.activePreview && this.activePreview.basePly !== (state.history ? state.history.length : 0)) {
      this.activePreview = null;
      if (this.staging) this.staging.clear();
    }

    // Render active board (respects local history preview!)
    this.renderActiveBoard();

    // Sound effect on remote move
    if (state.lastMove) {
      if (state.lastMove.captured) sound.playCapture();
      else sound.playMove();

      if (state.isCheck) sound.playCheck();
      if (state.status === 'checkmate' || state.status === 'game_over') sound.playGameOver();
    }
  }

  handleRemotePreview(preview) {
    const currentBasePly = this.gameState && this.gameState.history ? this.gameState.history.length : 0;
    if (preview && preview.moves && preview.moves.length > 0) {
      if (preview.basePly !== currentBasePly) {
        // Discard stale preview from past ply
        this.activePreview = null;
        if (this.staging) this.staging.clear();
      } else {
        this.activePreview = preview;
        const firstMove = preview.moves[0];
        const isMe = preview.stagedBy && preview.stagedBy.clientId === this.clientId;
        const previewState = this.getPreviewBoardState();
        if (this.staging) {
          this.staging.stagePreview({
            firstMove,
            previewMoves: preview.moves,
            stagedBy: preview.stagedBy,
            isMe,
            nextTurn: previewState.turn
          });
        }
      }
    } else {
      this.activePreview = null;
      if (this.staging) this.staging.clear();
    }

    this.updateStatusBanner();
    this.renderActiveBoard();
  }

  getPreviewBoardState() {
    if (!this.activePreview || !this.activePreview.moves || this.activePreview.moves.length === 0) {
      return this.gameState;
    }

    if (this.gameType === 'chess' && window.Chess && this.gameState) {
      try {
        const tempChess = new window.Chess(this.gameState.fen);
        for (const m of this.activePreview.moves) {
          tempChess.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
        }
        const lastM = this.activePreview.moves[this.activePreview.moves.length - 1];
        return {
          ...this.gameState,
          fen: tempChess.fen(),
          turn: tempChess.turn(),
          board: tempChess.board(),
          lastMove: { from: lastM.from, to: lastM.to },
          isCheck: tempChess.in_check ? tempChess.in_check() : false,
          isPreview: true
        };
      } catch (e) {
        return this.gameState;
      }
    }

    return this.gameState;
  }

  renderActiveBoard() {
    if (!this.renderer || !this.gameState) return;

    if (this.historyCtrl && !this.historyCtrl.isAtLive()) {
      const historicalState = this.engine.getStateAtPly(this.historyCtrl.currentPly);
      if (historicalState) {
        this.renderer.render(historicalState, historicalState.turn, this.clientId, this.playerName);
        return;
      }
    }

    const boardState = this.getPreviewBoardState();
    this.renderer.render(boardState, boardState.turn, this.clientId, this.playerName);
  }

  updateStatusBanner() {
    const banner = document.getElementById('communalStatusBanner');
    if (!banner || !this.gameState) return;

    if (this.activePreview && this.activePreview.moves && this.activePreview.moves.length > 0) {
      const previewState = this.getPreviewBoardState();
      const nextTurn = previewState.turn;
      const isWhite = (nextTurn === 'w' || nextTurn === 'red' || nextTurn === 'sente');
      const turnSymbol = isWhite ? '⚪' : '⚫';
      const turnName = isWhite ? 'WHITE' : 'BLACK';
      banner.className = `status-banner banner-preview-active ${isWhite ? 'preview-turn-white' : 'preview-turn-black'}`;
      banner.innerHTML = `👁️ <strong>Move Preview Active:</strong> Next turn in preview: <strong>${turnSymbol} ${turnName}</strong> — <em>(Only 1st move will commit on confirm)</em>`;
      return;
    }

    if (this.gameState.status === 'checkmate' || this.gameState.status === 'game_over') {
      banner.className = 'status-banner banner-game-over';
      banner.innerHTML = `<strong>Game Over!</strong> Winner: ${this.gameState.winner ? this.gameState.winner.toUpperCase() : 'Draw'}`;
      return;
    }

    if (this.isBannedThisTurn) {
      banner.className = 'status-banner banner-waiting';
      banner.innerHTML = `⏳ <strong>You made the previous move!</strong> Waiting for someone else to make a move before you can play again.`;
    } else {
      banner.className = 'status-banner banner-ready';
      banner.innerHTML = `🟢 <strong>Your Turn!</strong> Make a move for <strong>${(this.gameState.turn || '').toUpperCase()}</strong>.`;
    }
  }

  handleMoveAttempt(data) {
    // If viewing history, do not allow staging moves on historical board
    if (this.historyCtrl && !this.historyCtrl.isAtLive()) {
      alert("You are viewing move history (read-only). Click 'Return to Live Board' to make a move.");
      return;
    }

    // 1. Request for legal moves
    if (data.getLegalMovesFor && data.callback) {
      if (this.activePreview && this.activePreview.moves && this.activePreview.moves.length > 0) {
        if (this.gameType === 'chess' && window.Chess) {
          try {
            const previewState = this.getPreviewBoardState();
            const tempChess = new window.Chess(previewState.fen);
            const moves = tempChess.moves({ square: data.getLegalMovesFor, verbose: true });
            data.callback(moves || []);
            return;
          } catch (e) {}
        }
      }

      if (this.engine && this.engine.getLegalMoves) {
        data.callback(this.engine.getLegalMoves(data.getLegalMovesFor));
      }
      return;
    }

    if (data.getLegalDropsFor && data.callback) {
      if (this.engine && this.engine.getLegalDrops) {
        data.callback(this.engine.getLegalDrops(data.getLegalDropsFor));
      }
      return;
    }

    // 2. Making a move: Preview Staging
    const { from, to, promotion = 'q' } = data;

    // If starting a fresh preview
    if (!this.activePreview || !this.activePreview.moves || this.activePreview.moves.length === 0) {
      if (this.isBannedThisTurn) {
        alert("Communal Rule: You made the previous move! Someone else must make an intervening move.");
        return;
      }

      // Validate legality on live engine: "These moves should be legal, if not the piece goes back."
      if (this.engine && this.engine.isLegalMove) {
        if (!this.engine.isLegalMove(from, to, promotion)) {
          return; // Illegal move -> rejected, piece goes back
        }
      }

      let san = data.san || `${from}➔${to}`;
      if (this.gameType === 'chess' && window.Chess) {
        try {
          const c = new window.Chess(this.gameState.fen);
          const m = c.move({ from, to, promotion });
          if (m) san = m.san;
        } catch (e) {}
      }

      const firstMove = {
        from,
        to,
        promotion,
        san,
        color: this.gameState.turn,
        player: this.playerName,
        clientId: this.clientId
      };

      this.activePreview = {
        basePly: this.gameState.history ? this.gameState.history.length : 0,
        baseFen: this.gameState.fen,
        moves: [firstMove],
        stagedBy: {
          name: this.playerName,
          clientId: this.clientId
        },
        updatedAt: Date.now()
      };

      // Broadcast move preview to all players in the room
      this.db.ref(`rooms/${this.currentRoomId}/preview`).set(this.activePreview);
      const previewState = this.getPreviewBoardState();
      if (this.staging) {
        this.staging.stagePreview({
          firstMove,
          previewMoves: this.activePreview.moves,
          stagedBy: this.activePreview.stagedBy,
          isMe: true,
          nextTurn: previewState.turn
        });
      }
      this.updateStatusBanner();
      sound.playMove();
      this.renderActiveBoard();
      return;
    }

    // 3. Appending subsequent moves to active preview (in-order alternation: White, Black, White, Black...)
    const previewState = this.getPreviewBoardState();

    if (this.gameType === 'chess' && window.Chess) {
      try {
        const c = new window.Chess(previewState.fen);
        const m = c.move({ from, to, promotion });
        if (!m) {
          return; // Illegal move on preview position -> piece goes back
        }

        const nextMove = {
          from,
          to,
          promotion,
          san: m.san,
          color: previewState.turn,
          player: this.playerName,
          clientId: this.clientId
        };

        this.activePreview.moves.push(nextMove);
        this.activePreview.updatedAt = Date.now();

        // Broadcast to all players in the room
        this.db.ref(`rooms/${this.currentRoomId}/preview`).set(this.activePreview);
        const updatedPreviewState = this.getPreviewBoardState();
        if (this.staging) {
          this.staging.stagePreview({
            firstMove: this.activePreview.moves[0],
            previewMoves: this.activePreview.moves,
            stagedBy: this.activePreview.stagedBy,
            isMe: true,
            nextTurn: updatedPreviewState.turn
          });
        }
        this.updateStatusBanner();
        sound.playMove();
        this.renderActiveBoard();
      } catch (e) {}
    }
  }

  cancelActivePreview() {
    this.activePreview = null;
    this.db.ref(`rooms/${this.currentRoomId}/preview`).set(null);
    if (this.staging) this.staging.clear();
    this.updateStatusBanner();
    this.renderActiveBoard();
  }

  stepBackActivePreview() {
    if (!this.activePreview || !this.activePreview.moves || this.activePreview.moves.length <= 1) {
      this.cancelActivePreview();
      return;
    }

    this.activePreview.moves.pop();
    this.activePreview.updatedAt = Date.now();
    this.db.ref(`rooms/${this.currentRoomId}/preview`).set(this.activePreview);
    const updatedPreviewState = this.getPreviewBoardState();
    if (this.staging) {
      this.staging.stagePreview({
        firstMove: this.activePreview.moves[0],
        previewMoves: this.activePreview.moves,
        stagedBy: this.activePreview.stagedBy,
        isMe: true,
        nextTurn: updatedPreviewState.turn
      });
    }
    this.updateStatusBanner();
    this.renderActiveBoard();
  }

  confirmMoveExecution(firstMove) {
    if (this.isBannedThisTurn) {
      alert("Communal Rule: You cannot make consecutive moves.");
      return;
    }

    // Clear active preview on confirmation: "only the first move will count"
    this.db.ref(`rooms/${this.currentRoomId}/preview`).set(null);
    this.activePreview = null;
    if (this.staging) this.staging.clear();
    this.updateStatusBanner();

    // Atomic transaction in Firebase
    const stateRef = this.db.ref(`rooms/${this.currentRoomId}/state`);
    stateRef.transaction((current) => {
      if (!current) return current;

      // Verify turn has not changed
      const lastMover = current.lastMover;
      if (lastMover && (lastMover.clientId === this.clientId || lastMover.name.toLowerCase() === this.playerName.trim().toLowerCase())) {
        return; // Abort: consecutive move violation
      }

      // Synchronize engine before execution
      if (this.gameType === 'chess' && current.fen) {
        this.engine.init(current.fen);
      } else if (current.board) {
        this.engine.board = current.board.map(row => [...row]);
        this.engine.turn = current.turn;
        if (current.hands) this.engine.hands = JSON.parse(JSON.stringify(current.hands));
      }
      this.engine.history = current.history ? [...current.history] : [];

      // Execute in engine
      const res = this.engine.makeMove({
        from: firstMove.from,
        to: firstMove.to,
        promotion: firstMove.promotion || 'q',
        playerName: this.playerName,
        clientId: this.clientId
      });

      if (!res.success) {
        return; // Abort: illegal move
      }

      const newState = {
        ...res.state,
        lastMover: {
          name: this.playerName,
          clientId: this.clientId,
          color: current.turn,
          timestamp: Date.now()
        },
        lastMove: res.move
      };

      return newState;
    }, (error, committed, snapshot) => {
      if (error) {
        alert("Move failed to commit: " + error.message);
      } else if (!committed) {
        alert("Another player confirmed a move before you, or move was illegal. State refreshed!");
      }
    });
  }

  handleHistoryScrub(ply) {
    if (!this.engine || !this.renderer) return;

    if (ply === -1) {
      this.renderActiveBoard();
    } else {
      const historicalState = this.engine.getStateAtPly(ply);
      if (historicalState) {
        this.renderer.render(historicalState, historicalState.turn, this.clientId, this.playerName);
      }
    }
  }

  resetRoomGame() {
    if (!this.engine) return;
    const fresh = this.engine.init();
    const stateRef = this.db.ref(`rooms/${this.currentRoomId}/state`);
    stateRef.set(fresh);
    const previewRef = this.db.ref(`rooms/${this.currentRoomId}/preview`);
    previewRef.set(null);
  }

  setupEventListeners() {
    const roomSelect = document.getElementById('selectActiveRoom');
    if (roomSelect) {
      roomSelect.addEventListener('change', () => {
        const val = roomSelect.value;
        const [id, type] = val.split(':');
        this.switchRoom(id, type || 'chess');
      });
    }

    const btnCreateRoom = document.getElementById('btnCreateRoom');
    if (btnCreateRoom) {
      btnCreateRoom.addEventListener('click', () => {
        const name = prompt("Enter new communal room name:");
        if (!name) return;
        const gameType = prompt("Choose game type: chess, xiangqi, go, or shogi:", "chess") || 'chess';
        const cleanId = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);

        const opt = document.createElement('option');
        opt.value = `${cleanId}:${gameType}`;
        opt.textContent = `${name} (${gameType.toUpperCase()})`;
        opt.selected = true;
        roomSelect.appendChild(opt);

        this.switchRoom(cleanId, gameType);
      });
    }
  }
}

// Start application once DOM is loaded
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.app = new CommunalApp();
    window.app.init();
  });
}
