/**
 * Shogi (Japanese Chess / 将棋) Complete Rule Engine
 * 9x9 board with piece drops (mochikoma), promotion zones, and Nifu rule.
 * Sente (先手 / Black) starts at rows 6-8 and moves UP (r decreasing).
 * Gote (後手 / White) starts at rows 0-2 and moves DOWN (r increasing).
 */
export class ShogiEngine {
  constructor() {
    this.name = 'shogi';
    this.board = Array(9).fill(null).map(() => Array(9).fill(null));
    this.turn = 'sente'; // 'sente' (Black) or 'gote' (White)
    this.hands = {
      sente: { P: 0, L: 0, N: 0, S: 0, G: 0, B: 0, R: 0 },
      gote: { P: 0, L: 0, N: 0, S: 0, G: 0, B: 0, R: 0 }
    };
    this.history = [];
    this.moveSnapshots = [];
    this.init();
  }

  init() {
    this.board = Array(9).fill(null).map(() => Array(9).fill(null));
    this.turn = 'sente';
    this.hands = {
      sente: { P: 0, L: 0, N: 0, S: 0, G: 0, B: 0, R: 0 },
      gote: { P: 0, L: 0, N: 0, S: 0, G: 0, B: 0, R: 0 }
    };
    this.history = [];

    // Gote setup (rows 0, 1, 2 - lowercase)
    const goteRow0 = ['l', 'n', 's', 'g', 'k', 'g', 's', 'n', 'l'];
    for (let c = 0; c < 9; c++) this.board[0][c] = goteRow0[c];
    this.board[1][1] = 'r';
    this.board[1][7] = 'b';
    for (let c = 0; c < 9; c++) this.board[2][c] = 'p';

    // Sente setup (rows 6, 7, 8 - uppercase)
    for (let c = 0; c < 9; c++) this.board[6][c] = 'P';
    this.board[7][1] = 'B';
    this.board[7][7] = 'R';
    const senteRow8 = ['L', 'N', 'S', 'G', 'K', 'G', 'S', 'N', 'L'];
    for (let c = 0; c < 9; c++) this.board[8][c] = senteRow8[c];

    this.moveSnapshots = [this.getState()];
    return this.getState();
  }

  isSente(piece) {
    if (!piece) return false;
    const base = piece.replace('+', '');
    return base === base.toUpperCase();
  }

  isGote(piece) {
    if (!piece) return false;
    const base = piece.replace('+', '');
    return base === base.toLowerCase();
  }

  getColor(piece) {
    if (!piece) return null;
    return this.isSente(piece) ? 'sente' : 'gote';
  }

  inBounds(c, r) {
    return c >= 0 && c < 9 && r >= 0 && r < 9;
  }

  inPromotionZone(r, color) {
    return color === 'sente' ? (r >= 0 && r <= 2) : (r >= 6 && r <= 8);
  }

  canPromotePiece(piece) {
    const raw = piece.replace('+', '').toUpperCase();
    return ['P', 'L', 'N', 'S', 'B', 'R'].includes(raw) && !piece.startsWith('+');
  }

  getPromotedForm(piece) {
    return `+${piece.replace('+', '')}`;
  }

  getUnpromotedBase(piece) {
    return piece.replace('+', '').toUpperCase();
  }

  getPseudoMoves(fc, fr, board = this.board) {
    const piece = board[fr][fc];
    if (!piece) return [];
    const color = this.getColor(piece);
    const forward = color === 'sente' ? -1 : 1;
    const moves = [];

    const addMove = (tc, tr) => {
      if (!this.inBounds(tc, tr)) return;
      const target = board[tr][tc];
      if (!target || this.getColor(target) !== color) {
        moves.push({ from: { c: fc, r: fr }, to: { c: tc, r: tr }, piece, captured: target });
      }
    };

    const isPromoted = piece.startsWith('+');
    const baseType = piece.replace('+', '').toUpperCase();

    // Promoted S, N, L, P all move like Gold General
    if (baseType === 'G' || (isPromoted && ['S', 'N', 'L', 'P'].includes(baseType))) {
      const deltas = [
        [0, forward], [-1, forward], [1, forward], // 3 forward
        [-1, 0], [1, 0],                          // 2 horizontal
        [0, -forward]                             // 1 backward
      ];
      for (const [dc, dr] of deltas) addMove(fc + dc, fr + dr);
      return moves;
    }

    switch (baseType) {
      case 'K': { // King: 1 step any direction
        for (let dc = -1; dc <= 1; dc++) {
          for (let dr = -1; dr <= 1; dr++) {
            if (dc !== 0 || dr !== 0) addMove(fc + dc, fr + dr);
          }
        }
        break;
      }

      case 'P': { // Pawn: 1 step forward
        addMove(fc, fr + forward);
        break;
      }

      case 'L': { // Lance: any distance forward
        let step = 1;
        while (true) {
          const tr = fr + forward * step;
          if (!this.inBounds(fc, tr)) break;
          const target = board[tr][fc];
          if (!target) {
            addMove(fc, tr);
          } else {
            if (this.getColor(target) !== color) addMove(fc, tr);
            break;
          }
          step++;
        }
        break;
      }

      case 'N': { // Knight: 2 steps forward + 1 step left/right (can jump)
        addMove(fc - 1, fr + forward * 2);
        addMove(fc + 1, fr + forward * 2);
        break;
      }

      case 'S': { // Silver General: 3 forward + 2 rear diagonals
        const deltas = [
          [0, forward], [-1, forward], [1, forward], // 3 forward
          [-1, -forward], [1, -forward]              // 2 rear diagonals
        ];
        for (const [dc, dr] of deltas) addMove(fc + dc, fr + dr);
        break;
      }

      case 'B': { // Bishop (and Promoted Bishop / Dragon Horse)
        const dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [dc, dr] of dirs) {
          let step = 1;
          while (true) {
            const tc = fc + dc * step, tr = fr + dr * step;
            if (!this.inBounds(tc, tr)) break;
            const target = board[tr][tc];
            if (!target) {
              addMove(tc, tr);
            } else {
              if (this.getColor(target) !== color) addMove(tc, tr);
              break;
            }
            step++;
          }
        }
        if (isPromoted) {
          // Horse gains 1 step orthogonal in 4 directions
          const orthos = [[0, 1], [0, -1], [1, 0], [-1, 0]];
          for (const [dc, dr] of orthos) addMove(fc + dc, fr + dr);
        }
        break;
      }

      case 'R': { // Rook (and Promoted Rook / Dragon King)
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dc, dr] of dirs) {
          let step = 1;
          while (true) {
            const tc = fc + dc * step, tr = fr + dr * step;
            if (!this.inBounds(tc, tr)) break;
            const target = board[tr][tc];
            if (!target) {
              addMove(tc, tr);
            } else {
              if (this.getColor(target) !== color) addMove(tc, tr);
              break;
            }
            step++;
          }
        }
        if (isPromoted) {
          // Dragon gains 1 step diagonal in 4 directions
          const diags = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
          for (const [dc, dr] of diags) addMove(fc + dc, fr + dr);
        }
        break;
      }
    }

    return moves;
  }

  // Check if a piece drop from hand is legal
  isLegalDrop(pieceType, tc, tr) {
    if (!this.inBounds(tc, tr) || this.board[tr][tc] !== null) return false;
    const color = this.turn;
    const hand = this.hands[color];
    const upperType = pieceType.toUpperCase();

    if (!hand[upperType] || hand[upperType] <= 0) return false;

    // Nifu rule: cannot drop pawn on a file with an unpromoted friendly pawn
    if (upperType === 'P') {
      const friendlyPawn = color === 'sente' ? 'P' : 'p';
      for (let r = 0; r < 9; r++) {
        if (this.board[r][tc] === friendlyPawn) return false;
      }
    }

    // Mobility rule: pieces cannot be dropped where they have no legal forward moves
    if (color === 'sente') {
      if ((upperType === 'P' || upperType === 'L') && tr === 0) return false;
      if (upperType === 'N' && (tr === 0 || tr === 1)) return false;
    } else {
      if ((upperType === 'P' || upperType === 'L') && tr === 8) return false;
      if (upperType === 'N' && (tr === 8 || tr === 7)) return false;
    }

    return true;
  }

  getLegalDrops(pieceType) {
    const drops = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.isLegalDrop(pieceType, c, r)) {
          drops.push({ isDrop: true, pieceType, to: { c, r } });
        }
      }
    }
    return drops;
  }

  makeMove({ from, to, isDrop = false, pieceType = null, promote = false, playerName = 'Anonymous', clientId = '' }) {
    const color = this.turn;

    if (isDrop) {
      if (!this.isLegalDrop(pieceType, to.c, to.r)) {
        return { success: false, error: 'Illegal Shogi piece drop (e.g. Nifu or invalid square)' };
      }

      const upperType = pieceType.toUpperCase();
      this.hands[color][upperType]--;
      const pieceOnBoard = color === 'sente' ? upperType : upperType.toLowerCase();
      this.board[to.r][to.c] = pieceOnBoard;

      const san = `${pieceOnBoard}*${9 - to.c}${to.r + 1}`;
      const moveRecord = {
        ply: this.history.length + 1,
        san,
        isDrop: true,
        piece: pieceOnBoard,
        to,
        color,
        playerName,
        clientId,
        timestamp: Date.now()
      };

      this.history.push(moveRecord);
      this.turn = color === 'sente' ? 'gote' : 'sente';
      const state = this.getState();
      this.moveSnapshots.push(state);
      return { success: true, move: moveRecord, state };
    }

    // Board move
    const piece = this.board[from.r][from.c];
    if (!piece || this.getColor(piece) !== color) {
      return { success: false, error: 'Not your piece to move' };
    }

    const pseudo = this.getPseudoMoves(from.c, from.r);
    const valid = pseudo.find(m => m.to.c === to.c && m.to.r === to.r);
    if (!valid) {
      return { success: false, error: 'Illegal Shogi move' };
    }

    const target = this.board[to.r][to.c];
    if (target) {
      // Capture target piece into hand (unpromoted)
      const capturedBase = this.getUnpromotedBase(target);
      this.hands[color][capturedBase] = (this.hands[color][capturedBase] || 0) + 1;
    }

    let finalPiece = piece;
    const shouldPromote = promote || (this.inPromotionZone(to.r, color) && this.canPromotePiece(piece));
    if (shouldPromote && this.canPromotePiece(piece)) {
      finalPiece = this.getPromotedForm(piece);
    }

    this.board[to.r][to.c] = finalPiece;
    this.board[from.r][from.c] = null;

    const san = `${piece}${9 - from.c}${from.r + 1}-${9 - to.c}${to.r + 1}${shouldPromote ? '+' : ''}`;

    const moveRecord = {
      ply: this.history.length + 1,
      san,
      from,
      to,
      piece: finalPiece,
      color,
      captured: target || null,
      promoted: shouldPromote,
      playerName,
      clientId,
      timestamp: Date.now()
    };

    this.history.push(moveRecord);
    this.turn = color === 'sente' ? 'gote' : 'sente';
    const state = this.getState();
    this.moveSnapshots.push(state);

    return { success: true, move: moveRecord, state };
  }

  getState() {
    return {
      gameType: 'shogi',
      turn: this.turn,
      status: 'active',
      winner: null,
      hands: {
        sente: { ...this.hands.sente },
        gote: { ...this.hands.gote }
      },
      history: [...this.history],
      board: this.board.map(row => [...row])
    };
  }

  reconstructSnapshots(history = this.history) {
    this.history = history ? [...history] : [];
    this.init();
    for (const m of this.history) {
      if (m.isDrop) this.dropPiece(m.to, m.piece);
      else this.makeMove(m);
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
    return { ...this.getState(), isHistorical: true };
  }
}
