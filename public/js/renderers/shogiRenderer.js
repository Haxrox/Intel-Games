/**
 * Shogi (Japanese Chess / 将棋) Board Renderer
 * Traditional 9x9 board with pentagonal wooden wedge tiles,
 * Komadai (in-hand piece stands), drop mechanics, promotion dialog, and presence tags.
 */
import { ShogiKanji } from '../pieces.js';

export class ShogiRenderer {
  constructor(container, options = {}) {
    this.container = container;
    this.onMoveAttempt = options.onMoveAttempt || (() => {});
    this.onHoverSquare = options.onHoverSquare || (() => {});
    this.flipped = false;
    this.autoOrient = false;
    this.selectedCoord = null;
    this.selectedDropPiece = null;
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

    this.container.classList.remove('xiangqi-aspect');
    this.container.innerHTML = '';
    const mainWrapper = document.createElement('div');
    mainWrapper.className = 'shogi-main-layout';

    // Top Komadai (Opponent's hand)
    const topHandColor = this.flipped ? 'sente' : 'gote';
    const bottomHandColor = this.flipped ? 'gote' : 'sente';

    const topKomadai = this.createKomadai(state.hands ? state.hands[topHandColor] : {}, topHandColor, 'top');
    const bottomKomadai = this.createKomadai(state.hands ? state.hands[bottomHandColor] : {}, bottomHandColor, 'bottom');

    const boardWrapper = document.createElement('div');
    boardWrapper.className = 'shogi-board-container';

    const grid = document.createElement('div');
    grid.className = 'shogi-grid';

    // 9 rows x 9 cols
    const rows = this.flipped ? [8, 7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const cols = this.flipped ? [8, 7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const rankLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];

    // Star points on Shogi board (cols 2, 5, rows 2, 5 in 0-indexed)
    const starPoints = new Set(['2,2', '5,2', '2,5', '5,5']);

    for (const r of rows) {
      for (const c of cols) {
        const sqEl = document.createElement('div');
        sqEl.className = 'shogi-square';
        sqEl.dataset.c = c;
        sqEl.dataset.r = r;
        const fileNumber = 9 - c;
        const sqName = `${fileNumber}${rankLetters[r]}`;
        sqEl.title = sqName;
        const coordKey = `${c},${r}`;

        // Rank coordinate indicator on the leftmost column (1-9)
        if (c === cols[0]) {
          const rankLabel = document.createElement('span');
          rankLabel.className = 'board-coord board-coord-rank shogi-coord';
          rankLabel.textContent = `${r + 1}`;
          sqEl.appendChild(rankLabel);
        }

        // File coordinate indicator on the bottom row (9-1)
        if (r === rows[8]) {
          const fileLabel = document.createElement('span');
          fileLabel.className = 'board-coord board-coord-file shogi-coord';
          fileLabel.textContent = `${fileNumber}`;
          sqEl.appendChild(fileLabel);
        }

        if (starPoints.has(coordKey)) {
          const star = document.createElement('div');
          star.className = 'shogi-star-point';
          sqEl.appendChild(star);
        }

        // Selection highlight
        if (this.selectedCoord && this.selectedCoord.c === c && this.selectedCoord.r === r) {
          sqEl.classList.add('selected');
        }

        // Legal move or drop indicator
        const isLegal = this.legalMoves.some(m => m.to.c === c && m.to.r === r);
        if (isLegal) {
          const dot = document.createElement('div');
          dot.className = state.board[r][c] ? 'capture-ring' : 'legal-dot';
          sqEl.appendChild(dot);
        }

        // Piece rendering
        const piece = state.board[r][c];
        if (piece) {
          const base = piece.replace('+', '').toUpperCase();
          const isPromoted = piece.startsWith('+');
          const kanjiInfo = ShogiKanji[isPromoted ? `+${base}` : base];
          const isSentePiece = piece.replace('+', '') === piece.replace('+', '').toUpperCase();

          const pieceWedge = document.createElement('div');
          // Sente pieces point UP, Gote pieces point DOWN
          const pointsUp = this.flipped ? !isSentePiece : isSentePiece;
          pieceWedge.className = `shogi-wedge ${pointsUp ? 'points-up' : 'points-down'} ${isPromoted ? 'promoted' : ''}`;
          pieceWedge.textContent = kanjiInfo ? kanjiInfo.char : base;
          sqEl.appendChild(pieceWedge);
        }

        // Google Docs-style presence tag
        for (const [cId, presence] of this.presenceHovers) {
          if (presence.hoverSquare === coordKey && cId !== myClientId) {
            sqEl.classList.add('presence-highlight');
            sqEl.style.borderColor = presence.color || '#38bdf8';

            const pill = document.createElement('div');
            pill.className = 'presence-pill';
            pill.style.backgroundColor = presence.color || '#38bdf8';
            pill.textContent = presence.playerName || 'Player';
            sqEl.appendChild(pill);
          }
        }

        sqEl.addEventListener('mouseenter', () => {
          this.onHoverSquare(coordKey);
        });

        sqEl.addEventListener('click', () => {
          this.handleClick(c, r, state);
        });

        grid.appendChild(sqEl);
      }
    }

    boardWrapper.appendChild(grid);

    mainWrapper.appendChild(topKomadai);
    mainWrapper.appendChild(boardWrapper);
    mainWrapper.appendChild(bottomKomadai);

    this.container.appendChild(mainWrapper);
  }

  createKomadai(hand = {}, color, position) {
    const komadai = document.createElement('div');
    komadai.className = `shogi-komadai ${position}`;
    komadai.innerHTML = `<div class="komadai-title">${color === 'sente' ? '先手 駒台 (Sente Hand)' : '後手 駒台 (Gote Hand)'}</div>`;

    const pieceList = document.createElement('div');
    pieceList.className = 'komadai-pieces';

    for (const [pieceType, count] of Object.entries(hand)) {
      if (count > 0) {
        const kanji = ShogiKanji[pieceType] ? ShogiKanji[pieceType].char : pieceType;
        const item = document.createElement('button');
        item.className = 'komadai-item';
        if (this.selectedDropPiece === pieceType) item.classList.add('selected');
        item.innerHTML = `<span class="k-char">${kanji}</span> <span class="k-count">x${count}</span>`;

        item.addEventListener('click', () => {
          if (this.selectedDropPiece === pieceType) {
            this.selectedDropPiece = null;
            this.legalMoves = [];
          } else {
            this.selectedDropPiece = pieceType;
            this.selectedCoord = null;
            this.onMoveAttempt({ getLegalDropsFor: pieceType, callback: (drops) => {
              this.legalMoves = drops || [];
              this.render(this.lastState, this.lastState.turn);
            }});
          }
        });

        pieceList.appendChild(item);
      }
    }

    komadai.appendChild(pieceList);
    return komadai;
  }

  handleClick(c, r, state) {
    this.lastState = state;

    // Handle dropping piece from hand
    if (this.selectedDropPiece) {
      const dropMove = this.legalMoves.find(m => m.to.c === c && m.to.r === r);
      if (dropMove) {
        const pieceType = this.selectedDropPiece;
        this.selectedDropPiece = null;
        this.legalMoves = [];
        this.onMoveAttempt({ isDrop: true, pieceType, to: { c, r } });
        return;
      }
      this.selectedDropPiece = null;
      this.legalMoves = [];
    }

    // Handle board piece move
    if (this.selectedCoord) {
      if (this.selectedCoord.c === c && this.selectedCoord.r === r) {
        this.selectedCoord = null;
        this.legalMoves = [];
        this.render(state, state.turn);
        return;
      }

      const move = this.legalMoves.find(m => m.to.c === c && m.to.r === r);
      if (move) {
        const from = this.selectedCoord;
        this.selectedCoord = null;
        this.legalMoves = [];

        // Check promotion zone
        const inZone = state.turn === 'sente' ? (r <= 2 || from.r <= 2) : (r >= 6 || from.r >= 6);
        const piece = state.board[from.r][from.c];
        const canPromote = piece && !piece.startsWith('+') && ['P', 'L', 'N', 'S', 'B', 'R'].includes(piece.toUpperCase());

        if (inZone && canPromote) {
          this.promptPromotion((promote) => {
            this.onMoveAttempt({ from, to: { c, r }, promote });
          });
          return;
        }

        this.onMoveAttempt({ from, to: { c, r }, promote: false });
        return;
      }
    }

    // Select piece on board
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

  promptPromotion(callback) {
    const modal = document.createElement('div');
    modal.className = 'promotion-modal-overlay';
    modal.innerHTML = `
      <div class="promotion-modal">
        <h3>成りますか？ (Promote Piece?)</h3>
        <div class="promotion-choices">
          <button id="btnPromoYes" class="btn-promo-yes">成る (Promote)</button>
          <button id="btnPromoNo" class="btn-promo-no">成らず (Don't Promote)</button>
        </div>
      </div>
    `;

    modal.querySelector('#btnPromoYes').addEventListener('click', () => {
      document.body.removeChild(modal);
      callback(true);
    });
    modal.querySelector('#btnPromoNo').addEventListener('click', () => {
      document.body.removeChild(modal);
      callback(false);
    });

    document.body.appendChild(modal);
  }
}
