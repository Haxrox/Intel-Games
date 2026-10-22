/**
 * Interactive Time-Travel Move History Controller
 * Renders chronological move sheet, allows users to scrub and inspect past game states,
 * shows who made every move, and supports replaying archived games locally.
 */

export class HistoryController {
  constructor(tableContainerEl, bannerContainerEl, onScrubState, onExitReplay) {
    this.tableContainerEl = tableContainerEl;
    this.bannerContainerEl = bannerContainerEl;
    this.onScrubState = onScrubState;
    this.onExitReplay = onExitReplay;
    this.currentPly = -1; // -1 means viewing LIVE state
    this.maxPly = 0;
    this.history = [];
    this.snapshots = [];
    this.isReplayMode = false;
    this.replayGameData = null;
  }

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  updateHistory(history, snapshots) {
    if (this.isReplayMode) return; // In replay mode, do not overwrite with live stream

    this.history = history || [];
    this.snapshots = snapshots || [];
    this.maxPly = this.history.length;

    // If previously at live, stay at live
    if (this.currentPly === -1 || this.currentPly >= this.maxPly) {
      this.currentPly = -1;
    }

    this.render();
  }

  setReplayGame(gameData, engineSnapshots = []) {
    this.isReplayMode = true;
    this.replayGameData = gameData;
    this.history = gameData.history ? [...gameData.history] : [];
    this.snapshots = engineSnapshots || [];
    this.maxPly = this.history.length;
    this.currentPly = this.maxPly; // Start at final position of past game

    this.render();
    if (this.onScrubState) this.onScrubState(this.currentPly);
  }

  exitReplay() {
    this.isReplayMode = false;
    this.replayGameData = null;
    this.currentPly = -1;
    if (this.onExitReplay) this.onExitReplay();
  }

  isAtLive() {
    return !this.isReplayMode && (this.currentPly === -1 || this.currentPly === this.maxPly);
  }

  goToPly(ply) {
    if (ply < 0) ply = 0;
    if (ply > this.maxPly) ply = this.maxPly;

    if (!this.isReplayMode && ply === this.maxPly) {
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
    if (this.isReplayMode) {
      this.exitReplay();
    } else {
      this.goToPly(this.maxPly);
    }
  }

  render() {
    this.renderTable();
    this.renderBanner();
  }

  renderBanner() {
    if (!this.bannerContainerEl || typeof document === 'undefined') return;

    if (this.isAtLive()) {
      this.bannerContainerEl.innerHTML = '';
      this.bannerContainerEl.classList.remove('active');
      return;
    }

    this.bannerContainerEl.className = 'history-preview-banner active';

    let moverInfo = '';
    const activeIdx = (this.currentPly === -1 ? this.maxPly : this.currentPly) - 1;
    if (activeIdx >= 0 && activeIdx < this.history.length) {
      const m = this.history[activeIdx];
      if (m) {
        const isW = m.color === 'w' || m.color === 'red' || (activeIdx % 2 === 0);
        moverInfo = `<span class="mover-detail">• ${isW ? '⚪ White' : '⚫ Black'} played <strong>${this.escapeHtml(m.san || m.piece || 'Move')}</strong> (by <span class="mover-highlight">${this.escapeHtml(m.playerName || 'Player')}</span>)</span>`;
      }
    }

    if (this.isReplayMode) {
      this.bannerContainerEl.innerHTML = `
        <div class="banner-content banner-replay-mode">
          <span>🏆 <strong>Past Game Replay</strong> (${this.replayGameData ? (this.replayGameData.gameType || 'chess').toUpperCase() : 'GAME'}): Move <strong>#${this.currentPly}</strong> of ${this.maxPly} ${moverInfo}</span>
          <button id="btnReturnToLive" class="btn-return-live">✕ Exit Replay & Return to Live</button>
        </div>
      `;
    } else {
      this.bannerContainerEl.innerHTML = `
        <div class="banner-content">
          <span>🕒 Viewing Move <strong>#${this.currentPly}</strong> of ${this.maxPly} (Live Game History) ${moverInfo}</span>
          <button id="btnReturnToLive" class="btn-return-live">Return to Live Board ➔</button>
        </div>
      `;
    }

    this.bannerContainerEl.querySelector('#btnReturnToLive').addEventListener('click', () => {
      this.goLive();
    });
  }

  renderTable() {
    if (!this.tableContainerEl || typeof document === 'undefined') return;

    this.tableContainerEl.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'history-sheet-wrapper';

    // Time-travel controls
    const controls = document.createElement('div');
    controls.className = 'history-controls';
    const curLabel = this.isAtLive() ? 'Live' : (this.currentPly === 0 ? 'Start' : `Move ${this.currentPly}`);
    controls.innerHTML = `
      <button id="btnHistStart" title="First Move" ${this.currentPly === 0 ? 'disabled' : ''}>&laquo;</button>
      <button id="btnHistPrev" title="Previous Move" ${this.currentPly === 0 ? 'disabled' : ''}>&lsaquo;</button>
      <span class="history-ply-label">${curLabel}</span>
      <button id="btnHistNext" title="Next Move" ${this.currentPly === this.maxPly && !this.isReplayMode ? 'disabled' : ''}>&rsaquo;</button>
      <button id="btnHistLive" title="${this.isReplayMode ? 'Exit Replay' : 'Live Board'}" class="${this.isReplayMode ? 'btn-replay-exit' : ''}">${this.isReplayMode ? '✕ Live' : '&raquo; Live'}</button>
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
          <span class="move-san">${this.escapeHtml(pair.white.san || pair.white.piece || 'Move')}</span>
          <span class="move-player-tag" title="Moved by: ${this.escapeHtml(pair.white.playerName || 'Player')}">${this.escapeHtml(pair.white.playerName || 'Player')}</span>
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
            <span class="move-san">${this.escapeHtml(pair.black.san || pair.black.piece || 'Move')}</span>
            <span class="move-player-tag" title="Moved by: ${this.escapeHtml(pair.black.playerName || 'Player')}">${this.escapeHtml(pair.black.playerName || 'Player')}</span>
          `;
          blackBtn.addEventListener('click', () => {
            this.goToPly(pair.black.ply);
          });
          row.appendChild(blackBtn);
        } else {
          const emptyCell = document.createElement('span');
          emptyCell.className = 'col-empty-cell move-dots';
          emptyCell.innerHTML = '<span class="move-dots">...</span>';
          row.appendChild(emptyCell);
        }

        body.appendChild(row);
      });
    }

    gridContainer.appendChild(body);
    wrapper.appendChild(gridContainer);
    this.tableContainerEl.appendChild(wrapper);

    // Auto-scroll to active ply
    const activeEl = body.querySelector('.active-ply');
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
}
