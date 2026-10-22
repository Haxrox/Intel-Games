/**
 * Go (Weiqi / 圍棋) Board Renderer
 * Realistic wood-grain intersection grid with star points (hoshi),
 * 3D spherical stones with radial lighting, stone placement hover preview, and presence tags.
 */
export class GoRenderer {
  constructor(container, options = {}) {
    this.container = container;
    this.onMoveAttempt = options.onMoveAttempt || (() => {});
    this.onHoverSquare = options.onHoverSquare || (() => {});
    this.presenceHovers = new Map();
  }

  updatePresence(presenceList) {
    this.presenceHovers.clear();
    for (const p of presenceList) {
      if (p.hoverSquare) this.presenceHovers.set(p.clientId, p);
    }
  }

  render(state, currentTurn, myClientId = '') {
    if (!state || !this.container) return;

    this.container.innerHTML = '';
    const size = state.size || 9;

    const wrapper = document.createElement('div');
    wrapper.className = 'go-board-container';

    // Controls bar (Pass turn, captured count)
    const topBar = document.createElement('div');
    topBar.className = 'go-top-bar';
    topBar.innerHTML = `
      <div class="go-captures">
        <span class="stone-badge black"></span> Captures: ${state.captured ? state.captured.B : 0}
        <span class="stone-badge white" style="margin-left: 12px;"></span> Captures: ${state.captured ? state.captured.W : 0}
      </div>
      <button class="btn-go-pass" id="btnGoPass">Pass Turn</button>
    `;

    topBar.querySelector('#btnGoPass').addEventListener('click', () => {
      this.onMoveAttempt({ isPass: true });
    });
    wrapper.appendChild(topBar);

    const grid = document.createElement('div');
    grid.className = 'go-grid';
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${size}, 1fr)`;

    // Star point coords (hoshi)
    const starPoints = new Set();
    if (size === 9) {
      ['2,2', '6,2', '4,4', '2,6', '6,6'].forEach(s => starPoints.add(s));
    } else if (size === 19) {
      ['3,3', '9,3', '15,3', '3,9', '9,9', '15,9', '3,15', '9,15', '15,15'].forEach(s => starPoints.add(s));
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const intersection = document.createElement('div');
        intersection.className = 'go-intersection';
        intersection.dataset.x = x;
        intersection.dataset.y = y;
        const coordKey = `${x},${y}`;

        if (starPoints.has(coordKey)) {
          const star = document.createElement('div');
          star.className = 'go-star-point';
          intersection.appendChild(star);
        }

        // Stone rendering
        const stone = state.board[y][x];
        if (stone) {
          const stoneEl = document.createElement('div');
          stoneEl.className = `go-stone ${stone === 'B' ? 'black' : 'white'}`;
          intersection.appendChild(stoneEl);
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

        intersection.addEventListener('mouseenter', () => {
          this.onHoverSquare(coordKey);
        });

        intersection.addEventListener('click', () => {
          if (!state.board[y][x]) {
            this.onMoveAttempt({ x, y });
          }
        });

        grid.appendChild(intersection);
      }
    }

    wrapper.appendChild(grid);
    this.container.appendChild(wrapper);
  }
}
