import { test } from 'node:test';
import assert from 'node:assert';
import * as chessPkg from 'chess.js';
const Chess = chessPkg.Chess || chessPkg.default?.Chess || chessPkg.default;
import { ChessEngine } from '../../public/js/engines/chessEngine.js';

test('Communal Anti-Consecutive Move Rule Enforcement', (t) => {
  const engine = new ChessEngine(Chess);
  engine.init();

  let lastMover = null;

  function attemptCommunalMove(moveData, playerName, clientId) {
    // Check communal restriction: mover cannot be the same as last mover
    if (lastMover && (lastMover.clientId === clientId || lastMover.name.toLowerCase() === playerName.trim().toLowerCase())) {
      return { success: false, error: 'Communal rule: You cannot make consecutive moves.' };
    }

    const res = engine.makeMove({ ...moveData, playerName, clientId });
    if (res.success) {
      lastMover = { name: playerName, clientId, timestamp: Date.now() };
    }
    return res;
  }

  // 1. Alice makes White move e4 -> Should succeed
  const move1 = attemptCommunalMove({ from: 'e2', to: 'e4' }, 'Alice', 'client_alice');
  assert.strictEqual(move1.success, true, 'Alice should be able to make the opening move');
  assert.strictEqual(lastMover.name, 'Alice');

  // 2. Alice attempts Black move e5 immediately -> Must be blocked
  const move2_blocked = attemptCommunalMove({ from: 'e7', to: 'e5' }, 'Alice', 'client_alice');
  assert.strictEqual(move2_blocked.success, false, 'Alice should NOT be able to make consecutive moves');
  assert.match(move2_blocked.error, /consecutive moves/i);

  // 3. Alice tries to bypass restriction by changing her name in the same browser -> Must be blocked by clientId
  const move2_fakeName = attemptCommunalMove({ from: 'e7', to: 'e5' }, 'Eve', 'client_alice');
  assert.strictEqual(move2_fakeName.success, false, 'Same client with different name must be blocked');

  // 4. Bob makes Black move e5 -> Should succeed
  const move2_bob = attemptCommunalMove({ from: 'e7', to: 'e5' }, 'Bob', 'client_bob');
  assert.strictEqual(move2_bob.success, true, 'Bob should succeed with intervening move');
  assert.strictEqual(lastMover.name, 'Bob');

  // 5. Alice is now eligible again and makes White move Nf3 -> Should succeed
  const move3_alice = attemptCommunalMove({ from: 'g1', to: 'f3' }, 'Alice', 'client_alice');
  assert.strictEqual(move3_alice.success, true, 'Alice can move again after Bob took an intervening turn');
});

test('Board Orientation: Initial Room Join places current moving side on bottom', (t) => {
  function getInitialJoinOrientation(state) {
    if (!state || !state.turn) return false;
    const isBlackTurn = (state.turn === 'b' || state.turn === 'black' || state.turn === 'gote');
    return isBlackTurn;
  }

  // 1. Chess room where it is White's turn -> White on bottom (flipped = false)
  const chessWhiteState = { turn: 'w' };
  assert.strictEqual(getInitialJoinOrientation(chessWhiteState), false, 'White turn: White is on bottom');

  // 2. Chess room where it is Black's turn -> Black on bottom (flipped = true)
  const chessBlackState = { turn: 'b' };
  assert.strictEqual(getInitialJoinOrientation(chessBlackState), true, 'Black turn: Black is on bottom');

  // 3. Xiangqi room where it is Red's turn -> Red on bottom (flipped = false)
  const xiangqiRedState = { turn: 'red' };
  assert.strictEqual(getInitialJoinOrientation(xiangqiRedState), false, 'Xiangqi Red turn: Red is on bottom');

  // 4. Xiangqi room where it is Black's turn -> Black on bottom (flipped = true)
  const xiangqiBlackState = { turn: 'black' };
  assert.strictEqual(getInitialJoinOrientation(xiangqiBlackState), true, 'Xiangqi Black turn: Black is on bottom');

  // 5. Shogi room where it is Sente's turn -> Sente on bottom (flipped = false)
  const shogiSenteState = { turn: 'sente' };
  assert.strictEqual(getInitialJoinOrientation(shogiSenteState), false, 'Shogi Sente turn: Sente is on bottom');

  // 6. Shogi room where it is Gote's turn -> Gote on bottom (flipped = true)
  const shogiGoteState = { turn: 'gote' };
  assert.strictEqual(getInitialJoinOrientation(shogiGoteState), true, 'Shogi Gote turn: Gote is on bottom');
});

test('Board Orientation: No Auto-Rotate on subsequent moves, previews, or history', (t) => {
  // Simulates App state machine orientation tracking
  class OrientationTracker {
    constructor() {
      this.hasSetInitialOrientation = false;
      this.flipped = false;
    }

    onRemoteState(state) {
      if (!this.hasSetInitialOrientation && state && state.turn) {
        this.hasSetInitialOrientation = true;
        this.flipped = (state.turn === 'b' || state.turn === 'black' || state.turn === 'gote');
      }
      // Note: Subsequent remote moves NEVER auto-flip or mutate this.flipped!
    }

    toggleFlip() {
      this.flipped = !this.flipped;
    }
  }

  const tracker = new OrientationTracker();

  // 1. Player joins room when it is White's turn -> Flipped is false
  tracker.onRemoteState({ turn: 'w', history: [] });
  assert.strictEqual(tracker.flipped, false, 'Initial join at White turn -> White at bottom');

  // 2. Move 1 (e4) played -> State updates to Black's turn ('b')
  // Board MUST NOT auto-rotate! Perspective must remain stable.
  tracker.onRemoteState({ turn: 'b', history: ['e4'] });
  assert.strictEqual(tracker.flipped, false, 'Subsequent move by White must NOT auto-rotate board');

  // 3. Move 2 (e5) played -> State updates to White's turn ('w')
  tracker.onRemoteState({ turn: 'w', history: ['e4', 'e5'] });
  assert.strictEqual(tracker.flipped, false, 'Subsequent move by Black must NOT auto-rotate board');

  // 4. Manual flip button is pressed -> Perspective inverts
  tracker.toggleFlip();
  assert.strictEqual(tracker.flipped, true, 'Manual flip button successfully toggles orientation');

  // 5. Next move played -> Stays flipped because auto-rotate is removed
  tracker.onRemoteState({ turn: 'b', history: ['e4', 'e5', 'Nf3'] });
  assert.strictEqual(tracker.flipped, true, 'Manual perspective choice is preserved across moves');
});

test('Local History Stepping: Step back game state locally without mutating live state', (t) => {
  const engine = new ChessEngine(Chess);
  engine.init();

  // Play two moves: 1. e4 1... e5
  engine.makeMove({ from: 'e2', to: 'e4', playerName: 'Alice' });
  engine.makeMove({ from: 'e7', to: 'e5', playerName: 'Bob' });

  const liveState = engine.getState();
  assert.strictEqual(liveState.history.length, 2);

  // 1. Inspect Ply 0 (Starting position before any moves)
  const ply0 = engine.getStateAtPly(0);
  assert.strictEqual(ply0.isHistorical, true);
  assert.strictEqual(ply0.turn, 'w');
  assert.ok(!ply0.lastMove, 'No last move at ply 0');
  // Verify e2 pawn is on starting square, e4 is empty
  const board0 = ply0.board;
  assert.strictEqual(board0[6][4].type, 'p', 'e2 has pawn at ply 0');
  assert.strictEqual(board0[4][4], null, 'e4 is empty at ply 0');

  // 2. Inspect Ply 1 (After 1. e4)
  const ply1 = engine.getStateAtPly(1);
  assert.strictEqual(ply1.isHistorical, true);
  assert.strictEqual(ply1.turn, 'b');
  assert.strictEqual(ply1.lastMove.to, 'e4');
  const board1 = ply1.board;
  assert.strictEqual(board1[4][4].type, 'p', 'e4 has pawn at ply 1');
  assert.strictEqual(board1[1][4].type, 'p', 'e7 has pawn at ply 1');

  // 3. Inspect Ply 2 (After 1... e5)
  const ply2 = engine.getStateAtPly(2);
  assert.strictEqual(ply2.isHistorical, true);
  assert.strictEqual(ply2.turn, 'w');
  assert.strictEqual(ply2.lastMove.to, 'e5');

  // 4. Verify live game state was NOT mutated by inspecting history
  assert.strictEqual(engine.getState().history.length, 2);
  assert.strictEqual(engine.getState().turn, 'w');

  // 5. Verify reconstruction after remote state synchronization
  const remoteEngine = new ChessEngine(Chess);
  remoteEngine.init(liveState.fen);
  remoteEngine.reconstructSnapshots(liveState.history);

  const remotePly0 = remoteEngine.getStateAtPly(0);
  assert.strictEqual(remotePly0.board[6][4].type, 'p', 'Remote engine properly stepped back to ply 0');
  const remotePly1 = remoteEngine.getStateAtPly(1);
  assert.strictEqual(remotePly1.lastMove.to, 'e4', 'Remote engine properly stepped back to ply 1');
});

test('Resignation Rule: Resigning awards win to opponent and blocks subsequent moves', (t) => {
  function processResignation(gameState, playerName, clientId, gameType = 'chess') {
    if (!gameState || !gameState.history || gameState.history.length === 0) {
      return { success: false, error: 'No moves played' };
    }
    if (gameState.status === 'checkmate' || gameState.status === 'game_over' || gameState.status === 'resigned') {
      return { success: false, error: 'Game already ended' };
    }

    const turn = gameState.turn || 'w';
    let resigningSide = 'White';
    let winningSide = 'Black';
    let winnerKey = 'b';

    if (gameType === 'chess') {
      if (turn === 'w') {
        resigningSide = 'White';
        winningSide = 'Black';
        winnerKey = 'b';
      } else {
        resigningSide = 'Black';
        winningSide = 'White';
        winnerKey = 'w';
      }
    } else if (gameType === 'xiangqi') {
      if (turn === 'red') {
        resigningSide = 'Red';
        winningSide = 'Black';
        winnerKey = 'black';
      } else {
        resigningSide = 'Black';
        winningSide = 'Red';
        winnerKey = 'red';
      }
    } else if (gameType === 'shogi') {
      if (turn === 'sente') {
        resigningSide = 'Sente';
        winningSide = 'Gote';
        winnerKey = 'gote';
      } else {
        resigningSide = 'Gote';
        winningSide = 'Sente';
        winnerKey = 'sente';
      }
    }

    const outcomeText = `${playerName} resigned for ${resigningSide}`;
    return {
      success: true,
      newState: {
        ...gameState,
        status: 'resigned',
        winner: winnerKey,
        reason: outcomeText,
        resignedBy: { name: playerName, clientId, side: resigningSide }
      }
    };
  }

  // 1. Resigning before any moves -> Rejected
  const freshGame = { status: 'active', turn: 'w', history: [] };
  const res0 = processResignation(freshGame, 'Lynx', 'c1', 'chess');
  assert.strictEqual(res0.success, false, 'Cannot resign before any moves are made');

  // 2. White to move resigns -> Black wins
  const activeChess = { status: 'active', turn: 'w', history: [{ san: 'e4' }] };
  const resWhite = processResignation(activeChess, 'Lynx', 'c1', 'chess');
  assert.strictEqual(resWhite.success, true);
  assert.strictEqual(resWhite.newState.status, 'resigned');
  assert.strictEqual(resWhite.newState.winner, 'b', 'Opponent Black is awarded the win');
  assert.strictEqual(resWhite.newState.resignedBy.side, 'White');
  assert.strictEqual(resWhite.newState.reason, 'Lynx resigned for White');

  // 3. Black to move resigns -> White wins
  const blackTurnChess = { status: 'active', turn: 'b', history: [{ san: 'e4' }, { san: 'e5' }] };
  const resBlack = processResignation(blackTurnChess, 'Wolf', 'c2', 'chess');
  assert.strictEqual(resBlack.success, true);
  assert.strictEqual(resBlack.newState.winner, 'w', 'Opponent White is awarded the win');
  assert.strictEqual(resBlack.newState.reason, 'Wolf resigned for Black');

  // 4. Moving after resignation is blocked
  function attemptMoveOnState(state) {
    if (state.status === 'resigned' || state.status === 'checkmate' || state.status === 'game_over') {
      return { success: false, error: 'Game ended' };
    }
    return { success: true };
  }
  assert.strictEqual(attemptMoveOnState(resWhite.newState).success, false, 'Moves blocked after resignation');

  // 5. Xiangqi: Red resigns -> Black wins
  const activeXiangqi = { status: 'active', turn: 'red', history: [{ san: 'c3-c4' }] };
  const resXq = processResignation(activeXiangqi, 'Falcon', 'c3', 'xiangqi');
  assert.strictEqual(resXq.newState.winner, 'black');

  // 6. Shogi: Sente resigns -> Gote wins
  const activeShogi = { status: 'active', turn: 'sente', history: [{ san: '7g-7f' }] };
  const resShogi = processResignation(activeShogi, 'Tiger', 'c4', 'shogi');
  assert.strictEqual(resShogi.newState.winner, 'gote');
});

test('Theme Toggle: Dark and Light mode state switching', (t) => {
  class ThemeManager {
    constructor(initialTheme = 'dark') {
      this.currentTheme = initialTheme;
    }

    toggleTheme() {
      this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
      return this.currentTheme;
    }

    getTheme() {
      return this.currentTheme;
    }
  }

  const tm = new ThemeManager('dark');
  assert.strictEqual(tm.getTheme(), 'dark', 'Default theme should be dark');

  // Switch to Light
  const t1 = tm.toggleTheme();
  assert.strictEqual(t1, 'light', 'Theme toggles to light');
  assert.strictEqual(tm.getTheme(), 'light');

  // Switch back to Dark
  const t2 = tm.toggleTheme();
  assert.strictEqual(t2, 'dark', 'Theme toggles back to dark');
  assert.strictEqual(tm.getTheme(), 'dark');
});



