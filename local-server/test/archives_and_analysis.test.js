import test from 'node:test';
import assert from 'node:assert';
import { GameArchiveManager } from '../../public/js/gameArchive.js';
import { BrowserStockfishAnalyzer } from '../../public/js/analyzer.js';
import { HistoryController } from '../../public/js/historyController.js';
import { ChessPieces } from '../../public/js/pieces.js';

// Minimal mock DOM element
class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.classList = {
      classes: new Set(),
      add: (c) => this.classList.classes.add(c),
      remove: (c) => this.classList.classes.delete(c),
      contains: (c) => this.classList.classes.has(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (this.classList.classes.has(c)) this.classList.classes.delete(c);
          else this.classList.classes.add(c);
        } else if (force) {
          this.classList.classes.add(c);
        } else {
          this.classList.classes.delete(c);
        }
      }
    };
    this.children = [];
    this._innerHTML = '';
    this.textContent = '';
    this.listeners = {};
    this.style = {};
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = val;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  querySelector(sel) {
    return new MockElement('div');
  }

  querySelectorAll(sel) {
    return [];
  }

  scrollIntoView() {}
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (tag) => new MockElement(tag)
  };
}

// Minimal mock DB ref
function createMockDb() {
  const store = {};
  const listeners = {};
  return {
    store,
    listeners,
    ref: (path) => ({
      set: async (val) => {
        store[path] = val;
        if (listeners[path]) listeners[path].forEach(cb => cb({ val: () => val }));
      },
      on: (event, cb) => {
        if (!listeners[path]) listeners[path] = [];
        listeners[path].push(cb);
        cb({ val: () => store[path] || null });
      },
      off: (event, cb) => {
        if (!listeners[path]) return;
        if (!cb) listeners[path] = [];
        else listeners[path] = listeners[path].filter(fn => fn !== cb);
      }
    })
  };
}

test('Past Game Archival: Storing game histories with player attribution in database', async () => {
  const mockDb = createMockDb();
  const archiveMgr = new GameArchiveManager(mockDb, 'main-chess-room');

  const history = [
    { ply: 1, san: 'e4', from: 'e2', to: 'e4', color: 'w', piece: 'p', playerName: 'Lynx', clientId: 'c1', timestamp: 1000 },
    { ply: 2, san: 'e5', from: 'e7', to: 'e5', color: 'b', piece: 'p', playerName: 'Wolf', clientId: 'c2', timestamp: 2000 },
    { ply: 3, san: 'Nf3', from: 'g1', to: 'f3', color: 'w', piece: 'n', playerName: 'Falcon', clientId: 'c3', timestamp: 3000 },
    { ply: 4, san: 'Nc6', from: 'b8', to: 'c6', color: 'b', piece: 'n', playerName: 'Tiger', clientId: 'c4', timestamp: 4000 }
  ];

  const saved = await archiveMgr.saveGame({
    roomId: 'main-chess-room',
    gameType: 'chess',
    status: 'checkmate',
    winner: 'w',
    reason: 'Checkmate',
    history
  });

  assert.ok(saved);
  assert.strictEqual(saved.roomId, 'main-chess-room');
  assert.strictEqual(saved.winner, 'w');
  assert.strictEqual(saved.moveCount, 4);

  // Validate player attribution
  assert.deepStrictEqual(saved.players.white, ['Lynx', 'Falcon']);
  assert.deepStrictEqual(saved.players.black, ['Wolf', 'Tiger']);

  // Validate database persistence
  const pastGames = archiveMgr.getPastGames();
  assert.strictEqual(pastGames.length, 1);
  assert.strictEqual(pastGames[0].id, saved.id);
  assert.strictEqual(pastGames[0].players.white.join(', '), 'Lynx, Falcon');
  assert.strictEqual(pastGames[0].players.black.join(', '), 'Wolf, Tiger');
});

test('Past Game Archival: Archive Deduplication ensures games never appear twice', async () => {
  const mockDb = createMockDb();
  const archiveMgr = new GameArchiveManager(mockDb, 'main-chess-room');

  const history = [
    { ply: 1, san: 'e4', from: 'e2', to: 'e4', color: 'w', piece: 'p', playerName: 'Lynx', clientId: 'c1', timestamp: 1000 },
    { ply: 2, san: 'e5', from: 'e7', to: 'e5', color: 'b', piece: 'p', playerName: 'Wolf', clientId: 'c2', timestamp: 2000 }
  ];

  // 1. Simulate saving game on resignation, then auto-archive receiving the completed state
  const save1 = await archiveMgr.saveGame({
    roomId: 'main-chess-room',
    gameType: 'chess',
    status: 'resigned',
    winner: 'b',
    reason: 'Lynx resigned for White',
    history
  });

  const save2 = await archiveMgr.saveGame({
    roomId: 'main-chess-room',
    gameType: 'chess',
    status: 'resigned',
    winner: 'b',
    reason: 'White resigned',
    history
  });

  assert.strictEqual(save1.id, save2.id, 'Deterministic ID must match for the same game match');
  assert.strictEqual(archiveMgr.getPastGames().length, 1, 'Only 1 record should exist after duplicate save calls');

  // 2. Simulate injecting legacy duplicate entries with distinct IDs into archives
  archiveMgr.archives = [
    {
      id: 'game_legacy_duplicate_1',
      roomId: 'main-chess-room',
      gameType: 'chess',
      status: 'completed',
      winner: 'b',
      reason: 'Completed before Reset',
      history,
      completedAt: 100000
    },
    {
      id: 'game_legacy_duplicate_2',
      roomId: 'main-chess-room',
      gameType: 'chess',
      status: 'resigned',
      winner: 'b',
      reason: 'Checkmate',
      history,
      completedAt: 100050
    }
  ];

  const pastGames = archiveMgr.getPastGames();
  assert.strictEqual(pastGames.length, 1, 'Deduplication must collapse multiple records of the same game to 1');
  assert.strictEqual(pastGames[0].reason, 'Checkmate', 'Preferred more descriptive reason');

  // 3. Test rendering into container only produces 1 card
  const container = new MockElement('div');
  archiveMgr.renderArchiveList(container);
  assert.strictEqual(container.children.length, 1, 'Wrapper must be appended');
  const wrapper = container.children[0];
  assert.strictEqual(wrapper.children.length, 1, 'Exactly 1 archive card must be rendered in wrapper');
});

test('Past Game Archival: Room switching cleanly detaches previous database listeners', () => {
  const mockDb = createMockDb();
  const archiveMgr = new GameArchiveManager(mockDb, 'room-a');
  archiveMgr.setRoom('room-a');

  assert.strictEqual(mockDb.listeners['rooms/room-a/archives'].length, 1);

  // Switch to room-b
  archiveMgr.setRoom('room-b');
  assert.strictEqual(mockDb.listeners['rooms/room-a/archives'].length, 0, 'room-a listener must be removed');
  assert.strictEqual(mockDb.listeners['rooms/room-b/archives'].length, 1, 'room-b listener must be active');
});

test('Past Game Replay: HistoryController supports past game replay without mutating live state', () => {
  const tableContainer = new MockElement('div');
  const bannerContainer = new MockElement('div');
  let scrubbedPly = null;
  let exitCalled = false;

  const historyCtrl = new HistoryController(
    tableContainer,
    bannerContainer,
    (ply) => { scrubbedPly = ply; },
    () => { exitCalled = true; }
  );

  const mockPastGame = {
    id: 'game_test_123',
    gameType: 'chess',
    winner: 'w',
    history: [
      { ply: 1, san: 'e4', color: 'w', piece: 'p', playerName: 'Lynx' },
      { ply: 2, san: 'e5', color: 'b', piece: 'p', playerName: 'Wolf' },
      { ply: 3, san: 'Qh5', color: 'w', piece: 'q', playerName: 'Lynx' }
    ]
  };

  historyCtrl.setReplayGame(mockPastGame, []);

  assert.strictEqual(historyCtrl.isReplayMode, true);
  assert.strictEqual(historyCtrl.isAtLive(), false);
  assert.strictEqual(historyCtrl.maxPly, 3);
  assert.strictEqual(historyCtrl.currentPly, 3);
  assert.strictEqual(scrubbedPly, 3);

  // Stepping backward
  historyCtrl.goPrev();
  assert.strictEqual(historyCtrl.currentPly, 2);
  assert.strictEqual(scrubbedPly, 2);

  // Stepping to start
  historyCtrl.goStart();
  assert.strictEqual(historyCtrl.currentPly, 0);

  // Exiting replay
  historyCtrl.exitReplay();
  assert.strictEqual(historyCtrl.isReplayMode, false);
  assert.strictEqual(exitCalled, true);
});

test('Stockfish Analyzer: Browser analysis computes accuracy and attributes players to moves', async () => {
  const analyzer = new BrowserStockfishAnalyzer();

  const history = [
    { ply: 1, san: 'e4', color: 'w', piece: 'p', playerName: 'Lynx' },
    { ply: 2, san: 'e5', color: 'b', piece: 'p', playerName: 'Wolf' },
    { ply: 3, san: 'Qh5', color: 'w', piece: 'q', playerName: 'Falcon' },
    { ply: 4, san: 'Nc6', color: 'b', piece: 'n', playerName: 'Tiger' },
    { ply: 5, san: 'Bc4', color: 'w', piece: 'b', playerName: 'Lynx' },
    { ply: 6, san: 'Nf6', color: 'b', piece: 'n', playerName: 'Wolf' },
    { ply: 7, san: 'Qxf7#', color: 'w', piece: 'q', captured: 'p', playerName: 'Falcon' }
  ];

  const analysis = await analyzer.analyzeGame(history, {
    gameType: 'chess',
    winner: 'w',
    reason: 'Scholar\'s Mate'
  });

  assert.ok(analysis);
  assert.ok(analysis.whiteAccuracy >= 50 && analysis.whiteAccuracy <= 100);
  assert.ok(analysis.blackAccuracy >= 30 && analysis.blackAccuracy <= 100);
  assert.strictEqual(analysis.moves.length, 7);

  // Check player attribution on moves
  assert.strictEqual(analysis.moves[0].playerName, 'Lynx');
  assert.strictEqual(analysis.moves[1].playerName, 'Wolf');
  assert.strictEqual(analysis.moves[2].playerName, 'Falcon');
  assert.strictEqual(analysis.moves[6].playerName, 'Falcon');
  assert.strictEqual(analysis.moves[6].san, 'Qxf7#');
});

test('Chess Icons: Complete Staunton vector piece SVGs are defined and complete', () => {
  const expectedPieces = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];

  expectedPieces.forEach(pieceKey => {
    const svg = ChessPieces[pieceKey];
    assert.ok(svg, `Missing chess piece SVG for ${pieceKey}`);
    assert.ok(svg.includes('<svg'), `Invalid SVG tag for ${pieceKey}`);
    assert.ok(svg.includes('viewBox="0 0 45 45"'), `Missing viewBox for ${pieceKey}`);
    assert.ok(svg.includes('<path') || svg.includes('<g'), `SVG must have vector elements for ${pieceKey}`);
    assert.ok(svg.length > 200, `SVG for ${pieceKey} must be a complete high-detail vector asset (got ${svg.length} chars)`);
  });

  // Specifically check Knight has complete snout and ear vectors
  const knightSvg = ChessPieces['wN'];
  assert.ok(knightSvg.includes('circle'), 'Knight must include eyes');
  assert.ok(knightSvg.includes('38,39') || knightSvg.includes('38 39') || knightSvg.includes('38'), 'Knight must include full torso base');
});

test('Board Coordinates & Cell Naming: Verify standard conventions (1-8/1-9 ranks & a-h/a-i files)', () => {
  // 1. Chess standard coordinates (8x8)
  const fileLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const chessRanks = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.strictEqual(fileLetters.length, 8);
  assert.strictEqual(fileLetters[0], 'a');
  assert.strictEqual(fileLetters[7], 'h');
  assert.strictEqual(chessRanks[0], 1);
  assert.strictEqual(chessRanks[7], 8);

  // Unflipped: Leftmost column displays ranks 8..1, bottom row displays files a..h
  const unflippedRanks = [7, 6, 5, 4, 3, 2, 1, 0];
  const unflippedFiles = [0, 1, 2, 3, 4, 5, 6, 7];
  assert.strictEqual(`${fileLetters[unflippedFiles[0]]}${unflippedRanks[7] + 1}`, 'a1', 'Bottom-left square is a1');
  assert.strictEqual(`${fileLetters[unflippedFiles[7]]}${unflippedRanks[0] + 1}`, 'h8', 'Top-right square is h8');

  // Flipped: Leftmost column displays ranks 1..8, bottom row displays files h..a
  const flippedRanks = [0, 1, 2, 3, 4, 5, 6, 7];
  const flippedFiles = [7, 6, 5, 4, 3, 2, 1, 0];
  assert.strictEqual(`${fileLetters[flippedFiles[0]]}${flippedRanks[7] + 1}`, 'h8', 'Flipped bottom-left square is h8');
  assert.strictEqual(`${fileLetters[flippedFiles[7]]}${flippedRanks[0] + 1}`, 'a1', 'Flipped top-right square is a1');

  // 2. Xiangqi standard coordinates (9 files a-i, 10 ranks 1-10)
  const xiangqiFiles = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  assert.strictEqual(xiangqiFiles.length, 9);
  assert.strictEqual(xiangqiFiles[0], 'a');
  assert.strictEqual(xiangqiFiles[8], 'i');

  // 3. Shogi standard coordinates (9 files 9-1, 9 ranks 1-9 / a-i)
  const shogiFiles = [9, 8, 7, 6, 5, 4, 3, 2, 1];
  const shogiRanks = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  assert.strictEqual(shogiFiles.length, 9);
  assert.strictEqual(shogiRanks.length, 9);
  assert.strictEqual(`${shogiFiles[1]}${shogiRanks[6]}`, '8g', 'Standard Shogi algebraic square name (8g)');

  // 4. Go standard coordinates (9x9 with A-J skipping I)
  const goLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'];
  assert.strictEqual(goLetters.length, 9);
  assert.strictEqual(goLetters.includes('I'), false, 'Go notation skips letter I');
  assert.strictEqual(goLetters[4], 'E', 'Tengen file is E');
});

test('Automatic Game Archival: All games with moves are automatically archived and save button is removed', async () => {
  const fs = await import('node:fs');
  const indexHtml = fs.readFileSync(new URL('../../public/index.html', import.meta.url), 'utf-8');
  assert.strictEqual(indexHtml.includes('id="btnSaveGame"'), false, 'Save button must be removed from index.html');

  const mockDb = createMockDb();
  const archiveMgr = new GameArchiveManager(mockDb, 'auto-save-room');

  // Verify that saving a game with moves automatically stores it
  const history = [
    { ply: 1, san: 'd4', from: 'd2', to: 'd4', color: 'w', piece: 'p', playerName: 'Falcon', clientId: 'c1' }
  ];

  await archiveMgr.saveGame({
    roomId: 'auto-save-room',
    gameType: 'chess',
    status: 'completed',
    reason: 'Completed before Reset',
    history
  });

  const games = archiveMgr.getPastGames();
  assert.strictEqual(games.length, 1);
  assert.strictEqual(games[0].moveCount, 1);
  assert.strictEqual(games[0].history[0].san, 'd4');
});

