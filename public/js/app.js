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
import { GameArchiveManager } from './gameArchive.js';
import { BrowserStockfishAnalyzer } from './analyzer.js';
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
    this.archiveMgr = null;
    this.analyzer = new BrowserStockfishAnalyzer();

    this.gameState = null;
    this.isBannedThisTurn = false;

    // Past Game Replay & Analysis state
    this.isReplayingPastGame = false;
    this.replayingGameRecord = null;

    // Active synchronized move preview ({ basePly, baseFen, moves, stagedBy, updatedAt })
    this.activePreview = null;

    // Tracks whether initial board orientation has been aligned to the moving side on room join
    this.hasSetInitialOrientation = false;

    // Track archived matches to prevent duplicate auto-archive dispatches
    this.archivedMatchSignatures = new Set();
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
        if (confirm('Start a fresh communal game in this room? The current match will be saved to Past Games.')) {
          this.resetRoomGame();
        }
      });
    }

    const themeBtn = document.getElementById('btnToggleTheme');
    if (themeBtn) {
      this.initTheme();
      themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(nextTheme);
      });
    }

    const resignBtn = document.getElementById('btnResignGame');
    if (resignBtn) {
      resignBtn.addEventListener('click', () => {
        this.handleResign();
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
    this.historyCtrl = new HistoryController(
      historyTable,
      previewBanner,
      (ply) => this.handleHistoryScrub(ply),
      () => this.exitPastGameReplay()
    );

    // Analysis View
    const analysisContainer = document.getElementById('analysisContainer');
    this.analysisView = new AnalysisView(analysisContainer, (ply) => {
      if (this.historyCtrl) this.historyCtrl.goToPly(ply);
    });

    // Past Games Archive Manager
    const pastGamesContainer = document.getElementById('pastGamesContainer');
    this.archiveMgr = new GameArchiveManager(this.db, this.currentRoomId);
    this.archiveMgr.renderArchiveList(
      pastGamesContainer,
      (game) => this.startPastGameReplay(game),
      (game) => this.analyzePastGame(game)
    );
    this.archiveMgr.onChange(() => {
      this.archiveMgr.renderArchiveList(
        pastGamesContainer,
        (g) => this.startPastGameReplay(g),
        (g) => this.analyzePastGame(g)
      );
    });
  }

  switchRoom(roomId, gameType = 'chess') {
    // Automatically save any active in-progress game before switching rooms
    if (this.archiveMgr && this.gameState && this.gameState.history && this.gameState.history.length >= 1) {
      const prevSig = this.getMatchSignature(this.gameState);
      if (prevSig && !this.archivedMatchSignatures.has(prevSig)) {
        this.archivedMatchSignatures.add(prevSig);
        this.archiveCurrentGame('Saved before Room Switch');
      }
    }

    this.currentRoomId = roomId;
    this.gameType = gameType;
    this.hasSetInitialOrientation = false;
    if (this.archiveMgr) {
      this.archiveMgr.setRoom(roomId);
    }

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
    if (!state) return;
    this.gameState = state;

    // On room join, orient the current moving side to the bottom
    if (!this.hasSetInitialOrientation && state.turn) {
      this.hasSetInitialOrientation = true;
      const isBlackTurn = (state.turn === 'b' || state.turn === 'black' || state.turn === 'gote');
      if (this.renderer && this.renderer.setFlipped) {
        this.renderer.setFlipped(isBlackTurn);
      }
    }

    if (this.isReplayingPastGame) {
      // In local past game replay mode, keep local historical inspection active
      return;
    }

    // Auto-archive all completed games (deduplicated by match signature)
    const isFinished = state.status === 'checkmate' ||
                       state.status === 'stalemate' ||
                       state.status === 'draw' ||
                       state.status === 'game_over' ||
                       state.status === 'resigned' ||
                       state.status === 'threefold' ||
                       state.status === 'insufficient_material' ||
                       Boolean(state.winner);

    if (isFinished && state.history && state.history.length >= 1) {
      const sig = this.getMatchSignature(state);
      if (sig && !this.archivedMatchSignatures.has(sig)) {
        this.archivedMatchSignatures.add(sig);
        state._isArchived = true;
        const outcome = state.reason || (state.status === 'checkmate' ? 'Checkmate' :
                                         state.status === 'resigned' ? 'Resignation' :
                                         state.status === 'threefold' ? 'Draw by Threefold Repetition' :
                                         state.status === 'insufficient_material' ? 'Draw by Insufficient Material' :
                                         (state.winner ? `${state.winner === 'w' ? 'White' : 'Black'} Victory` : 'Draw'));
        this.archiveCurrentGame(outcome);
      }
    }

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
      if (state.status === 'checkmate' || state.status === 'game_over' || state.status === 'resigned') sound.playGameOver();
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

    if (this.gameState.status === 'checkmate' || this.gameState.status === 'game_over' || this.gameState.status === 'resigned') {
      banner.className = 'status-banner banner-game-over';
      const winner = this.gameState.winner ? this.gameState.winner.toUpperCase() : 'Draw';
      const reason = this.gameState.reason ? ` (${this.gameState.reason})` : '';
      banner.innerHTML = `<strong>Game Over!</strong> Winner: <strong>${winner}</strong>${reason}`;
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
    if (this.gameState && (this.gameState.status === 'checkmate' || this.gameState.status === 'game_over' || this.gameState.status === 'resigned')) {
      alert("This game has already concluded. Click '⚡ Reset' to start a new match.");
      return;
    }

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

    if (this.historyCtrl && this.historyCtrl.isAtLive()) {
      this.renderActiveBoard();
    } else {
      const targetPly = ply === -1 ? (this.historyCtrl ? this.historyCtrl.maxPly : 0) : ply;
      const historicalState = this.engine.getStateAtPly(targetPly);
      if (historicalState) {
        this.renderer.render(historicalState, historicalState.turn, this.clientId, this.playerName);
      }
    }
  }

  switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === tabId);
    });
  }

  getMatchSignature(state) {
    if (!state || !state.history || state.history.length === 0) return null;
    const roomId = this.currentRoomId || 'main';
    const gameType = this.gameType || 'chess';
    const count = state.history.length;
    const firstMoveTs = (state.history[0] && state.history[0].timestamp) ? state.history[0].timestamp : '';
    const moves = state.history.map(m => `${m.from || ''}${m.to || ''}${m.san || ''}`).join('-');
    return `${roomId}:${gameType}:${count}:${firstMoveTs}:${moves}`;
  }

  async archiveCurrentGame(reason = 'Game Completed') {
    if (!this.gameState || !this.gameState.history || this.gameState.history.length === 0) return null;
    const sig = this.getMatchSignature(this.gameState);
    if (sig) this.archivedMatchSignatures.add(sig);
    return await this.archiveMgr.saveGame({
      roomId: this.currentRoomId,
      gameType: this.gameType,
      status: this.gameState.status || 'completed',
      winner: this.gameState.winner || (this.gameState.turn === 'w' ? 'b' : 'w'),
      reason: reason,
      history: [...this.gameState.history],
      initialFen: this.gameState.initialFen || null,
      finalFen: this.gameState.fen || null
    });
  }

  startPastGameReplay(game) {
    if (!game || !game.history) return;
    this.isReplayingPastGame = true;
    this.replayingGameRecord = game;

    if (this.engine) {
      this.engine.init(game.initialFen || undefined);
      if (this.engine.reconstructSnapshots) {
        this.engine.reconstructSnapshots(game.history);
      }
      this.engine.history = [...game.history];
    }

    if (this.historyCtrl) {
      this.historyCtrl.setReplayGame(game, this.engine ? this.engine.moveSnapshots : []);
    }

    this.switchTab('tab-moves');
    this.handleHistoryScrub(this.historyCtrl.currentPly);
  }

  exitPastGameReplay() {
    this.isReplayingPastGame = false;
    this.replayingGameRecord = null;
    if (this.gameState) {
      this.applyRemoteState(this.gameState);
    } else {
      this.renderActiveBoard();
    }
  }

  async analyzePastGame(game) {
    if (!game || !game.history) return;
    this.startPastGameReplay(game);

    const result = await this.analyzer.analyzeGame(game.history, {
      gameType: game.gameType,
      winner: game.winner,
      reason: game.reason || game.status
    });

    if (this.analysisView) {
      this.analysisView.setAnalysis(result);
    }
    this.switchTab('tab-analysis');
  }

  async resetRoomGame() {
    if (!this.engine) return;
    this.hasSetInitialOrientation = false;
    if (this.gameState && this.gameState.history && this.gameState.history.length >= 1) {
      const sig = this.getMatchSignature(this.gameState);
      if (sig && !this.archivedMatchSignatures.has(sig)) {
        this.archivedMatchSignatures.add(sig);
        await this.archiveCurrentGame('Completed before Reset');
      }
    }
    const fresh = this.engine.init();
    const stateRef = this.db.ref(`rooms/${this.currentRoomId}/state`);
    stateRef.set(fresh);
    const previewRef = this.db.ref(`rooms/${this.currentRoomId}/preview`);
    previewRef.set(null);
  }

  initTheme() {
    let savedTheme = 'dark';
    try {
      savedTheme = localStorage.getItem('communal_theme') || 'dark';
    } catch (e) {}
    this.setTheme(savedTheme);
  }

  setTheme(theme) {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      try {
        localStorage.setItem('communal_theme', theme);
      } catch (e) {}
      const themeBtn = document.getElementById('btnToggleTheme');
      if (themeBtn) {
        themeBtn.innerHTML = theme === 'dark' ? '🌙 Dark' : '☀️ Light';
        themeBtn.title = `Current: ${theme.toUpperCase()} Mode (Click to toggle)`;
      }
    }
  }

  async handleResign() {
    if (!this.gameState) {
      alert('No game is currently in progress.');
      return;
    }

    if (this.gameState.status === 'checkmate' || this.gameState.status === 'game_over' || this.gameState.status === 'resigned') {
      alert('The current game has already ended.');
      return;
    }

    if (!this.gameState.history || this.gameState.history.length === 0) {
      alert('No moves have been played in this game yet.');
      return;
    }

    // Determine currently moving side and the opponent who wins
    const turn = this.gameState.turn || 'w';
    let resigningSide = 'White';
    let winningSide = 'Black';
    let winnerKey = 'b';

    if (this.gameType === 'chess') {
      if (turn === 'w') {
        resigningSide = 'White';
        winningSide = 'Black';
        winnerKey = 'b';
      } else {
        resigningSide = 'Black';
        winningSide = 'White';
        winnerKey = 'w';
      }
    } else if (this.gameType === 'xiangqi') {
      if (turn === 'red') {
        resigningSide = 'Red';
        winningSide = 'Black';
        winnerKey = 'black';
      } else {
        resigningSide = 'Black';
        winningSide = 'Red';
        winnerKey = 'red';
      }
    } else if (this.gameType === 'shogi') {
      if (turn === 'sente') {
        resigningSide = 'Sente';
        winningSide = 'Gote';
        winnerKey = 'gote';
      } else {
        resigningSide = 'Gote';
        winningSide = 'Sente';
        winnerKey = 'sente';
      }
    } else if (this.gameType === 'go') {
      if (turn === 'b') {
        resigningSide = 'Black';
        winningSide = 'White';
        winnerKey = 'w';
      } else {
        resigningSide = 'White';
        winningSide = 'Black';
        winnerKey = 'b';
      }
    }

    const confirmResign = confirm(
      `Are you sure you want to resign for ${resigningSide}?\n\n` +
      `Player: ${this.playerName}\n` +
      `Winner: ${winningSide} will be awarded the victory.`
    );
    if (!confirmResign) return;

    const outcomeText = `${this.playerName} resigned for ${resigningSide}`;

    // Mark match signature early so applyRemoteState won't double-archive
    const sig = this.getMatchSignature(this.gameState);
    if (sig) this.archivedMatchSignatures.add(sig);

    // Update Firebase RTDB room state
    const stateRef = this.db.ref(`rooms/${this.currentRoomId}/state`);
    await stateRef.transaction((current) => {
      if (!current || current.status === 'checkmate' || current.status === 'game_over' || current.status === 'resigned') {
        return current;
      }
      current.status = 'resigned';
      current.winner = winnerKey;
      current.reason = outcomeText;
      current.resignedBy = {
        name: this.playerName,
        clientId: this.clientId,
        side: resigningSide
      };
      return current;
    });

    // Clear active move preview
    const previewRef = this.db.ref(`rooms/${this.currentRoomId}/preview`);
    previewRef.set(null);

    // Save match to past games archive
    await this.archiveCurrentGame(outcomeText);

    sound.playGameOver();
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

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        if (this.archiveMgr && this.gameState && this.gameState.history && this.gameState.history.length >= 1) {
          const sig = this.getMatchSignature(this.gameState);
          if (sig && !this.archivedMatchSignatures.has(sig)) {
            this.archivedMatchSignatures.add(sig);
            this.archiveCurrentGame('Saved on Exit');
          }
        }
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
