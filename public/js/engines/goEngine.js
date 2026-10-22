/**
 * Go (Weiqi / 圍棋) Complete Rule Engine
 * Supports 9x9 (standard fast), 13x13, 19x19 boards.
 * Implements liberty flood-fill, stone captures, suicide prevention, and Ko rule.
 */
export class GoEngine {
  constructor(size = 9) {
    this.name = 'go';
    this.size = size;
    this.board = Array(this.size).fill(null).map(() => Array(this.size).fill(null));
    this.turn = 'B'; // 'B' (Black) moves first, 'W' (White) moves second
    this.history = [];
    this.moveSnapshots = [];
    this.captured = { B: 0, W: 0 }; // B = stones captured by Black, W = stones captured by White
    this.consecutivePasses = 0;
    this.previousBoardString = null;
    this.init(size);
  }

  init(size = this.size) {
    this.size = size;
    this.board = Array(this.size).fill(null).map(() => Array(this.size).fill(null));
    this.turn = 'B';
    this.history = [];
    this.captured = { B: 0, W: 0 };
    this.consecutivePasses = 0;
    this.previousBoardString = null;
    this.moveSnapshots = [this.getState()];
    return this.getState();
  }

  inBounds(x, y) {
    return x >= 0 && x < this.size && y >= 0 && y < this.size;
  }

  getNeighbors(x, y) {
    const deltas = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const res = [];
    for (const [dx, dy] of deltas) {
      const nx = x + dx, ny = y + dy;
      if (this.inBounds(nx, ny)) res.push({ x: nx, y: ny });
    }
    return res;
  }

  getBoardString(board = this.board) {
    return board.map(row => row.map(cell => cell || '.').join('')).join('');
  }

  // Flood-fill to find an entire connected group and its liberties
  getGroupAndLiberties(startX, startY, board = this.board) {
    const color = board[startY][startX];
    if (!color) return { stones: [], liberties: new Set() };

    const visited = new Set();
    const stones = [];
    const liberties = new Set();
    const queue = [{ x: startX, y: startY }];
    visited.add(`${startX},${startY}`);

    while (queue.length > 0) {
      const { x, y } = queue.shift();
      stones.push({ x, y });

      for (const neighbor of this.getNeighbors(x, y)) {
        const key = `${neighbor.x},${neighbor.y}`;
        const neighborColor = board[neighbor.y][neighbor.x];

        if (!neighborColor) {
          liberties.add(key);
        } else if (neighborColor === color && !visited.has(key)) {
          visited.add(key);
          queue.push(neighbor);
        }
      }
    }

    return { stones, liberties };
  }

  // Test if a move at (x, y) is legal for the current turn
  isLegalMove(x, y) {
    if (!this.inBounds(x, y) || this.board[y][x] !== null) return false;

    const color = this.turn;
    const oppColor = color === 'B' ? 'W' : 'B';

    // Clone board to simulate
    const clone = this.board.map(row => [...row]);
    clone[y][x] = color;

    // Check adjacent opponent groups for captures
    let capturedStones = 0;
    const neighbors = this.getNeighbors(x, y);

    for (const n of neighbors) {
      if (clone[n.y][n.x] === oppColor) {
        const { stones, liberties } = this.getGroupAndLiberties(n.x, n.y, clone);
        if (liberties.size === 0) {
          capturedStones += stones.length;
          for (const stone of stones) {
            clone[stone.y][stone.x] = null;
          }
        }
      }
    }

    // Check suicide rule: if no captures made and own group has 0 liberties, illegal
    const ownGroup = this.getGroupAndLiberties(x, y, clone);
    if (ownGroup.liberties.size === 0) {
      return false;
    }

    // Check Ko rule: cannot immediately recreate the previous board position
    const newBoardString = this.getBoardString(clone);
    if (this.previousBoardString && newBoardString === this.previousBoardString) {
      return false;
    }

    return true;
  }

  makeMove({ x, y, isPass = false, playerName = 'Anonymous', clientId = '' }) {
    if (isPass) {
      this.consecutivePasses++;
      const moveRecord = {
        ply: this.history.length + 1,
        san: `${this.turn} Pass`,
        isPass: true,
        color: this.turn,
        playerName,
        clientId,
        timestamp: Date.now()
      };
      this.history.push(moveRecord);
      this.turn = this.turn === 'B' ? 'W' : 'B';
      const state = this.getState();
      this.moveSnapshots.push(state);
      return { success: true, move: moveRecord, state };
    }

    if (!this.isLegalMove(x, y)) {
      return { success: false, error: 'Illegal Go move' };
    }

    const currentBoardString = this.getBoardString();
    const color = this.turn;
    const oppColor = color === 'B' ? 'W' : 'B';

    this.board[y][x] = color;
    this.consecutivePasses = 0;

    // Capture opponent groups with 0 liberties
    let capturedCount = 0;
    for (const n of this.getNeighbors(x, y)) {
      if (this.board[n.y][n.x] === oppColor) {
        const { stones, liberties } = this.getGroupAndLiberties(n.x, n.y);
        if (liberties.size === 0) {
          capturedCount += stones.length;
          for (const s of stones) {
            this.board[s.y][s.x] = null;
          }
        }
      }
    }

    this.captured[color] += capturedCount;
    this.previousBoardString = currentBoardString;

    const colLetter = String.fromCharCode(65 + (x >= 8 ? x + 1 : x)); // Skip 'I' in standard Go notation
    const san = `${color} ${colLetter}${this.size - y}`;

    const moveRecord = {
      ply: this.history.length + 1,
      san,
      x,
      y,
      color,
      capturedCount,
      playerName,
      clientId,
      timestamp: Date.now()
    };

    this.history.push(moveRecord);
    this.turn = oppColor;

    const state = this.getState();
    this.moveSnapshots.push(state);

    return { success: true, move: moveRecord, state };
  }

  getState() {
    let status = 'active';
    let winner = null;

    if (this.consecutivePasses >= 2) {
      status = 'game_over';
      winner = this.captured.B > this.captured.W ? 'B' : (this.captured.W > this.captured.B ? 'W' : 'draw');
    }

    return {
      gameType: 'go',
      size: this.size,
      turn: this.turn,
      status,
      winner,
      consecutivePasses: this.consecutivePasses,
      captured: { ...this.captured },
      history: [...this.history],
      board: this.board.map(row => [...row])
    };
  }

  reconstructSnapshots(history = this.history) {
    this.history = history ? [...history] : [];
    this.init();
    for (const m of this.history) {
      if (m.type === 'pass') this.pass(m.color);
      else this.placeStone(m.r, m.c, m.color);
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
