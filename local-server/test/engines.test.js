import { test } from 'node:test';
import assert from 'node:assert';
import * as chessPkg from 'chess.js';
const Chess = chessPkg.Chess || chessPkg.default?.Chess || chessPkg.default;

import { ChessEngine } from '../../public/js/engines/chessEngine.js';
import { XiangqiEngine } from '../../public/js/engines/xiangqiEngine.js';
import { GoEngine } from '../../public/js/engines/goEngine.js';
import { ShogiEngine } from '../../public/js/engines/shogiEngine.js';
import { StockfishAnalyzer } from '../analyzer.js';

test('Chess Engine: Scholar\'s Mate sequence', (t) => {
  const engine = new ChessEngine(Chess);
  engine.init();

  const moves = [
    { from: 'e2', to: 'e4' },
    { from: 'e7', to: 'e5' },
    { from: 'd1', to: 'h5' },
    { from: 'b8', to: 'c6' },
    { from: 'f1', to: 'c4' },
    { from: 'g8', to: 'f6' },
    { from: 'h5', to: 'f7' } // Qxf7#
  ];

  for (const m of moves) {
    const res = engine.makeMove(m);
    assert.strictEqual(res.success, true, `Move ${m.from}-${m.to} should succeed`);
  }

  const state = engine.getState();
  assert.strictEqual(state.isCheckmate, true, 'Position should be checkmate');
  assert.strictEqual(state.winner, 'w', 'White should be winner');
});

test('Xiangqi Engine: Cannon screen jump capture and river boundary', (t) => {
  const engine = new XiangqiEngine();
  engine.init();

  // Red Cannon at (1, 2), Horse at (1, 0)
  // Check that Red Soldier at (0, 3) can advance forward 1 step
  const res = engine.makeMove({ from: { c: 0, r: 3 }, to: { c: 0, r: 4 } });
  assert.strictEqual(res.success, true, 'Red soldier should advance forward');

  // Verify Elephant cannot cross river (r <= 4 for Red)
  const elephantLegals = engine.getLegalMoves({ c: 2, r: 0 });
  const crossesRiver = elephantLegals.some(m => m.to.r > 4);
  assert.strictEqual(crossesRiver, false, 'Xiangqi elephant cannot cross river');
});

test('Go Engine: Stone capture and suicide prevention', (t) => {
  const engine = new GoEngine(9);
  engine.init();

  // Place a White stone at (0, 0)
  // Black surrounds it at (1, 0) and (0, 1)
  // Let Black play (1, 0)
  engine.makeMove({ x: 1, y: 0 }); // B
  engine.makeMove({ x: 0, y: 0 }); // W
  engine.makeMove({ x: 0, y: 1 }); // B captures W at (0, 0)!

  assert.strictEqual(engine.board[0][0], null, 'Captured White stone should be removed from board');
  assert.strictEqual(engine.captured.B, 1, 'Black should have 1 captured stone');

  // Test suicide rule: White playing into an enclosed 0-liberty square should be illegal
  assert.strictEqual(engine.isLegalMove(0, 0), false, 'Playing into 0 liberties with no capture is illegal suicide');
});

test('Shogi Engine: Mochikoma in-hand drop and Nifu rule', (t) => {
  const engine = new ShogiEngine();
  engine.init();

  // Give Sente a captured Pawn in hand
  engine.hands.sente.P = 1;

  // Attempting to drop pawn on a column that already has an unpromoted friendly pawn (Nifu)
  // Sente already has friendly pawns on all columns (row 6) in initial position
  const isNifu = engine.isLegalDrop('P', 0, 5); // Column 0 has pawn at (0, 6)
  assert.strictEqual(isNifu, false, 'Dropping pawn on column with existing unpromoted friendly pawn violates Nifu');

  // Clear pawn from column 0 to test valid drop
  engine.board[6][0] = null;
  const canDrop = engine.isLegalDrop('P', 0, 5);
  assert.strictEqual(canDrop, true, 'Dropping pawn on column without friendly pawn should be valid');

  const dropRes = engine.makeMove({ isDrop: true, pieceType: 'P', to: { c: 0, r: 5 } });
  assert.strictEqual(dropRes.success, true, 'Valid drop should succeed');
  assert.strictEqual(engine.hands.sente.P, 0, 'In-hand pawn count should decrease');
  assert.strictEqual(engine.board[5][0], 'P', 'Piece should appear on board');
});

test('Stockfish Analyzer: Win probability and move classification', async (t) => {
  const analyzer = new StockfishAnalyzer();

  // Test centipawn conversion
  const evenProb = analyzer.centipawnsToWinProbability(0);
  assert.strictEqual(Math.round(evenProb * 100), 50, '0 centipawns should be 50% win probability');

  const plus400Prob = analyzer.centipawnsToWinProbability(400);
  assert.strictEqual(Math.round(plus400Prob * 100), 91, '+400 cp should be ~91% win probability');

  // Test classification categories
  assert.strictEqual(analyzer.classifyMove(0.01), 'best');
  assert.strictEqual(analyzer.classifyMove(0.04), 'excellent');
  assert.strictEqual(analyzer.classifyMove(0.08), 'good');
  assert.strictEqual(analyzer.classifyMove(0.18), 'inaccuracy');
  assert.strictEqual(analyzer.classifyMove(0.28), 'mistake');
  assert.strictEqual(analyzer.classifyMove(0.45), 'blunder');

  // Test game analysis
  const mockHistory = [
    { san: 'e4', color: 'w', piece: 'p' },
    { san: 'e5', color: 'b', piece: 'p' },
    { san: 'Qh5', color: 'w', piece: 'q' },
    { san: 'Nc6', color: 'b', piece: 'n' },
    { san: 'Bc4', color: 'w', piece: 'b' },
    { san: 'Nf6', color: 'b', piece: 'n' },
    { san: 'Qxf7#', color: 'w', piece: 'q', captured: 'p' }
  ];

  const analysis = await analyzer.analyzeGame(mockHistory);
  assert.ok(analysis.whiteAccuracy >= 50 && analysis.whiteAccuracy <= 100, 'White accuracy should be within 50-100%');
  assert.ok(analysis.blackAccuracy >= 50 && analysis.blackAccuracy <= 100, 'Black accuracy should be within 50-100%');
  assert.strictEqual(analysis.moves.length, 7, 'All 7 moves should be analyzed');
});
