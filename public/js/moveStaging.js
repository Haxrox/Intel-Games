/**
 * Move Staging & Collaborative Strategy Controller
 * Manages two-step move verification ('Confirm Move' bar) to avoid misclicks,
 * handles freeform strategy scratchpad exploration, and executes atomic confirmation.
 */

export class MoveStagingController {
  constructor(containerEl, onConfirmMove, onCancelMove, onUndoStep = null) {
    this.containerEl = containerEl;
    this.onConfirmMove = onConfirmMove;
    this.onCancelMove = onCancelMove;
    this.onUndoStep = onUndoStep;
    this.stagedData = null; // { firstMove, previewMoves, stagedBy, isMe }
  }

  stagePreview({ firstMove, previewMoves = [], stagedBy = null, isMe = true, nextTurn = null }) {
    this.stagedData = { firstMove, previewMoves, stagedBy, isMe, nextTurn };
    this.render();
  }

  cancelStagedMove() {
    this.clear();
  }

  clear() {
    this.stagedData = null;
    this.render();
  }

  getStagedMove() {
    return this.stagedData ? this.stagedData.firstMove : null;
  }

  render() {
    if (!this.containerEl) return;

    if (!this.stagedData) {
      this.containerEl.innerHTML = '';
      this.containerEl.classList.remove('active');
      return;
    }

    const { firstMove, previewMoves = [], stagedBy, isMe, nextTurn } = this.stagedData;
    this.containerEl.className = 'confirm-move-bar active';

    // Determine whose turn is next in the preview
    let isWhiteNext = true;
    if (nextTurn) {
      isWhiteNext = (nextTurn === 'w' || nextTurn === 'red' || nextTurn === 'sente');
    } else if (firstMove && firstMove.color) {
      const firstIsWhite = (firstMove.color === 'w' || firstMove.color === 'red' || firstMove.color === 'sente');
      const numMoves = previewMoves.length || 1;
      isWhiteNext = (numMoves % 2 === 1) ? !firstIsWhite : firstIsWhite;
    }

    const turnSymbol = isWhiteNext ? '⚪' : '⚫';
    const turnName = isWhiteNext ? 'White to Move' : 'Black to Move';

    // Build variation line display
    let variationHtml = '';
    if (previewMoves && previewMoves.length > 1) {
      const lineStr = previewMoves.map((m, idx) => `${idx + 1}.${m.san || (m.from + '➔' + m.to)}`).join(' ');
      variationHtml = `<div class="preview-variation-line"><small>Variation: <strong>${lineStr}</strong> &bull; <em>Next: ${turnSymbol} ${turnName}</em> &bull; <strong>(only 1st move commits)</strong></small></div>`;
    }

    const authorText = isMe
      ? `Staged: <strong>${firstMove.san || firstMove.displaySan || (firstMove.from + ' ➔ ' + firstMove.to)}</strong>`
      : `<strong>${stagedBy ? stagedBy.name : 'Teammate'}</strong> previewing: <strong>${firstMove.san || firstMove.displaySan || (firstMove.from + ' ➔ ' + firstMove.to)}</strong>`;

    this.containerEl.innerHTML = `
      <div class="confirm-content">
        <div class="confirm-title-group">
          <div class="preview-turn-badge ${isWhiteNext ? 'turn-white' : 'turn-black'}">
            <span class="preview-turn-icon">${turnSymbol}</span>
            <span class="preview-turn-text">${turnName}</span>
          </div>
          <span class="staged-pill">${authorText}</span>
          ${variationHtml}
        </div>
        <div class="confirm-actions">
          ${isMe ? `
            <button id="btnConfirmMoveAction" class="btn-confirm-action" title="Commit the first move to the live game">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
              Confirm Move
            </button>
          ` : ''}
          ${isMe && previewMoves.length > 1 ? `
            <button id="btnUndoStepAction" class="btn-cancel-action" title="Undo the latest preview move">
              ↩️ Step Back
            </button>
          ` : ''}
          <button id="btnCancelMoveAction" class="btn-cancel-action" title="Clear and revert preview">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
            ${isMe ? 'Cancel' : 'Reset'}
          </button>
        </div>
      </div>
    `;

    const confirmBtn = this.containerEl.querySelector('#btnConfirmMoveAction');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const move = this.stagedData.firstMove;
        this.clear();
        this.onConfirmMove(move);
      });
    }

    const undoBtn = this.containerEl.querySelector('#btnUndoStepAction');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        if (this.onUndoStep) this.onUndoStep();
      });
    }

    const cancelBtn = this.containerEl.querySelector('#btnCancelMoveAction');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.clear();
        this.onCancelMove();
      });
    }
  }
}
