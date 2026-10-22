/**
 * Xiangqi (Chinese Chess / 象棋) Complete Rule Engine
 * 9 columns (0-8) x 10 rows (0-9).
 * Red starts at rows 0-4 (Palace: cols 3-5, rows 0-2).
 * Black starts at rows 5-9 (Palace: cols 3-5, rows 7-9).
 * River lies between rows 4 and 5.
 */
export class XiangqiEngine {
  constructor() {
    this.name = 'xiangqi';
    this.board = Array(10).fill(null).map(() => Array(9).fill(null));
    this.turn = 'red'; // 'red' or 'black'
    this.history = [];
    this.moveSnapshots = [];
    this.captured = { red: [], black: [] };
    this.init();
  }

  init() {
    this.board = Array(10).fill(null).map(() => Array(9).fill(null));
    this.turn = 'red';
    this.history = [];
    this.captured = { red: [], black: [] };

    // Initial setup for Red (Uppercase)
    const redSetup = [
      { p: 'R', c: 0, r: 0 }, { p: 'H', c: 1, r: 0 }, { p: 'E', c: 2, r: 0 }, { p: 'A', c: 3, r: 0 },
      { p: 'K', c: 4, r: 0 }, { p: 'A', c: 5, r: 0 }, { p: 'E', c: 6, r: 0 }, { p: 'H', c: 7, r: 0 }, { p: 'R', c: 8, r: 0 },
      { p: 'C', c: 1, r: 2 }, { p: 'C', c: 7, r: 2 },
      { p: 'S', c: 0, r: 3 }, { p: 'S', c: 2, r: 3 }, { p: 'S', c: 4, r: 3 }, { p: 'S', c: 6, r: 3 }, { p: 'S', c: 8, r: 3 }
    ];

    // Initial setup for Black (Lowercase)
    const blackSetup = [
      { p: 'r', c: 0, r: 9 }, { p: 'h', c: 1, r: 9 }, { p: 'e', c: 2, r: 9 }, { p: 'a', c: 3, r: 9 },
      { p: 'k', c: 4, r: 9 }, { p: 'a', c: 5, r: 9 }, { p: 'e', c: 6, r: 9 }, { p: 'h', c: 7, r: 9 }, { p: 'r', c: 8, r: 9 },
      { p: 'c', c: 1, r: 7 }, { p: 'c', c: 7, r: 7 },
      { p: 's', c: 0, r: 6 }, { p: 's', c: 2, r: 6 }, { p: 's', c: 4, r: 6 }, { p: 's', c: 6, r: 6 }, { p: 's', c: 8, r: 6 }
    ];

    for (const item of redSetup) this.board[item.r][item.c] = item.p;
    for (const item of blackSetup) this.board[item.r][item.c] = item.p;

    this.moveSnapshots = [this.getState()];
    return this.getState();
  }

  isRed(piece) {
    return piece && piece === piece.toUpperCase();
  }

  isBlack(piece) {
    return piece && piece === piece.toLowerCase();
  }

  getColor(piece) {
    if (!piece) return null;
    return this.isRed(piece) ? 'red' : 'black';
  }

  inBounds(c, r) {
    return c >= 0 && c <= 8 && r >= 0 && r <= 9;
  }

  inPalace(c, r, color) {
    if (c < 3 || c > 5) return false;
    return color === 'red' ? (r >= 0 && r <= 2) : (r >= 7 && r <= 9);
  }

  getPiece(c, r) {
    if (!this.inBounds(c, r)) return null;
    return this.board[r][c];
  }

  // Raw pseudo-legal moves for a piece at (fc, fr)
  getPseudoMoves(fc, fr, board = this.board) {
    const piece = board[fr][fc];
    if (!piece) return [];
    const color = this.getColor(piece);
    const type = piece.toUpperCase();
    const moves = [];

    const addMove = (tc, tr) => {
      if (!this.inBounds(tc, tr)) return;
      const target = board[tr][tc];
      if (!target || this.getColor(target) !== color) {
        moves.push({ from: { c: fc, r: fr }, to: { c: tc, r: tr }, piece, captured: target });
      }
    };

    switch (type) {
      case 'K': { // General / King
        const deltas = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dc, dr] of deltas) {
          const tc = fc + dc, tr = fr + dr;
          if (this.inPalace(tc, tr, color)) addMove(tc, tr);
        }
        break;
      }

      case 'A': { // Advisor
        const deltas = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [dc, dr] of deltas) {
          const tc = fc + dc, tr = fr + dr;
          if (this.inPalace(tc, tr, color)) addMove(tc, tr);
        }
        break;
      }

      case 'E': { // Elephant
        const deltas = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
        for (const [dc, dr] of deltas) {
          const tc = fc + dc, tr = fr + dr;
          if (!this.inBounds(tc, tr)) continue;
          // Elephant cannot cross river
          if (color === 'red' && tr > 4) continue;
          if (color === 'black' && tr < 5) continue;
          // Check elephant eye (blocking point)
          const eyeC = fc + dc / 2, eyeR = fr + dr / 2;
          if (this.inBounds(eyeC, eyeR) && !board[eyeR][eyeC]) addMove(tc, tr);
        }
        break;
      }

      case 'H': { // Horse
        const jumps = [
          { leg: [0, 1], targets: [[-1, 2], [1, 2]] },
          { leg: [0, -1], targets: [[-1, -2], [1, -2]] },
          { leg: [1, 0], targets: [[2, -1], [2, 1]] },
          { leg: [-1, 0], targets: [[-2, -1], [-2, 1]] }
        ];
        for (const jump of jumps) {
          const legC = fc + jump.leg[0], legR = fr + jump.leg[1];
          if (this.inBounds(legC, legR) && !board[legR][legC]) {
            for (const [dc, dr] of jump.targets) {
              addMove(fc + dc, fr + dr);
            }
          }
        }
        break;
      }

      case 'R': { // Chariot (Rook)
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
        break;
      }

      case 'C': { // Cannon
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dc, dr] of dirs) {
          let step = 1;
          let jumped = false;
          while (true) {
            const tc = fc + dc * step, tr = fr + dr * step;
            if (!this.inBounds(tc, tr)) break;
            const target = board[tr][tc];
            if (!jumped) {
              if (!target) {
                addMove(tc, tr);
              } else {
                jumped = true; // Screen encountered
              }
            } else {
              if (target) {
                if (this.getColor(target) !== color) addMove(tc, tr);
                break;
              }
            }
            step++;
          }
        }
        break;
      }

      case 'S': { // Soldier / Pawn
        const forward = color === 'red' ? 1 : -1;
        // Forward step
        addMove(fc, fr + forward);
        // After crossing river, can move left and right
        const crossedRiver = color === 'red' ? fr >= 5 : fr <= 4;
        if (crossedRiver) {
          addMove(fc - 1, fr);
          addMove(fc + 1, fr);
        }
        break;
      }
    }

    return moves;
  }

  findGeneral(color, board = this.board) {
    const target = color === 'red' ? 'K' : 'k';
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === target) return { c, r };
      }
    }
    return null;
  }

  // Flying general check: Red and Black generals cannot face each other directly
  generalsFacing(board = this.board) {
    const redK = this.findGeneral('red', board);
    const blackK = this.findGeneral('black', board);
    if (!redK || !blackK) return false;
    if (redK.c !== blackK.c) return false;

    // Check if any piece is between them on the column
    const minR = Math.min(redK.r, blackK.r);
    const maxR = Math.max(redK.r, blackK.r);
    for (let r = minR + 1; r < maxR; r++) {
      if (board[r][redK.c]) return false;
    }
    return true;
  }

  isCheck(color = this.turn, board = this.board) {
    const gen = this.findGeneral(color, board);
    if (!gen) return true; // General captured = check
    if (this.generalsFacing(board)) return true;

    const oppColor = color === 'red' ? 'black' : 'red';
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const piece = board[r][c];
        if (piece && this.getColor(piece) === oppColor) {
          const pseudo = this.getPseudoMoves(c, r, board);
          if (pseudo.some(m => m.to.c === gen.c && m.to.r === gen.r)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  getLegalMoves(square = null) {
    const allMoves = [];
    const color = this.turn;

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const piece = this.board[r][c];
        if (!piece || this.getColor(piece) !== color) continue;
        if (square && (square.c !== c || square.r !== r)) continue;

        const pseudos = this.getPseudoMoves(c, r);
        for (const move of pseudos) {
          // Clone board and test move
          const clone = this.board.map(row => [...row]);
          clone[move.to.r][move.to.c] = clone[move.from.r][move.from.c];
          clone[move.from.r][move.from.c] = null;

          if (!this.isCheck(color, clone)) {
            allMoves.push(move);
          }
        }
      }
    }
    return allMoves;
  }

  isLegalMove(from, to) {
    const legals = this.getLegalMoves(from);
    return legals.some(m => m.to.c === to.c && m.to.r === to.r);
  }

  makeMove({ from, to, playerName = 'Anonymous', clientId = '' }) {
    if (!this.isLegalMove(from, to)) {
      return { success: false, error: 'Illegal Xiangqi move' };
    }

    const piece = this.board[from.r][from.c];
    const target = this.board[to.r][to.c];

    this.board[to.r][to.c] = piece;
    this.board[from.r][from.c] = null;

    if (target) {
      if (this.isRed(target)) this.captured.black.push(target);
      else this.captured.red.push(target);
    }

    const colNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    const san = `${piece}${colNames[from.c]}${from.r + 1}-${colNames[to.c]}${to.r + 1}`;

    const moveRecord = {
      ply: this.history.length + 1,
      san,
      from,
      to,
      piece,
      color: this.turn,
      captured: target || null,
      playerName,
      clientId,
      timestamp: Date.now()
    };

    this.history.push(moveRecord);
    this.turn = this.turn === 'red' ? 'black' : 'red';

    const state = this.getState();
    this.moveSnapshots.push(state);

    return { success: true, move: moveRecord, state };
  }

  getState() {
    const legalMoves = this.getLegalMoves();
    const isCheck = this.isCheck(this.turn);
    let status = 'active';
    let winner = null;

    if (legalMoves.length === 0) {
      // In Xiangqi, having no legal moves (checkmate or stalemate) is a LOSS
      status = isCheck ? 'checkmate' : 'stalemate';
      winner = this.turn === 'red' ? 'black' : 'red';
    }

    return {
      gameType: 'xiangqi',
      turn: this.turn,
      isCheck,
      status,
      winner,
      history: [...this.history],
      captured: { ...this.captured },
      board: this.board.map(row => [...row])
    };
  }

  reconstructSnapshots(history = this.history) {
    this.history = history ? [...history] : [];
    this.init();
    for (const m of this.history) {
      this.makeMove(m);
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
