/**
 * Interactive Time-Travel Move History Controller
 * Renders chronological move sheet and allows users to scrub and inspect past game states.
 */

export class HistoryController {
  constructor(tableContainerEl, bannerContainerEl, onScrubState) {
    this.tableContainerEl = tableContainerEl;
    this.bannerContainerEl = bannerContainerEl;
    this.onScrubState = onScrubState;
    this.currentPly = -1; // -1 means viewing LIVE state
    this.maxPly = 0;
    this.history = [];
    this.snapshots = [];
  }

  updateHistory(history, snapshots) {
    this.history = history || [];
    this.snapshots = snapshots || [];
    this.maxPly = this.history.length;

    // If previously at live, stay at live
    if (this.currentPly === -1 || this.currentPly >= this.maxPly) {
      this.currentPly = -1;
    }

    this.render();
  }

  isAtLive() {
    return this.currentPly === -1 || this.currentPly === this.maxPly;
  }

  goToPly(ply) {
    if (ply < 0) ply = 0;
    if (ply > this.maxPly) ply = this.maxPly;

    if (ply === this.maxPly) {
      this.currentPly = -1; // Live
    } else {
      this.currentPly = ply;
    }

    this.render();
    this.onScrubState(this.currentPly);
  }

  goStart() {
    this.goToPly(0);
  }

  goPrev() {
    const target = this.currentPly === -1 ? this.maxPly - 1 : this.currentPly - 1;
    this.goToPly(target);
  }

  goNext() {
    const target = this.currentPly === -1 ? this.maxPly : this.currentPly + 1;
    this.goToPly(target);
  }

  goLive() {
    this.goToPly(this.maxPly);
  }

  render() {
    this.renderTable();
    this.renderBanner();
  }

  renderBanner() {
    if (!this.bannerContainerEl) return;

    if (this.isAtLive()) {
      this.bannerContainerEl.innerHTML = '';
      this.bannerContainerEl.classList.remove('active');
      return;
    }

    this.bannerContainerEl.className = 'history-preview-banner active';
    this.bannerContainerEl.innerHTML = `
      <div class="banner-content">
        <span>🕒 Viewing Move <strong>#${this.currentPly}</strong> of ${this.maxPly} (History Preview)</span>
        <button id="btnReturnToLive" class="btn-return-live">Return to Live Board ➔</button>
      </div>
    `;

    this.bannerContainerEl.querySelector('#btnReturnToLive').addEventListener('click', () => {
      this.goLive();
    });
  }

  renderTable() {
    if (!this.tableContainerEl) return;

    this.tableContainerEl.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'history-sheet-wrapper';

    // Time-travel controls
    const controls = document.createElement('div');
    controls.className = 'history-controls';
    controls.innerHTML = `
      <button id="btnHistStart" title="First Move" ${this.currentPly === 0 ? 'disabled' : ''}>&laquo;</button>
      <button id="btnHistPrev" title="Previous Move" ${this.currentPly === 0 ? 'disabled' : ''}>&lsaquo;</button>
      <span class="history-ply-label">${this.isAtLive() ? 'Live' : `Move ${this.currentPly}`}</span>
      <button id="btnHistNext" title="Next Move" ${this.isAtLive() ? 'disabled' : ''}>&rsaquo;</button>
      <button id="btnHistLive" title="Live Board" ${this.isAtLive() ? 'disabled' : ''}>&raquo; Live</button>
    `;

    controls.querySelector('#btnHistStart').addEventListener('click', () => this.goStart());
    controls.querySelector('#btnHistPrev').addEventListener('click', () => this.goPrev());
    controls.querySelector('#btnHistNext').addEventListener('click', () => this.goNext());
    controls.querySelector('#btnHistLive').addEventListener('click', () => this.goLive());

    wrapper.appendChild(controls);

    // Move Sheet: Chess.com style 3-column grid (Move #, White 1st, Black 2nd side-by-side)
    const gridContainer = document.createElement('div');
    gridContainer.className = 'history-grid-container';

    const header = document.createElement('div');
    header.className = 'history-grid-header';
    header.innerHTML = `
      <span class="col-num-hdr">#</span>
      <span class="col-half-hdr">⚪ White / 1st</span>
      <span class="col-half-hdr">⚫ Black / 2nd</span>
    `;
    gridContainer.appendChild(header);

    const body = document.createElement('div');
    body.className = 'history-grid-body';

    if (this.history.length === 0) {
      body.innerHTML = `<div class="history-empty">No moves yet. Make the first move!</div>`;
    } else {
      // Group history into pairs (1 White, 1 Black)
      const pairs = [];
      for (let i = 0; i < this.history.length; i += 2) {
        pairs.push({
          moveNumber: Math.floor(i / 2) + 1,
          white: { ...this.history[i], ply: i + 1 },
          black: this.history[i + 1] ? { ...this.history[i + 1], ply: i + 2 } : null
        });
      }

      pairs.forEach((pair) => {
        const row = document.createElement('div');
        row.className = 'history-grid-row';

        // Column 1: Move number
        const numEl = document.createElement('span');
        numEl.className = 'col-num-cell';
        numEl.textContent = `${pair.moveNumber}.`;
        row.appendChild(numEl);

        // Column 2: White move
        const whiteBtn = document.createElement('div');
        whiteBtn.className = 'move-btn white-btn';
        if (this.currentPly === pair.white.ply) whiteBtn.classList.add('active-ply');
        whiteBtn.innerHTML = `
          <span class="move-san">${pair.white.san || pair.white.piece || 'Move'}</span>
          <span class="move-player-tag" title="Player: ${this.escapeHtml(pair.white.playerName || 'Anon')}">${this.escapeHtml(pair.white.playerName || 'Anon')}</span>
        `;
        whiteBtn.addEventListener('click', () => {
          this.goToPly(pair.white.ply);
        });
        row.appendChild(whiteBtn);

        // Column 3: Black move
        if (pair.black) {
          const blackBtn = document.createElement('div');
          blackBtn.className = 'move-btn black-btn';
          if (this.currentPly === pair.black.ply) blackBtn.classList.add('active-ply');
          blackBtn.innerHTML = `
            <span class="move-san">${pair.black.san || pair.black.piece || 'Move'}</span>
            <span class="move-player-tag" title="Player: ${this.escapeHtml(pair.black.playerName || 'Anon')}">${this.escapeHtml(pair.black.playerName || 'Anon')}</span>
          `;
          blackBtn.addEventListener('click', () => {
            this.goToPly(pair.black.ply);
          });
          row.appendChild(blackBtn);
        } else {
          const emptyCell = document.createElement('div');
          emptyCell.className = 'move-btn empty-cell';
          emptyCell.innerHTML = `<span class="move-dots">&bull;&bull;&bull;</span>`;
          row.appendChild(emptyCell);
        }

        body.appendChild(row);
      });
    }

    gridContainer.appendChild(body);
    wrapper.appendChild(gridContainer);
    this.tableContainerEl.appendChild(wrapper);
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
