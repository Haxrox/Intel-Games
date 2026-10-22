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

test('Board Auto-Flip Consistency Logic', (t) => {
  // Simulate board orientation helper logic used across renderers
  function computeBoardFlipped(state, currentTurn, myClientId, myPlayerName, currentFlipped, autoOrient = true) {
    if (!autoOrient) return currentFlipped;
    const lastMover = state && state.lastMover;
    const iMovedLast = lastMover && (
      (myClientId && lastMover.clientId === myClientId) ||
      (myPlayerName && lastMover.name && lastMover.name.toLowerCase() === myPlayerName.trim().toLowerCase())
    );
    if (!iMovedLast) {
      return (currentTurn === 'b');
    }
    return currentFlipped; // Consistent perspective
  }

  // Initial state: White to move, board is unflipped (White at bottom)
  let state = {
    turn: 'w',
    lastMover: null
  };

  const aliceClientId = 'client_alice';
  const bobClientId = 'client_bob';

  let aliceFlipped = false;
  let bobFlipped = false;

  // 1. Initial orientation:
  aliceFlipped = computeBoardFlipped(state, 'w', aliceClientId, 'Alice', aliceFlipped);
  bobFlipped = computeBoardFlipped(state, 'w', bobClientId, 'Bob', bobFlipped);
  assert.strictEqual(aliceFlipped, false, 'Alice should initially see White at bottom');
  assert.strictEqual(bobFlipped, false, 'Bob should initially see White at bottom');

  // 2. Alice makes White move e4 -> Turn is now 'b' (Black)
  state = {
    turn: 'b',
    lastMover: { clientId: aliceClientId, name: 'Alice' }
  };

  // Alice's board MUST NOT auto-flip because Alice just made the move!
  aliceFlipped = computeBoardFlipped(state, 'b', aliceClientId, 'Alice', aliceFlipped);
  assert.strictEqual(aliceFlipped, false, 'CRITICAL: Alice board must NOT auto-flip after Alice moved!');

  // Bob did NOT make the move, so Bob auto-orients to Black's perspective
  bobFlipped = computeBoardFlipped(state, 'b', bobClientId, 'Bob', bobFlipped);
  assert.strictEqual(bobFlipped, true, 'Bob auto-orients to Black to play next move');

  // 3. Bob makes Black move e5 -> Turn is now 'w' (White)
  state = {
    turn: 'w',
    lastMover: { clientId: bobClientId, name: 'Bob' }
  };

  // Bob's board MUST NOT auto-flip because Bob just made the move!
  bobFlipped = computeBoardFlipped(state, 'w', bobClientId, 'Bob', bobFlipped);
  assert.strictEqual(bobFlipped, true, 'CRITICAL: Bob board must NOT auto-flip after Bob moved!');

  // Alice did NOT make this move, so Alice orients to White to play next move
  aliceFlipped = computeBoardFlipped(state, 'w', aliceClientId, 'Alice', aliceFlipped);
  assert.strictEqual(aliceFlipped, false, 'Alice orients to White ready for next move');
});

test('Board Auto-Flip Consistency: No Auto-Flip during Preview or History Preview', (t) => {
  function computeBoardFlipped(state, currentTurn, myClientId, myPlayerName, currentFlipped, autoOrient = true) {
    if (!autoOrient) return currentFlipped;
    // Don't autoflip the board for move previews or historical previews!
    if (state && (state.isPreview || state.isHistorical)) {
      return currentFlipped;
    }
    const lastMover = state && state.lastMover;
    const iMovedLast = lastMover && (
      (myClientId && lastMover.clientId === myClientId) ||
      (myPlayerName && lastMover.name && lastMover.name.toLowerCase() === myPlayerName.trim().toLowerCase())
    );
    if (!iMovedLast) {
      return (currentTurn === 'b');
    }
    return currentFlipped;
  }

  // Bob is currently viewing White's perspective (unflipped)
  let bobFlipped = false;

  // Bob starts previewing e4 -> next turn in preview is Black ('b')
  const previewState = { isPreview: true, turn: 'b' };
  bobFlipped = computeBoardFlipped(previewState, 'b', 'client_bob', 'Bob', bobFlipped);
  assert.strictEqual(bobFlipped, false, 'CRITICAL: Board must NOT auto-flip for move previews!');

  // Bob steps history back to ply 1 (turn 'b')
  const historicalState = { isHistorical: true, turn: 'b', ply: 1 };
  bobFlipped = computeBoardFlipped(historicalState, 'b', 'client_bob', 'Bob', bobFlipped);
  assert.strictEqual(bobFlipped, false, 'CRITICAL: Board must NOT auto-flip during history preview!');
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



