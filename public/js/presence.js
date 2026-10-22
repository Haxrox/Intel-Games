/**
 * Presence and Google Docs-style Collaborative Pointer & Hover Tracker
 * Generates unique player colors and synchronizes active cursor/square hovers.
 */

const PALETTE = [
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink / Rose
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#f97316'  // Orange
];

export class PresenceManager {
  constructor(roomId, playerInfo, firebaseDb = null) {
    this.roomId = roomId;
    this.playerInfo = playerInfo; // { clientId, name, color }
    this.firebaseDb = firebaseDb;
    this.playerInfo.color = this.assignColor(playerInfo.name || playerInfo.clientId);
    this.hoverSquare = null;
    this.activePresenceList = [];
    this.listeners = [];
  }

  assignColor(str = '') {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % PALETTE.length;
    return PALETTE[idx];
  }

  setHoverSquare(sq) {
    if (this.hoverSquare === sq) return;
    this.hoverSquare = sq;
    this.broadcastPresence();
  }

  clearHoverSquare() {
    if (!this.hoverSquare) return;
    this.hoverSquare = null;
    this.broadcastPresence();
  }

  broadcastPresence() {
    if (this.firebaseDb && this.roomId) {
      const ref = this.firebaseDb.ref(`rooms/${this.roomId}/presence/${this.playerInfo.clientId}`);
      ref.set({
        clientId: this.playerInfo.clientId,
        playerName: this.playerInfo.name,
        color: this.playerInfo.color,
        hoverSquare: this.hoverSquare,
        lastSeen: Date.now()
      });
      ref.onDisconnect().remove();
    } else {
      // Local development fallback
      this.activePresenceList = [{
        clientId: this.playerInfo.clientId,
        playerName: this.playerInfo.name,
        color: this.playerInfo.color,
        hoverSquare: this.hoverSquare,
        lastSeen: Date.now()
      }];
      this.notifyListeners();
    }
  }

  subscribePresence(callback) {
    this.listeners.push(callback);

    if (this.firebaseDb && this.roomId) {
      const ref = this.firebaseDb.ref(`rooms/${this.roomId}/presence`);
      ref.on('value', (snap) => {
        const val = snap.val() || {};
        this.activePresenceList = Object.values(val);
        this.notifyListeners();
      });
    } else {
      this.broadcastPresence();
    }
  }

  notifyListeners() {
    for (const cb of this.listeners) {
      cb(this.activePresenceList);
    }
  }

  getPresenceList() {
    return this.activePresenceList;
  }
}
