/**
 * Universal Real-Time Database Client
 * Synchronizes communal game states, moves, presence hovers, and playerlists across:
 * 1. Local WebSocket Hub (http://localhost:5000) across different browsers and devices
 * 2. Firebase Realtime Database (when deployed to Firebase Hosting)
 * 3. LocalStorage cross-tab fallback
 */

export const firebaseConfig = {
  apiKey: "AIzaSyAqYoJhcCsgGAYxN32HFOdnFRT41ynkuHk",
  authDomain: "intel-games.firebaseapp.com",
  databaseURL: "https://intel-games-default-rtdb.firebaseio.com",
  projectId: "intel-games",
  storageBucket: "intel-games.firebasestorage.app",
  messagingSenderId: "368165551995",
  appId: "1:368165551995:web:401117136a5a6c772e07de",
  measurementId: "G-WLYBBWXKEF"
};


class RealtimeSyncClient {
  constructor() {
    this.storage = {};
    this.listeners = {};
    this.ws = null;
    this.connected = false;
    this.initWebSocket();
    this.initLocalStorageSync();
  }

  initWebSocket() {
    if (typeof window === 'undefined' || !window.location) return;

    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        // Subscribe to currently registered paths
        Object.keys(this.listeners).forEach(path => {
          const match = path.match(/^rooms\/([^\/]+)/);
          if (match) {
            this.ws.send(JSON.stringify({
              type: 'subscribe',
              roomId: match[1],
              clientId: (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('communal_client_id')) ||
                        (typeof localStorage !== 'undefined' && localStorage.getItem('communal_client_id')) || 'anon'
            }));
          }
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'state_update') {
            const statePath = `rooms/${msg.roomId}/state`;
            this.storage[statePath] = msg.state;
            this.emit(statePath, msg.state);
          } else if (msg.type === 'preview_update') {
            const previewPath = `rooms/${msg.roomId}/preview`;
            this.storage[previewPath] = msg.preview;
            this.emit(previewPath, msg.preview);
          } else if (msg.type === 'planning_update') {
            const planningPath = `rooms/${msg.roomId}/planning`;
            this.storage[planningPath] = msg.planning;
            this.emit(planningPath, msg.planning);
          } else if (msg.type === 'presence_update') {
            const presencePath = `rooms/${msg.roomId}/presence`;
            const presMap = {};
            (msg.presences || []).forEach(p => {
              if (p && p.clientId) presMap[p.clientId] = p;
            });
            this.storage[presencePath] = presMap;
            this.emit(presencePath, presMap);
          } else if (msg.type === 'archives_update') {
            const archPath = `rooms/${msg.roomId}/archives`;
            const archMap = {};
            (msg.archives || []).forEach(a => {
              if (a && a.id) archMap[a.id] = a;
            });
            this.storage[archPath] = archMap;
            this.emit(archPath, archMap);
            this.storage['game_history'] = archMap;
            this.emit('game_history', archMap);
          }
        } catch (e) {}
      };

      this.ws.onclose = () => {
        this.connected = false;
        // Attempt reconnect after 2 seconds
        setTimeout(() => this.initWebSocket(), 2000);
      };
    } catch (e) {
      // WebSocket not available in this environment
    }
  }

  initLocalStorageSync() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('communal_rtdb:')) {
          const path = e.key.replace('communal_rtdb:', '');
          try {
            const data = JSON.parse(e.newValue);
            this.storage[path] = data;
            this.emit(path, data);
          } catch (err) {}
        }
      });
    }
  }

  emit(path, data) {
    if (this.listeners[path]) {
      this.listeners[path].forEach(cb => cb({ val: () => data }));
    }
  }

  ref(path) {
    const cleanPath = path.replace(/^\/|\/$/g, '');
    const self = this;

    return {
      set: (val) => {
        self.storage[cleanPath] = val;

        // Sync via WebSocket if available
        if (self.ws && self.ws.readyState === WebSocket.OPEN) {
          const matchState = cleanPath.match(/^rooms\/([^\/]+)\/state$/);
          const matchPresence = cleanPath.match(/^rooms\/([^\/]+)\/presence\/([^\/]+)$/);
          const matchPreview = cleanPath.match(/^rooms\/([^\/]+)\/preview$/);
          const matchPlanning = cleanPath.match(/^rooms\/([^\/]+)\/planning$/);

          if (matchState) {
            self.ws.send(JSON.stringify({
              type: 'set_state',
              roomId: matchState[1],
              data: val
            }));
          } else if (matchPresence) {
            self.ws.send(JSON.stringify({
              type: 'presence_broadcast',
              roomId: matchPresence[1],
              clientId: matchPresence[2],
              data: val
            }));
          } else if (matchPreview) {
            const myCId = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('communal_client_id')) ||
                          (typeof localStorage !== 'undefined' && localStorage.getItem('communal_client_id')) || 'anon';
            self.ws.send(JSON.stringify({
              type: 'set_preview',
              roomId: matchPreview[1],
              clientId: myCId,
              data: val
            }));
          } else if (matchPlanning) {
            const myCId = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('communal_client_id')) ||
                          (typeof localStorage !== 'undefined' && localStorage.getItem('communal_client_id')) || 'anon';
            self.ws.send(JSON.stringify({
              type: 'set_planning',
              roomId: matchPlanning[1],
              clientId: myCId,
              data: val
            }));
          } else if (cleanPath.startsWith('rooms/') && cleanPath.includes('/archives')) {
            const matchArch = cleanPath.match(/^rooms\/([^\/]+)\/archives/);
            if (matchArch) {
              self.ws.send(JSON.stringify({
                type: 'save_archive',
                roomId: matchArch[1],
                data: val
              }));
            }
          }
        }

        // LocalStorage fallback
        if (typeof window !== 'undefined') {
          localStorage.setItem(`communal_rtdb:${cleanPath}`, JSON.stringify(val));
        }

        self.emit(cleanPath, val);
        return Promise.resolve();
      },

      get: () => {
        const val = self.storage[cleanPath] !== undefined ? self.storage[cleanPath] : null;
        return Promise.resolve({ val: () => val });
      },

      on: (event, cb) => {
        if (!self.listeners[cleanPath]) self.listeners[cleanPath] = [];
        self.listeners[cleanPath].push(cb);

        // Subscribe via WebSocket if available
        if (self.ws && self.ws.readyState === WebSocket.OPEN) {
          const match = cleanPath.match(/^rooms\/([^\/]+)/);
          if (match) {
            self.ws.send(JSON.stringify({
              type: 'subscribe',
              roomId: match[1],
              clientId: localStorage.getItem('communal_client_id') || 'anon'
            }));
          }
        }

        let currentVal = self.storage[cleanPath];
        if (currentVal === undefined && typeof window !== 'undefined') {
          const stored = localStorage.getItem(`communal_rtdb:${cleanPath}`);
          if (stored) {
            try { currentVal = JSON.parse(stored); self.storage[cleanPath] = currentVal; } catch (e) {}
          }
        }
        cb({ val: () => currentVal || null });
      },

      off: (event, cb) => {
        if (!self.listeners[cleanPath]) return;
        if (!cb) {
          self.listeners[cleanPath] = [];
        } else {
          self.listeners[cleanPath] = self.listeners[cleanPath].filter(fn => fn !== cb);
        }
      },

      onDisconnect: () => ({
        remove: () => Promise.resolve()
      }),

      transaction: (updateFn, onComplete) => {
        const currentVal = self.storage[cleanPath] || null;
        const newVal = updateFn(currentVal);
        if (newVal === undefined) {
          if (onComplete) onComplete(null, false, { val: () => currentVal });
          return Promise.resolve({ committed: false, snapshot: { val: () => currentVal } });
        }

        self.storage[cleanPath] = newVal;

        // Broadcast to WebSocket
        if (self.ws && self.ws.readyState === WebSocket.OPEN) {
          const matchState = cleanPath.match(/^rooms\/([^\/]+)\/state$/);
          if (matchState) {
            self.ws.send(JSON.stringify({
              type: 'set_state',
              roomId: matchState[1],
              data: newVal
            }));
          }
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem(`communal_rtdb:${cleanPath}`, JSON.stringify(newVal));
        }

        self.emit(cleanPath, newVal);
        if (onComplete) onComplete(null, true, { val: () => newVal });
        return Promise.resolve({ committed: true, snapshot: { val: () => newVal } });
      }
    };
  }
}

export function initFirebase() {
  const isRealFirebase = typeof window !== 'undefined' &&
    window.firebase &&
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.includes('Dummy');

  if (isRealFirebase) {
    try {
      if (!window.firebase.apps || window.firebase.apps.length === 0) {
        window.firebase.initializeApp(firebaseConfig);
      }
      return window.firebase.database();
    } catch (e) {
      console.warn("Using RealtimeSyncClient fallback:", e.message);
    }
  }

  // Uses WebSocket when running locally, with cross-browser and cross-device sync!
  return new RealtimeSyncClient();
}
