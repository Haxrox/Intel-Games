/**
 * Chess Board Renderer (8x8)
 * Supports dynamic turn auto-orientation, manual flip, legal move indicators,
 * check warning glow, Google Docs-style collaborative presence tags, and promotion modal.
 */
import { ChessPieces } from '../pieces.js';

export class ChessRenderer {
  constructor(container, options = {}) {
    this.container = container;
    this.onMoveAttempt = options.onMoveAttempt || (() => {});
    this.onHoverSquare = options.onHoverSquare || (() => {});
    this.flipped = false;
    this.autoOrient = false;
    this.isPlanningMode = false;
    this.myClientId = '';
    this.myPlayerName = '';
    this.selectedSquare = null;
    this.legalMoves = [];
    this.lastMove = null;
    this.isCheck = false;
    this.presenceHovers = new Map(); // clientId -> { square, playerName, color }
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

  setPlanningMode(isPlanning) {
    this.isPlanningMode = isPlanning;
  }

  updatePresence(presenceList) {
    this.presenceHovers.clear();
    for (const p of presenceList) {
      if (p.hoverSquare) {
        this.presenceHovers.set(p.clientId, p);
      }
    }
  }

  render(state, currentTurn, myClientId = this.myClientId, myPlayerName = this.myPlayerName) {
    if (typeof document === 'undefined' || !state || !this.container) return;
    this.myClientId = myClientId || this.myClientId || '';
    this.myPlayerName = myPlayerName || this.myPlayerName || '';

    this.container.innerHTML = '';
    const boardEl = document.createElement('div');
    boardEl.className = 'chess-board-grid';
    if (state.isPreview) {
      boardEl.classList.add('preview-active', state.turn === 'w' ? 'preview-turn-w' : 'preview-turn-b');
    } else if (state.isHistorical) {
      boardEl.classList.add('historical-active');
    }

    const ranks = this.flipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const files = this.flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

    const fileLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    for (const r of ranks) {
      for (const f of files) {
        const sqName = `${fileLetters[f]}${r + 1}`;
        const isDark = (r + f) % 2 === 0;

        const sqEl = document.createElement('div');
        sqEl.className = `board-square ${isDark ? 'dark' : 'light'}`;
        sqEl.dataset.square = sqName;
        sqEl.title = sqName;

        // Rank coordinate indicator on the leftmost column (1-8)
        if (f === files[0]) {
          const rankLabel = document.createElement('span');
          rankLabel.className = 'board-coord board-coord-rank';
          rankLabel.textContent = `${r + 1}`;
          sqEl.appendChild(rankLabel);
        }

        // File coordinate indicator on the bottom row (a-h)
        if (r === ranks[7]) {
          const fileLabel = document.createElement('span');
          fileLabel.className = 'board-coord board-coord-file';
          fileLabel.textContent = fileLetters[f];
          sqEl.appendChild(fileLabel);
        }

        // Last move highlight
        if (state.lastMove && (state.lastMove.from === sqName || state.lastMove.to === sqName)) {
          sqEl.classList.add('last-move');
        }

        // Selected square highlight
        if (this.selectedSquare === sqName) {
          sqEl.classList.add('selected');
        }

        // Legal move destination indicator
        const isTarget = this.legalMoves.some(m => m.to === sqName);
        if (isTarget) {
          const pieceOnSquare = state.board && state.board[7 - r] ? state.board[7 - r][f] : null;
          const dot = document.createElement('div');
          dot.className = pieceOnSquare ? 'capture-ring' : 'legal-dot';
          sqEl.appendChild(dot);
        }

        // Piece rendering
        const piece = state.board && state.board[7 - r] ? state.board[7 - r][f] : null;
        if (piece) {
          const key = `${piece.color}${piece.type.toUpperCase()}`;
          const pieceSvg = ChessPieces[key];
          if (pieceSvg) {
            const pieceEl = document.createElement('div');
            pieceEl.className = `piece-wrapper ${piece.color === 'w' ? 'white-piece' : 'black-piece'}`;
            pieceEl.innerHTML = pieceSvg;

            // In-check glow on King
            if (piece.type === 'k' && piece.color === state.turn && state.isCheck) {
              pieceEl.classList.add('king-in-check');
            }

            sqEl.appendChild(pieceEl);
          }
        }

        // Google Docs-style presence tags
        for (const [cId, presence] of this.presenceHovers) {
          if (presence.hoverSquare === sqName && cId !== this.myClientId) {
            sqEl.classList.add('presence-highlight');
            sqEl.style.borderColor = presence.color || '#38bdf8';

            const pill = document.createElement('div');
            pill.className = 'presence-pill';
            pill.style.backgroundColor = presence.color || '#38bdf8';
            pill.textContent = presence.playerName || 'Player';
            sqEl.appendChild(pill);
          }
        }

        // Event listeners
        sqEl.addEventListener('mouseenter', () => {
          this.onHoverSquare(sqName);
        });

        sqEl.addEventListener('click', (e) => {
          this.handleSquareClick(sqName, piece, state);
        });

        boardEl.appendChild(sqEl);
      }
    }

    this.container.appendChild(boardEl);
  }

  handleSquareClick(square, piece, state) {
    if (state && state.isHistorical) {
      return; // Read-only history preview
    }

    if (this.selectedSquare) {
      if (this.selectedSquare === square) {
        this.selectedSquare = null;
        this.legalMoves = [];
        this.render(state, state.turn);
        return;
      }

      // Check if moving to this square is a legal move
      const move = this.legalMoves.find(m => m.to === square);
      if (move) {
        const from = this.selectedSquare;
        this.selectedSquare = null;
        this.legalMoves = [];

        // Check pawn promotion
        const fromPiece = state.board ? this.getPieceAt(from, state.board) : null;
        if (fromPiece && fromPiece.type === 'p' && (square.endsWith('8') || square.endsWith('1'))) {
          this.promptPromotion((promo) => {
            this.onMoveAttempt({ from, to: square, promotion: promo, san: move.san });
          });
          return;
        }

        this.onMoveAttempt({ from, to: square, promotion: 'q', san: move.san });
        return;
      }

      // If clicked on another piece of the friendly color, switch selection!
      const clickedPiece = piece;
      const currentPiece = state.board ? this.getPieceAt(this.selectedSquare, state.board) : null;
      if (clickedPiece && currentPiece && clickedPiece.color === currentPiece.color) {
        this.selectedSquare = square;
        this.onMoveAttempt({ getLegalMovesFor: square, callback: (moves) => {
          this.legalMoves = moves || [];
          this.render(state, state.turn);
        }});
        return;
      }

      // If not a legal move, piece goes back / deselect
      this.selectedSquare = null;
      this.legalMoves = [];
      this.render(state, state.turn);
      return;
    }

    // Select piece
    if (piece) {
      this.selectedSquare = square;
      this.onMoveAttempt({ getLegalMovesFor: square, callback: (moves) => {
        this.legalMoves = moves || [];
        this.render(state, state.turn);
      }});
    } else {
      this.selectedSquare = null;
      this.legalMoves = [];
      this.render(state, state.turn);
    }
  }

  getPieceAt(sq, board) {
    const file = sq.charCodeAt(0) - 97;
    const rank = parseInt(sq[1], 10) - 1;
    return board[7 - rank] ? board[7 - rank][file] : null;
  }

  promptPromotion(callback) {
    const modal = document.createElement('div');
    modal.className = 'promotion-modal-overlay';
    modal.innerHTML = `
      <div class="promotion-modal">
        <h3>Promote Pawn</h3>
        <div class="promotion-choices">
          <button data-piece="q" title="Queen">${ChessPieces.wQ}</button>
          <button data-piece="r" title="Rook">${ChessPieces.wR}</button>
          <button data-piece="b" title="Bishop">${ChessPieces.wB}</button>
          <button data-piece="n" title="Knight">${ChessPieces.wN}</button>
        </div>
      </div>
    `;

    modal.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.body.removeChild(modal);
        callback(btn.dataset.piece);
      });
    });

    document.body.appendChild(modal);
  }
}
