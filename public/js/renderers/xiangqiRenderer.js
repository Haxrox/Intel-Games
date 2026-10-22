/**
 * Xiangqi (Chinese Chess) Board Renderer (9x10)
 * Renders traditional board with River ("楚河 漢界"), Imperial Palaces,
 * circular calligraphic pieces, legal move target dots, and collaborative presence tags.
 */
import { XiangqiTokens } from '../pieces.js';

export class XiangqiRenderer {
  constructor(container, options = {}) {
    this.container = container;
    this.onMoveAttempt = options.onMoveAttempt || (() => {});
    this.onHoverSquare = options.onHoverSquare || (() => {});
    this.flipped = false;
    this.autoOrient = false;
    this.selectedCoord = null;
    this.legalMoves = [];
    this.presenceHovers = new Map();
  }

  setFlipped(flipped) {
    this.flipped = flipped;
  }

  toggleFlip() {
    this.flipped = !this.flipped;
    return this.flipped;
  }

  setAutoOrient(auto) {
    this.autoOrient = auto;
  }

  updatePresence(presenceList) {
    this.presenceHovers.clear();
    for (const p of presenceList) {
      if (p.hoverSquare) this.presenceHovers.set(p.clientId, p);
    }
  }

  render(state, currentTurn, myClientId = this.myClientId, myPlayerName = this.myPlayerName) {
    if (typeof document === 'undefined' || !state || !this.container) return;
    this.myClientId = myClientId || this.myClientId || '';
    this.myPlayerName = myPlayerName || this.myPlayerName || '';

    this.container.classList.add('xiangqi-aspect');
    this.container.innerHTML = '';
    const boardWrapper = document.createElement('div');
    boardWrapper.className = 'xiangqi-board-container';

    // 10 rows (0..9) x 9 cols (0..8)
    const rows = this.flipped ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
    const cols = this.flipped ? [8, 7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const colLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];

    // Grid element
    const grid = document.createElement('div');
    grid.className = 'xiangqi-grid';

    // Board line backdrop and river label
    const river = document.createElement('div');
    river.className = 'xiangqi-river';
    river.innerHTML = '<span>楚 河</span><span>漢 界</span>';
    boardWrapper.appendChild(river);

    for (const r of rows) {
      for (const c of cols) {
        const intersection = document.createElement('div');
        intersection.className = 'xiangqi-intersection';
        intersection.dataset.c = c;
        intersection.dataset.r = r;
        const sqName = `${colLetters[c]}${r + 1}`;
        intersection.title = sqName;
        const coordKey = `${c},${r}`;

        // Rank coordinate indicator on the leftmost column (1-10)
        if (c === cols[0]) {
          const rankLabel = document.createElement('span');
          rankLabel.className = 'board-coord board-coord-rank xiangqi-coord';
          rankLabel.textContent = `${r + 1}`;
          intersection.appendChild(rankLabel);
        }

        // File coordinate indicator on the bottom row (a-i)
        if (r === rows[9]) {
          const fileLabel = document.createElement('span');
          fileLabel.className = 'board-coord board-coord-file xiangqi-coord';
          fileLabel.textContent = colLetters[c];
          intersection.appendChild(fileLabel);
        }

        // Check if selected
        if (this.selectedCoord && this.selectedCoord.c === c && this.selectedCoord.r === r) {
          intersection.classList.add('selected');
        }

        // Legal move indicator
        const isLegal = this.legalMoves.some(m => m.to.c === c && m.to.r === r);
        if (isLegal) {
          const dot = document.createElement('div');
          dot.className = state.board[r][c] ? 'capture-ring' : 'legal-dot';
          intersection.appendChild(dot);
        }

        // Piece rendering
        const piece = state.board[r][c];
        if (piece) {
          const token = XiangqiTokens[piece];
          const tokenEl = document.createElement('div');
          const isRed = piece === piece.toUpperCase();
          tokenEl.className = `xiangqi-piece ${isRed ? 'red-piece' : 'black-piece'}`;
          tokenEl.textContent = token ? token.char : piece;
          intersection.appendChild(tokenEl);
        }

        // Google Docs-style presence tag
        for (const [cId, presence] of this.presenceHovers) {
          if (presence.hoverSquare === coordKey && cId !== myClientId) {
            intersection.classList.add('presence-highlight');
            intersection.style.borderColor = presence.color || '#38bdf8';

            const pill = document.createElement('div');
            pill.className = 'presence-pill';
            pill.style.backgroundColor = presence.color || '#38bdf8';
            pill.textContent = presence.playerName || 'Player';
            intersection.appendChild(pill);
          }
        }

        // Hover & click listeners
        intersection.addEventListener('mouseenter', () => {
          this.onHoverSquare(coordKey);
        });

        intersection.addEventListener('click', () => {
          this.handleClick(c, r, state);
        });

        grid.appendChild(intersection);
      }
    }

    boardWrapper.appendChild(grid);
    this.container.appendChild(boardWrapper);
  }

  handleClick(c, r, state) {
    if (this.selectedCoord) {
      if (this.selectedCoord.c === c && this.selectedCoord.r === r) {
        this.selectedCoord = null;
        this.legalMoves = [];
        this.render(state, state.turn);
        return;
      }

      // Check if clicking a legal move target
      const move = this.legalMoves.find(m => m.to.c === c && m.to.r === r);
      if (move) {
        const from = this.selectedCoord;
        this.selectedCoord = null;
        this.legalMoves = [];
        this.onMoveAttempt({ from, to: { c, r } });
        return;
      }
    }

    // Select piece
    const piece = state.board[r][c];
    if (piece) {
      this.selectedCoord = { c, r };
      this.onMoveAttempt({ getLegalMovesFor: { c, r }, callback: (moves) => {
        this.legalMoves = moves || [];
        this.render(state, state.turn);
      }});
    } else {
      this.selectedCoord = null;
      this.legalMoves = [];
      this.render(state, state.turn);
    }
  }
}
