/**
 * Room Playerlist Component
 * Renders connected participants in the room with Google Docs-style color tags,
 * online status, and communal turn eligibility badges.
 */

export class PlayerListRenderer {
  constructor(containerEl) {
    this.containerEl = containerEl;
  }

  render(presenceList, lastMover = null, currentTurn = null, myClientId = '') {
    if (!this.containerEl) return;

    this.containerEl.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'playerlist-wrapper';

    const header = document.createElement('div');
    header.className = 'playerlist-header';
    header.innerHTML = `
      <h4>Players in Room (${presenceList.length})</h4>
    `;
    wrapper.appendChild(header);

    const listEl = document.createElement('div');
    listEl.className = 'playerlist-items';

    if (presenceList.length === 0) {
      listEl.innerHTML = `<div class="playerlist-empty">Waiting for players to join...</div>`;
    } else {
      for (const p of presenceList) {
        const item = document.createElement('div');
        item.className = 'playerlist-row';
        if (p.clientId === myClientId) item.classList.add('is-me');

        const isLastMover = lastMover && (lastMover.clientId === p.clientId || (lastMover.name && lastMover.name.toLowerCase() === (p.playerName || '').toLowerCase()));

        let badgeText = 'Spectator';
        let badgeClass = 'badge-spectator';

        if (isLastMover) {
          badgeText = 'Waiting (Moved Last)';
          badgeClass = 'badge-waiting';
        } else {
          badgeText = 'Eligible to Move';
          badgeClass = 'badge-ready';
        }

        item.innerHTML = `
          <div class="player-info">
            <span class="player-dot" style="background-color: ${p.color || '#38bdf8'}"></span>
            <span class="player-name">${this.escapeHtml(p.playerName || 'Anonymous')} ${p.clientId === myClientId ? '<small>(You)</small>' : ''}</span>
          </div>
          <span class="player-badge ${badgeClass}">${badgeText}</span>
        `;

        listEl.appendChild(item);
      }
    }

    wrapper.appendChild(listEl);
    this.containerEl.appendChild(wrapper);
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
