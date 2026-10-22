/**
 * Standard Chess Engine Wrapper (using chess.js)
 * Supports browser (window.Chess) and Node.js environment
 */
let DefaultChess = null;
if (typeof window !== 'undefined' && window.Chess) {
  DefaultChess = window.Chess;
} else if (typeof process !== 'undefined') {
  try {
    const mod = await import('chess.js');
    DefaultChess = mod.Chess || mod.default?.Chess || mod.default;
  } catch (e) {
    // Ignore in environments where chess.js is provided externally
  }
}

export class ChessEngine {
  constructor(ChessClass) {
    this.name = 'chess';
    this.Chess = ChessClass || DefaultChess || (typeof window !== 'undefined' ? window.Chess : null);
    this.chess = this.Chess ? new this.Chess() : null;
    this.history = [];
    this.moveSnapshots = [];
  }

  init(fen) {
    if (!this.chess && this.Chess) {
      this.chess = new this.Chess(fen);
    } else if (this.chess) {
      this.chess.load(fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    }
    this.history = [];
    this.moveSnapshots = [this.getState()];
    return this.getState();
  }

  getLegalMoves(square = null) {
    if (!this.chess) return [];
    if (square) {
      return this.chess.moves({ square, verbose: true });
    }
    return this.chess.moves({ verbose: true });
  }

  isLegalMove(from, to, promotion = 'q') {
    if (!this.chess) return false;
    const moves = this.chess.moves({ square: from, verbose: true });
    return moves.some(m => m.to === to && (!m.promotion || m.promotion === promotion));
  }

  makeMove({ from, to, promotion = 'q', playerName = 'Anonymous', clientId = '' }) {
    if (!this.chess) return { success: false, error: 'Engine not initialized' };

    try {
      const move = this.chess.move({ from, to, promotion });
      if (!move) {
        return { success: false, error: 'Illegal move' };
      }

      const moveRecord = {
        ply: this.history.length + 1,
        san: move.san,
        from: move.from,
        to: move.to,
        piece: move.piece,
        color: move.color,
        captured: move.captured || null,
        promotion: move.promotion || null,
        playerName,
        clientId,
        timestamp: Date.now(),
        fen: this.chess.fen()
      };

      this.history.push(moveRecord);
      this.moveSnapshots.push(this.getState());

      return {
        success: true,
        move: moveRecord,
        state: this.getState()
      };
    } catch (err) {
      return { success: false, error: err.message || 'Invalid move' };
    }
  }

  getState() {
    if (!this.chess) return {};

    const fen = this.chess.fen();
    const turn = this.chess.turn(); // 'w' or 'b'
    const isCheck = this.chess.in_check ? this.chess.in_check() : (this.chess.isCheck ? this.chess.isCheck() : false);
    const isCheckmate = this.chess.in_checkmate ? this.chess.in_checkmate() : (this.chess.isCheckmate ? this.chess.isCheckmate() : false);
    const isStalemate = this.chess.in_stalemate ? this.chess.in_stalemate() : (this.chess.isStalemate ? this.chess.isStalemate() : false);
    const isDraw = this.chess.in_draw ? this.chess.in_draw() : (this.chess.isDraw ? this.chess.isDraw() : false);
    const isThreefold = this.chess.in_threefold_repetition ? this.chess.in_threefold_repetition() : (this.chess.isThreefoldRepetition ? this.chess.isThreefoldRepetition() : false);
    const isInsufficient = this.chess.insufficient_material ? this.chess.insufficient_material() : (this.chess.isInsufficientMaterial ? this.chess.isInsufficientMaterial() : false);

    let status = 'active';
    let winner = null;
    if (isCheckmate) {
      status = 'checkmate';
      winner = turn === 'w' ? 'b' : 'w';
    } else if (isStalemate) {
      status = 'stalemate';
      winner = 'draw';
    } else if (isThreefold) {
      status = 'threefold';
      winner = 'draw';
    } else if (isInsufficient) {
      status = 'insufficient_material';
      winner = 'draw';
    } else if (isDraw) {
      status = 'draw';
      winner = 'draw';
    }

    return {
      gameType: 'chess',
      fen,
      turn, // 'w' or 'b'
      isCheck,
      isCheckmate,
      isDraw,
      status,
      winner,
      history: [...this.history],
      lastMove: this.history.length > 0 ? {
        from: this.history[this.history.length - 1].from,
        to: this.history[this.history.length - 1].to,
        san: this.history[this.history.length - 1].san
      } : null,
      captured: this.getCapturedPieces(),
      board: this.chess.board()
    };
  }

  getCapturedPieces() {
    // Count pieces remaining vs initial
    const initial = { p: 8, r: 2, n: 2, b: 2, q: 1, P: 8, R: 2, N: 2, B: 2, Q: 1 };
    const current = { p: 0, r: 0, n: 0, b: 0, q: 0, P: 0, R: 0, N: 0, B: 0, Q: 0 };

    if (!this.chess) return { white: [], black: [] };
    const board = this.chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece) {
          const key = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
          if (current[key] !== undefined) current[key]++;
        }
      }
    }

    const whiteCaptured = []; // Pieces black took from white
    const blackCaptured = []; // Pieces white took from black

    for (const [piece, count] of Object.entries(initial)) {
      const lost = count - (current[piece] || 0);
      for (let i = 0; i < lost; i++) {
        if (piece === piece.toUpperCase()) {
          blackCaptured.push(piece.toLowerCase()); // White piece captured by black
        } else {
          whiteCaptured.push(piece.toUpperCase()); // Black piece captured by white
        }
      }
    }

    return { white: whiteCaptured, black: blackCaptured };
  }

  computeCaptured(chessInstance) {
    const initial = { p: 8, r: 2, n: 2, b: 2, q: 1, P: 8, R: 2, N: 2, B: 2, Q: 1 };
    const current = { p: 0, r: 0, n: 0, b: 0, q: 0, P: 0, R: 0, N: 0, B: 0, Q: 0 };

    if (!chessInstance) return { white: [], black: [] };
    const board = chessInstance.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece) {
          const key = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
          if (current[key] !== undefined) current[key]++;
        }
      }
    }

    const whiteCaptured = [];
    const blackCaptured = [];

    for (const [piece, count] of Object.entries(initial)) {
      const lost = count - (current[piece] || 0);
      for (let i = 0; i < lost; i++) {
        if (piece === piece.toUpperCase()) {
          blackCaptured.push(piece.toLowerCase());
        } else {
          whiteCaptured.push(piece.toUpperCase());
        }
      }
    }

    return { white: whiteCaptured, black: blackCaptured };
  }

  reconstructSnapshots(history = this.history) {
    this.history = history ? [...history] : [];
    const ChessClass = this.Chess || (typeof window !== 'undefined' ? window.Chess : DefaultChess);
    if (!ChessClass) return;

    this.moveSnapshots = [];

    // Ply 0: starting position
    const startChess = new ChessClass();
    this.moveSnapshots.push({
      gameType: 'chess',
      fen: startChess.fen(),
      turn: startChess.turn(),
      isCheck: false,
      isCheckmate: false,
      isDraw: false,
      status: 'active',
      winner: null,
      history: [],
      captured: { white: [], black: [] },
      board: startChess.board(),
      lastMove: null,
      ply: 0,
      isHistorical: true
    });

    if (!history || history.length === 0) return;

    const replayChess = new ChessClass();
    for (let i = 0; i < history.length; i++) {
      const m = history[i];
      let snapChess;
      if (m.fen) {
        snapChess = new ChessClass(m.fen);
      } else {
        replayChess.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
        snapChess = new ChessClass(replayChess.fen());
      }

      const turn = snapChess.turn();
      const isCheck = snapChess.in_check ? snapChess.in_check() : false;
      const isCheckmate = snapChess.in_checkmate ? snapChess.in_checkmate() : false;
      const isDraw = snapChess.in_draw ? snapChess.in_draw() : false;
      let status = 'active';
      let winner = null;
      if (isCheckmate) {
        status = 'checkmate';
        winner = turn === 'w' ? 'b' : 'w';
      } else if (isDraw) {
        status = 'draw';
        winner = 'draw';
      }

      this.moveSnapshots.push({
        gameType: 'chess',
        fen: snapChess.fen(),
        turn,
        isCheck,
        isCheckmate,
        isDraw,
        status,
        winner,
        history: history.slice(0, i + 1),
        captured: this.computeCaptured(snapChess),
        board: snapChess.board(),
        lastMove: { from: m.from, to: m.to, san: m.san },
        ply: i + 1,
        isHistorical: true
      });
    }
  }

  getStateAtPly(plyIndex) {
    if (this.moveSnapshots && this.moveSnapshots[plyIndex]) {
      return { ...this.moveSnapshots[plyIndex], isHistorical: true };
    }

    if (this.history && this.history.length > 0) {
      this.reconstructSnapshots(this.history);
      if (this.moveSnapshots && this.moveSnapshots[plyIndex]) {
        return { ...this.moveSnapshots[plyIndex], isHistorical: true };
      }
    }

    if (plyIndex === 0) {
      const ChessClass = this.Chess || (typeof window !== 'undefined' ? window.Chess : DefaultChess);
      if (ChessClass) {
        const startChess = new ChessClass();
        return {
          gameType: 'chess',
          fen: startChess.fen(),
          turn: startChess.turn(),
          isCheck: false,
          isCheckmate: false,
          isDraw: false,
          status: 'active',
          winner: null,
          history: [],
          captured: { white: [], black: [] },
          board: startChess.board(),
          lastMove: null,
          ply: 0,
          isHistorical: true
        };
      }
    }

    return { ...this.getState(), isHistorical: true };
  }
}
