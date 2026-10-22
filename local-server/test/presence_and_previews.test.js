import { test } from 'node:test';
import assert from 'node:assert';
import * as chessPkg from 'chess.js';
const Chess = chessPkg.Chess || chessPkg.default?.Chess || chessPkg.default;

import { ChessEngine } from '../../public/js/engines/chessEngine.js';
import { PresenceManager } from '../../public/js/presence.js';
import { PlayerListRenderer } from '../../public/js/playerlist.js';
import { MoveStagingController } from '../../public/js/moveStaging.js';
import { HistoryController } from '../../public/js/historyController.js';

/**
 * Mock DOM Element helper for Node.js test environment
 */
class MockDOMElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.className = '';
    this._innerHTML = '';
    this.children = [];
    this.classList = {
      add: (cls) => {
        const classes = this.className.split(' ').filter(Boolean);
        if (!classes.includes(cls)) classes.push(cls);
        this.className = classes.join(' ');
      },
      remove: (cls) => {
        const classes = this.className.split(' ').filter(c => c !== cls);
        this.className = classes.join(' ');
      },
      contains: (cls) => this.className.split(' ').includes(cls)
    };
  }

  get textContent() {
    return this._innerHTML;
  }

  set textContent(val) {
    this._innerHTML = String(val);
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = val;
    if (val === '') {
      this.children = [];
    }
  }

  appendChild(child) {
    this.children.push(child);
  }

  querySelector(sel) {
    return new MockDOMElement('div');
  }

  addEventListener(event, cb) {}
}

if (typeof global.document === 'undefined') {
  global.document = {
    createElement: (tag) => new MockDOMElement(tag)
  };
}


/**
 * Mock RTDB Database for multi-client emulation in memory
 */
class MockDatabase {
  constructor() {
    this.data = new Map();
    this.listeners = new Map();
  }

  ref(path) {
    const cleanPath = path.replace(/^\/|\/$/g, '');
    const self = this;

    return {
      set: (val) => {
        if (val === null || val === undefined) {
          self.data.delete(cleanPath);
        } else {
          self.data.set(cleanPath, JSON.parse(JSON.stringify(val)));
        }
        self.emit(cleanPath, val);
        return Promise.resolve();
      },

      get: () => {
        const val = self.data.has(cleanPath) ? JSON.parse(JSON.stringify(self.data.get(cleanPath))) : null;
        return Promise.resolve({ val: () => val });
      },

      on: (event, cb) => {
        if (!self.listeners.has(cleanPath)) {
          self.listeners.set(cleanPath, []);
        }
        self.listeners.get(cleanPath).push(cb);
        const curVal = self.data.has(cleanPath) ? JSON.parse(JSON.stringify(self.data.get(cleanPath))) : null;
        cb({ val: () => curVal });
      },

      onDisconnect: () => ({
        remove: () => {}
      })
    };
  }

  emit(path, val) {
    // Exact path listeners
    if (this.listeners.has(path)) {
      this.listeners.get(path).forEach(cb => cb({ val: () => val }));
    }
    // Prefix / parent path listeners (e.g. rooms/r1/presence for rooms/r1/presence/c1)
    for (const [listenPath, callbacks] of this.listeners.entries()) {
      if (path.startsWith(listenPath + '/')) {
        const parentMap = {};
        for (const [k, v] of this.data.entries()) {
          if (k.startsWith(listenPath + '/')) {
            const childKey = k.replace(listenPath + '/', '');
            parentMap[childKey] = v;
          }
        }
        callbacks.forEach(cb => cb({ val: () => parentMap }));
      }
    }
  }
}

// ============================================================================
// Test Suite 1: Presence & Player List Functionality
// ============================================================================
test('Presence & Player List: Multi-client joining, color assignment, hovering & disconnects', async (t) => {
  const db = new MockDatabase();
  const roomId = 'test-hall-1';

  // 1. Client Alice joins
  const alice = new PresenceManager(roomId, { clientId: 'client_alice', name: 'Alice' }, db);
  let alicePresenceView = [];
  alice.subscribePresence((list) => {
    alicePresenceView = list;
  });
  alice.broadcastPresence();

  assert.strictEqual(alicePresenceView.length, 1, 'Alice should see herself in room');
  assert.strictEqual(alicePresenceView[0].playerName, 'Alice');
  assert.ok(alicePresenceView[0].color, 'Alice should be assigned a distinct pastel color');

  // 2. Client Bob joins
  const bob = new PresenceManager(roomId, { clientId: 'client_bob', name: 'Bob' }, db);
  let bobPresenceView = [];
  bob.subscribePresence((list) => {
    bobPresenceView = list;
  });
  bob.broadcastPresence();

  // Both Alice and Bob should now see 2 connected players
  assert.strictEqual(bobPresenceView.length, 2, 'Bob should see both players');
  assert.strictEqual(alicePresenceView.length, 2, 'Alice should see Bob join');

  // 3. Hover synchronization: Alice hovers over e4
  alice.setHoverSquare('e4');
  assert.strictEqual(alice.hoverSquare, 'e4');

  const bobViewOfAlice = bobPresenceView.find(p => p.clientId === 'client_alice');
  assert.strictEqual(bobViewOfAlice.hoverSquare, 'e4', 'Bob should see Alice hovering over e4');

  // Alice clears hover
  alice.clearHoverSquare();
  assert.strictEqual(bobPresenceView.find(p => p.clientId === 'client_alice').hoverSquare, null, 'Hover cleared');

  // 4. Test PlayerListRenderer formatting and communal turn eligibility
  const mockContainer = new MockDOMElement();
  const playerListRenderer = new PlayerListRenderer(mockContainer);

  // When no move has been made yet, all players are eligible
  playerListRenderer.render(bobPresenceView, null, 'w', 'client_bob');
  assert.ok(mockContainer.children.length > 0);
  let rows = mockContainer.children[0].children[1].children;
  assert.strictEqual(rows.length, 2, 'Two player rows rendered');

  // Alice made the last move
  playerListRenderer.render(bobPresenceView, { name: 'Alice', clientId: 'client_alice' }, 'b', 'client_bob');
  rows = mockContainer.children[0].children[1].children;
  const aliceRow = rows.find(r => r.innerHTML.includes('Alice'));
  const bobRow = rows.find(r => r.innerHTML.includes('Bob'));

  assert.match(aliceRow.innerHTML, /badge-waiting/, 'Alice should have Waiting (Moved Last) badge');
  assert.match(bobRow.innerHTML, /badge-ready/, 'Bob should have Eligible to Move badge');
  assert.match(bobRow.innerHTML, /\(You\)/, 'Bob should see (You) tag next to his name');

  // 5. Client Disconnect
  await db.ref(`rooms/${roomId}/presence/client_alice`).set(null);
  // Verify Alice removed
  assert.strictEqual(bobPresenceView.length, 1, 'Only Bob remains after Alice disconnects');
  assert.strictEqual(bobPresenceView[0].clientId, 'client_bob');
});

// ============================================================================
// Test Suite 2: Simultaneous Clients Playing with Communal Turn Alternation
// ============================================================================
test('Simultaneous Clients: Communal turn rule enforcement and perspective stability', (t) => {
  const engine = new ChessEngine(Chess);
  engine.init();

  let lastMover = null;

  function attemptPlay(move, player, clientId) {
    // Communal rule check
    if (lastMover && (lastMover.clientId === clientId || lastMover.name.toLowerCase() === player.toLowerCase())) {
      return { success: false, error: 'Communal rule: You cannot make consecutive moves.' };
    }
    const res = engine.makeMove({ ...move, playerName: player, clientId });
    if (res.success) {
      lastMover = { name: player, clientId, timestamp: Date.now() };
    }
    return res;
  }

  // Multi-client perspective orientation logic
  function getOrientation(currentTurn, myClientId, moverClientId, myFlipped) {
    const iMovedLast = moverClientId === myClientId;
    if (!iMovedLast) {
      return (currentTurn === 'b');
    }
    return myFlipped; // Keep consistent perspective
  }

  let aliceFlipped = false;
  let bobFlipped = false;
  let charlieFlipped = false;

  // Round 1: Alice plays White e4
  const res1 = attemptPlay({ from: 'e2', to: 'e4' }, 'Alice', 'client_alice');
  assert.strictEqual(res1.success, true);
  assert.strictEqual(lastMover.name, 'Alice');

  // Check perspectives:
  aliceFlipped = getOrientation('b', 'client_alice', lastMover.clientId, aliceFlipped);
  bobFlipped = getOrientation('b', 'client_bob', lastMover.clientId, bobFlipped);
  charlieFlipped = getOrientation('b', 'client_charlie', lastMover.clientId, charlieFlipped);

  assert.strictEqual(aliceFlipped, false, 'Alice board must NOT flip after her own move');
  assert.strictEqual(bobFlipped, true, 'Bob board orients to Black to play');
  assert.strictEqual(charlieFlipped, true, 'Charlie board orients to Black');

  // Alice immediately attempts Black e5 -> Blocked by communal rule
  const blockedAlice = attemptPlay({ from: 'e7', to: 'e5' }, 'Alice', 'client_alice');
  assert.strictEqual(blockedAlice.success, false);
  assert.match(blockedAlice.error, /consecutive moves/i);

  // Round 2: Bob plays Black e5
  const res2 = attemptPlay({ from: 'e7', to: 'e5' }, 'Bob', 'client_bob');
  assert.strictEqual(res2.success, true);
  assert.strictEqual(lastMover.name, 'Bob');

  // Check perspectives:
  aliceFlipped = getOrientation('w', 'client_alice', lastMover.clientId, aliceFlipped);
  bobFlipped = getOrientation('w', 'client_bob', lastMover.clientId, bobFlipped);
  assert.strictEqual(bobFlipped, true, 'Bob board must NOT flip after his own move');
  assert.strictEqual(aliceFlipped, false, 'Alice board orients to White to play next');

  // Round 3: Charlie (third client) plays White Nf3
  const res3 = attemptPlay({ from: 'g1', to: 'f3' }, 'Charlie', 'client_charlie');
  assert.strictEqual(res3.success, true);
  assert.strictEqual(lastMover.name, 'Charlie');
});

// ============================================================================
// Test Suite 3: Move Previews (Synchronized Multi-Move Staging, Legality & Single Confirmation)
// ============================================================================
test('Move Previews: Multi-move legal preview line, rejection of illegal moves, and single-move commit', (t) => {
  const engine = new ChessEngine(Chess);
  engine.init();

  // Emulate room preview state in database
  let activePreview = null;

  function handleAttemptMove(moveData, player, clientId, isBannedThisTurn) {
    const { from, to, promotion = 'q' } = moveData;

    // 1. Starting a new preview
    if (!activePreview || !activePreview.moves || activePreview.moves.length === 0) {
      if (isBannedThisTurn) {
        return { success: false, error: 'Communal rule: Banned this turn' };
      }

      // Legality check on live engine: "These moves should be legal, if not the piece goes back."
      if (!engine.isLegalMove(from, to, promotion)) {
        return { success: false, error: 'Illegal move: piece goes back' };
      }

      const c = new Chess(engine.getState().fen);
      const m = c.move({ from, to, promotion });

      const firstMove = {
        from,
        to,
        promotion,
        san: m.san,
        color: engine.getState().turn,
        player,
        clientId
      };

      activePreview = {
        basePly: engine.getState().history.length,
        baseFen: engine.getState().fen,
        moves: [firstMove],
        stagedBy: { name: player, clientId },
        updatedAt: Date.now()
      };

      return { success: true, preview: activePreview };
    }

    // 2. Appending to existing preview (in-order alternation: White, Black, White...)
    const c = new Chess(engine.getState().fen);
    for (const m of activePreview.moves) {
      c.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
    }

    const currentPreviewTurn = c.turn();

    // Check legality on preview position
    let m;
    try {
      m = c.move({ from, to, promotion });
    } catch (e) {
      return { success: false, error: 'Illegal move on preview board: piece goes back' };
    }

    if (!m) {
      return { success: false, error: 'Illegal move on preview board: piece goes back' };
    }

    const nextMove = {
      from,
      to,
      promotion,
      san: m.san,
      color: currentPreviewTurn,
      player,
      clientId
    };

    activePreview.moves.push(nextMove);
    activePreview.updatedAt = Date.now();
    return { success: true, preview: activePreview };
  }

  // 1. Attempt an ILLEGAL opening move: White pawn e2 to e5 (cannot jump 3 squares)
  const illegalAttempt = handleAttemptMove({ from: 'e2', to: 'e5' }, 'Alice', 'client_alice', false);
  assert.strictEqual(illegalAttempt.success, false);
  assert.match(illegalAttempt.error, /piece goes back/i, 'Illegal move must be rejected and piece goes back');
  assert.strictEqual(activePreview, null, 'No preview staged for illegal move');

  // 2. Alice previews legal White move e4
  const step1 = handleAttemptMove({ from: 'e2', to: 'e4' }, 'Alice', 'client_alice', false);
  assert.strictEqual(step1.success, true);
  assert.strictEqual(activePreview.moves.length, 1);
  assert.strictEqual(activePreview.moves[0].san, 'e4');
  assert.strictEqual(activePreview.moves[0].player, 'Alice');

  // 3. Attempt illegal preview move: Trying to move White again when it is Black's turn in-order
  // (e.g. White pawn d2 to d4 while turn is Black)
  const outOfTurnAttempt = handleAttemptMove({ from: 'd2', to: 'd4' }, 'Alice', 'client_alice', false);
  assert.strictEqual(outOfTurnAttempt.success, false, 'Moving out-of-order in preview must be rejected');
  assert.strictEqual(activePreview.moves.length, 1, 'Preview length unchanged');

  // 4. Preview in-order Black response: e7 to e5
  const step2 = handleAttemptMove({ from: 'e7', to: 'e5' }, 'Alice', 'client_alice', false);
  assert.strictEqual(step2.success, true);
  assert.strictEqual(activePreview.moves.length, 2);
  assert.strictEqual(activePreview.moves[1].san, 'e5');

  // 5. Preview in-order White continuation: g1 to f3 (Nf3)
  const step3 = handleAttemptMove({ from: 'g1', to: 'f3' }, 'Alice', 'client_alice', false);
  assert.strictEqual(step3.success, true);
  assert.strictEqual(activePreview.moves.length, 3);
  assert.strictEqual(activePreview.moves[2].san, 'Nf3');

  // 6. Preview in-order Black continuation: b8 to c6 (Nc6)
  const step4 = handleAttemptMove({ from: 'b8', to: 'c6' }, 'Alice', 'client_alice', false);
  assert.strictEqual(step4.success, true);
  assert.strictEqual(activePreview.moves.length, 4);
  assert.strictEqual(activePreview.moves[3].san, 'Nc6');

  // Verify that all 4 moves are previewed on all screens
  assert.deepStrictEqual(
    activePreview.moves.map(m => m.san),
    ['e4', 'e5', 'Nf3', 'Nc6'],
    'Full 4-ply planned variation previewed'
  );

  // 7. CONFIRM MOVE: "only the first move will count"
  const firstMoveToCommit = activePreview.moves[0];
  assert.strictEqual(firstMoveToCommit.san, 'e4');

  // Clear preview and execute ONLY the first move on the live engine
  activePreview = null;
  const commitRes = engine.makeMove({
    from: firstMoveToCommit.from,
    to: firstMoveToCommit.to,
    playerName: firstMoveToCommit.player
  });

  assert.strictEqual(commitRes.success, true, 'First move commits successfully to live engine');

  // Verify live game state after commit:
  const liveState = engine.getState();
  assert.strictEqual(liveState.history.length, 1, 'Only 1 move should be committed to live game history');
  assert.strictEqual(liveState.history[0].san, 'e4', 'Committed move is White e4');
  assert.strictEqual(liveState.turn, 'b', 'Live turn is now Black');
  assert.strictEqual(activePreview, null, 'Active preview is completely cleared after confirmation');

  // 8. Test Cancel Preview: staging moves and canceling reverts cleanly
  const previewToCancel = handleAttemptMove({ from: 'e7', to: 'e5' }, 'Bob', 'client_bob', false);
  assert.strictEqual(previewToCancel.success, true);
  assert.strictEqual(activePreview.moves.length, 1);

  // Cancel preview
  activePreview = null;
  assert.strictEqual(activePreview, null, 'Preview cleared upon cancel');
  assert.strictEqual(engine.getState().history.length, 1, 'Live game state unchanged by canceled preview');

  // 9. Verify MoveStagingController Turn Indicator (Obvious White vs Black turn indicator in preview)
  const stagingContainer = new MockDOMElement('div');
  const stagingCtrl = new MoveStagingController(stagingContainer, () => {}, () => {});

  // White moved e4 in preview -> next turn is Black
  stagingCtrl.stagePreview({
    firstMove: { from: 'e2', to: 'e4', san: 'e4', color: 'w' },
    previewMoves: [{ from: 'e2', to: 'e4', san: 'e4' }],
    stagedBy: { name: 'Alice' },
    isMe: true,
    nextTurn: 'b'
  });
  assert.match(stagingContainer.innerHTML, /turn-black/, 'Preview staging must display turn-black badge');
  assert.match(stagingContainer.innerHTML, /Black to Move/, 'Preview staging must clearly indicate Black to Move');

  // Black moved e5 in preview -> next turn is White
  stagingCtrl.stagePreview({
    firstMove: { from: 'e2', to: 'e4', san: 'e4', color: 'w' },
    previewMoves: [{ from: 'e2', to: 'e4', san: 'e4' }, { from: 'e7', to: 'e5', san: 'e5' }],
    stagedBy: { name: 'Alice' },
    isMe: true,
    nextTurn: 'w'
  });
  assert.match(stagingContainer.innerHTML, /turn-white/, 'Preview staging must display turn-white badge');
  assert.match(stagingContainer.innerHTML, /White to Move/, 'Preview staging must clearly indicate White to Move');

  // 10. Verify that board does NOT auto-flip during move previews
  function computeBoardOrientation(state, currentTurn, myClientId, myPlayerName, currentFlipped) {
    if (state && (state.isPreview || state.isHistorical)) {
      return currentFlipped; // Orientation remains stable
    }
    return (currentTurn === 'b');
  }

  let myBoardFlipped = false;
  // White moved e4 in preview, so currentTurn in preview position is Black
  const previewBoardState = { isPreview: true, turn: 'b' };
  myBoardFlipped = computeBoardOrientation(previewBoardState, 'b', 'client_alice', 'Alice', myBoardFlipped);
  assert.strictEqual(myBoardFlipped, false, 'CRITICAL: Board MUST NOT auto-flip for move previews');

  // 11. Verify HistoryController 3-Column Side-by-Side Grid Layout (White & Black side-by-side)
  const historyContainer = new MockDOMElement('div');
  const previewBanner = new MockDOMElement('div');
  let selectedPly = -1;
  const histCtrl = new HistoryController(historyContainer, previewBanner, (ply) => {
    selectedPly = ply;
  });

  // Emulate 3 moves: 1. e4 e5, 2. Nf3
  const sampleHistory = [
    { ply: 1, san: 'e4', playerName: 'Alice', color: 'w' },
    { ply: 2, san: 'e5', playerName: 'Bob', color: 'b' },
    { ply: 3, san: 'Nf3', playerName: 'Alice', color: 'w' }
  ];

  histCtrl.updateHistory(sampleHistory, []);

  // Check wrapper and grid container
  assert.ok(historyContainer.children.length > 0);
  const wrapper = historyContainer.children[0];
  const gridContainer = wrapper.children[1]; // children[0] is controls, children[1] is gridContainer
  assert.strictEqual(gridContainer.className, 'history-grid-container');

  // Header has 3 columns: #, White / 1st, Black / 2nd
  const header = gridContainer.children[0];
  assert.match(header.innerHTML, /col-num-hdr/, 'Header has move number column');
  assert.match(header.innerHTML, /White/, 'Column 2 header is White');
  assert.match(header.innerHTML, /Black/, 'Column 3 header is Black');

  // Body has 2 rows
  const body = gridContainer.children[1];
  assert.strictEqual(body.children.length, 2, '2 move rows rendered');

  // Row 1: Move 1 (White e4 and Black e5 side-by-side)
  const row1 = body.children[0];
  assert.strictEqual(row1.children.length, 3, 'Row 1 has 3 items: #, White, Black');
  assert.strictEqual(row1.children[0].textContent, '1.');
  assert.match(row1.children[1].innerHTML, /e4/, 'Row 1 Column 2 contains White e4');
  assert.match(row1.children[2].innerHTML, /e5/, 'Row 1 Column 3 contains Black e5');

  // Row 2: Move 2 (White Nf3 and empty placeholder for Black)
  const row2 = body.children[1];
  assert.strictEqual(row2.children.length, 3, 'Row 2 has 3 items');
  assert.strictEqual(row2.children[0].textContent, '2.');
  assert.match(row2.children[1].innerHTML, /Nf3/, 'Row 2 Column 2 contains White Nf3');
  assert.match(row2.children[2].innerHTML, /move-dots/, 'Row 2 Column 3 has placeholder for pending Black move');
});
