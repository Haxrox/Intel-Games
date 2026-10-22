/**
 * Client-Side Stockfish-Style Position Analyzer & Move Classification Engine
 * Evaluates move sequences using PeSTO piece-square tables, material balances,
 * centipawn loss (CPL), and Chess.com-style Win Probability Loss (WPL).
 * Computes CAPS-style player accuracy (0-100%) and classifies moves into:
 * Brilliant (💎), Best (⭐), Excellent (✨), Good (👍), Inaccuracy (❓), Mistake (⁉️), Blunder (💥), Miss (❌).
 */

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// PeSTO Piece-Square Tables (middlegame) in centipawns
const PST = {
  p: [
      0,  0,  0,  0,  0,  0,  0,  0,
     50, 50, 50, 50, 50, 50, 50, 50,
     10, 10, 20, 30, 30, 20, 10, 10,
      5,  5, 10, 25, 25, 10,  5,  5,
      0,  0,  0, 20, 20,  0,  0,  0,
      5, -5,-10,  0,  0,-10, -5,  5,
      5, 10, 10,-20,-20, 10, 10,  5,
      0,  0,  0,  0,  0,  0,  0,  0
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
  ],
  r: [
      0,  0,  0,  0,  0,  0,  0,  0,
      5, 10, 10, 10, 10, 10, 10,  5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
      0,  0,  0,  5,  5,  0,  0,  0
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20
  ]
};

export class BrowserStockfishAnalyzer {
  constructor(chessConstructor) {
    this.ChessClass = chessConstructor || (typeof window !== 'undefined' ? window.Chess : null);
    this.pieceValues = PIECE_VALUES;
  }

  getChessClass() {
    if (this.ChessClass) return this.ChessClass;
    if (typeof window !== 'undefined' && window.Chess) return window.Chess;
    if (typeof globalThis !== 'undefined' && globalThis.Chess) return globalThis.Chess;
    return null;
  }

  /**
   * Centipawns to win probability using the standard model
   */
  centipawnsToWinProbability(cp) {
    if (cp === null || cp === undefined) return 0.5;
    // Standard model with cap
    const clampedCp = Math.max(-2000, Math.min(2000, cp));
    return 1 / (1 + Math.pow(10, -clampedCp / 400));
  }

  /**
   * Evaluate a chess.js board position in centipawns relative to White
   */
  evaluateChessPosition(chess) {
    if (!chess) return 0;

    // Check terminal conditions
    if (chess.in_checkmate && chess.in_checkmate()) {
      return chess.turn() === 'w' ? -20000 : 20000;
    }
    if ((chess.in_draw && chess.in_draw()) || (chess.in_stalemate && chess.in_stalemate())) {
      return 0;
    }

    const board = chess.board();
    let score = 0;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;

        const sqIndex = r * 8 + c;
        const type = piece.type;
        const val = PIECE_VALUES[type] || 0;
        const pstVal = PST[type] ? PST[type][sqIndex] : 0;

        if (piece.color === 'w') {
          score += val + pstVal;
        } else {
          // Mirror square index for Black's perspective
          const blackSqIndex = (7 - r) * 8 + c;
          const blackPstVal = PST[type] ? PST[type][blackSqIndex] : 0;
          score -= (val + blackPstVal);
        }
      }
    }

    return score;
  }

  /**
   * Classify move based on Centipawn Loss (CPL) and Win Probability Loss (WPL)
   */
  classifyMove(cpl, wpl, isSacrifice = false, isBestMove = false, wasOpponentBlunder = false) {
    if (isBestMove && isSacrifice) return 'brilliant';
    if (isBestMove || cpl <= 12 || wpl <= 0.015) return 'best';
    if (cpl <= 35 || wpl <= 0.04) return 'excellent';
    if (cpl <= 85 || wpl <= 0.10) return 'good';
    if (wasOpponentBlunder && cpl > 150) return 'miss';
    if (cpl <= 180 || wpl <= 0.22) return 'inaccuracy';
    if (cpl <= 320 || wpl <= 0.38) return 'mistake';
    return 'blunder';
  }

  /**
   * Analyze a complete game history
   * @param {Array} history Array of move records
   * @param {Object} metadata Optional game metadata (gameType, winner, reason)
   */
  async analyzeGame(history = [], metadata = {}) {
    if (!history || history.length === 0) {
      return {
        whiteAccuracy: 85.0,
        blackAccuracy: 85.0,
        moves: [],
        winner: metadata.winner || null,
        reason: metadata.reason || 'No moves recorded'
      };
    }

    const ChessCtor = this.getChessClass();
    const isChess = (metadata.gameType === 'chess' || !metadata.gameType) && ChessCtor;

    if (isChess) {
      return this.analyzeChessGame(history, metadata, ChessCtor);
    }

    // Generic fallback for non-chess games (Xiangqi, Go, Shogi)
    return this.analyzeGenericGame(history, metadata);
  }

  /**
   * High-accuracy position & 1-ply search analysis for Chess games
   */
  analyzeChessGame(history, metadata, ChessCtor) {
    const chess = new ChessCtor();
    const analyzedMoves = [];

    let whiteLossSum = 0;
    let whiteMovesCount = 0;
    let blackLossSum = 0;
    let blackMovesCount = 0;

    let previousMoverBlundered = false;

    for (let i = 0; i < history.length; i++) {
      const moveRecord = history[i];
      const isWhiteTurn = chess.turn() === 'w';

      // 1. Evaluate legal moves in the position before the move to find the best move
      const legalMoves = chess.moves({ verbose: true });
      let bestMoveEval = isWhiteTurn ? -999999 : 999999;
      let bestMoveObj = null;

      for (const cand of legalMoves) {
        chess.move(cand);
        const candEval = this.evaluateChessPosition(chess);
        chess.undo();

        if (isWhiteTurn) {
          if (candEval > bestMoveEval) {
            bestMoveEval = candEval;
            bestMoveObj = cand;
          }
        } else {
          if (candEval < bestMoveEval) {
            bestMoveEval = candEval;
            bestMoveObj = cand;
          }
        }
      }

      // 2. Play the actual move
      let playedMove = null;
      try {
        if (moveRecord.san) {
          playedMove = chess.move(moveRecord.san);
        } else if (moveRecord.from && moveRecord.to) {
          playedMove = chess.move({
            from: moveRecord.from,
            to: moveRecord.to,
            promotion: moveRecord.promotion || 'q'
          });
        }
      } catch (err) {
        // In case SAN is non-standard, attempt matching from legal moves
        const match = legalMoves.find(m => m.from === moveRecord.from && m.to === moveRecord.to);
        if (match) playedMove = chess.move(match);
      }

      const playedEval = this.evaluateChessPosition(chess);

      // 3. Centipawn Loss & Win Probability Loss
      let cpl = 0;
      if (isWhiteTurn) {
        cpl = Math.max(0, bestMoveEval - playedEval);
      } else {
        cpl = Math.max(0, playedEval - bestMoveEval);
      }

      const wpBest = this.centipawnsToWinProbability(isWhiteTurn ? bestMoveEval : -bestMoveEval);
      const wpPlayed = this.centipawnsToWinProbability(isWhiteTurn ? playedEval : -playedEval);
      const wpl = Math.max(0, wpBest - wpPlayed);

      // Check if move was a sacrifice
      const isSacrifice = playedMove && playedMove.captured &&
        ['q', 'r'].includes(playedMove.captured) &&
        ['p', 'n', 'b'].includes(playedMove.piece) &&
        (isWhiteTurn ? playedEval >= 150 : playedEval <= -150);

      const isBest = (bestMoveObj && playedMove && bestMoveObj.san === playedMove.san) || cpl <= 12;
      const classification = this.classifyMove(cpl, wpl, isSacrifice, isBest, previousMoverBlundered);

      previousMoverBlundered = (classification === 'blunder' || classification === 'mistake');

      if (isWhiteTurn) {
        whiteLossSum += wpl;
        whiteMovesCount++;
      } else {
        blackLossSum += wpl;
        blackMovesCount++;
      }

      analyzedMoves.push({
        ply: i + 1,
        san: (playedMove && playedMove.san) || moveRecord.san || `Move ${i + 1}`,
        color: moveRecord.color || (isWhiteTurn ? 'w' : 'b'),
        playerName: moveRecord.playerName || (isWhiteTurn ? 'White' : 'Black'),
        clientId: moveRecord.clientId || '',
        eval: Math.round(playedEval / 10) / 10,
        cpl: Math.round(cpl),
        wpl: Math.round(wpl * 1000) / 1000,
        classification,
        fen: chess.fen ? chess.fen() : null
      });
    }

    const whiteAvgLoss = whiteMovesCount > 0 ? whiteLossSum / whiteMovesCount : 0.05;
    const blackAvgLoss = blackMovesCount > 0 ? blackLossSum / blackMovesCount : 0.05;

    // CAPS-style Accuracy Formula: 100 * exp(-1.75 * AvgWPL)
    const whiteAccuracy = Math.max(30, Math.min(99.4, Math.round(100 * Math.exp(-1.75 * whiteAvgLoss) * 10) / 10));
    const blackAccuracy = Math.max(30, Math.min(99.4, Math.round(100 * Math.exp(-1.75 * blackAvgLoss) * 10) / 10));

    const finalEval = analyzedMoves.length > 0 ? analyzedMoves[analyzedMoves.length - 1].eval : 0;

    return {
      whiteAccuracy,
      blackAccuracy,
      moves: analyzedMoves,
      winner: metadata.winner || (finalEval > 300 ? 'w' : finalEval < -300 ? 'b' : 'draw'),
      reason: metadata.reason || 'Game Analysis Complete'
    };
  }

  /**
   * Fallback analyzer for non-chess board games
   */
  analyzeGenericGame(history, metadata) {
    const analyzedMoves = [];
    let whiteLossSum = 0;
    let whiteMovesCount = 0;
    let blackLossSum = 0;
    let blackMovesCount = 0;

    let currentEval = 0;

    for (let i = 0; i < history.length; i++) {
      const move = history[i];
      const isWhite = move.color === 'w' || move.color === 'red' || move.color === 'sente' || i % 2 === 0;

      let evalDelta = 0;
      if (move.captured) {
        const val = typeof move.captured === 'number' ? move.captured * 100 : 180;
        evalDelta = isWhite ? val : -val;
      }
      if (move.promotion) evalDelta += isWhite ? 350 : -350;
      if (move.san && move.san.includes('#')) evalDelta += isWhite ? 2000 : -2000;

      currentEval += evalDelta;

      const prevWinProb = this.centipawnsToWinProbability(isWhite ? currentEval - evalDelta : -(currentEval - evalDelta));
      const newWinProb = this.centipawnsToWinProbability(isWhite ? currentEval : -currentEval);
      const wpl = Math.max(0, prevWinProb - newWinProb);

      const isBest = wpl < 0.03;
      const classification = this.classifyMove(Math.round(wpl * 400), wpl, false, isBest, false);

      if (isWhite) {
        whiteLossSum += wpl;
        whiteMovesCount++;
      } else {
        blackLossSum += wpl;
        blackMovesCount++;
      }

      analyzedMoves.push({
        ply: i + 1,
        san: move.san || `Move ${i + 1}`,
        color: move.color || (isWhite ? 'w' : 'b'),
        playerName: move.playerName || (isWhite ? 'White' : 'Black'),
        clientId: move.clientId || '',
        eval: Math.round(currentEval / 10) / 10,
        cpl: Math.round(wpl * 400),
        wpl: Math.round(wpl * 1000) / 1000,
        classification,
        fen: null
      });
    }

    const whiteAvgLoss = whiteMovesCount > 0 ? whiteLossSum / whiteMovesCount : 0.05;
    const blackAvgLoss = blackMovesCount > 0 ? blackLossSum / blackMovesCount : 0.05;

    const whiteAccuracy = Math.max(35, Math.min(99.0, Math.round(100 * Math.exp(-1.75 * whiteAvgLoss) * 10) / 10));
    const blackAccuracy = Math.max(35, Math.min(99.0, Math.round(100 * Math.exp(-1.75 * blackAvgLoss) * 10) / 10));

    return {
      whiteAccuracy,
      blackAccuracy,
      moves: analyzedMoves,
      winner: metadata.winner || (currentEval > 300 ? 'w' : currentEval < -300 ? 'b' : 'draw'),
      reason: metadata.reason || 'Game Analysis Complete'
    };
  }
}
