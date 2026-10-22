/**
 * Local Real-Time Server for Intel Games
 * Serves static web assets from public/ and provides a real-time WebSocket hub
 * ensuring 100% synchronized multiplayer state across different browsers,
 * incognito tabs, and local network devices.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 5000;

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

// HTTP Static File Server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, reqPath);

  // Security: prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback for SPA routing to index.html
      const fallback = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(fallback, (fErr, content) => {
        if (fErr) {
          res.writeHead(404);
          res.end('Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Internal Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
});

// Real-Time WebSocket Hub
const wss = new WebSocketServer({ server });

// In-memory shared state for communal rooms
const roomStates = new Map();
const roomPresences = new Map(); // roomId -> Map(clientId -> presence)
const roomPreviews = new Map(); // roomId -> preview state (staged move variations)
const roomArchives = new Map(); // roomId -> Map(gameId -> archive record)

wss.on('connection', (ws) => {
  let subscribedRoom = null;
  let clientIdentifier = null;

  ws.on('message', (messageStr) => {
    try {
      const msg = JSON.parse(messageStr);
      const { type, roomId, clientId, data } = msg;

      if (type === 'subscribe') {
        subscribedRoom = roomId;
        clientIdentifier = clientId;

        // Send current room state if exists
        if (roomStates.has(roomId)) {
          ws.send(JSON.stringify({
            type: 'state_update',
            roomId,
            state: roomStates.get(roomId)
          }));
        }

        // Send current preview state if exists
        if (roomPreviews.has(roomId)) {
          ws.send(JSON.stringify({
            type: 'preview_update',
            roomId,
            preview: roomPreviews.get(roomId)
          }));
        }

        // Send current presence list
        if (roomPresences.has(roomId)) {
          const presences = Array.from(roomPresences.get(roomId).values());
          ws.send(JSON.stringify({
            type: 'presence_update',
            roomId,
            presences
          }));
        }

        // Send room archives list
        if (roomArchives.has(roomId)) {
          const archives = Array.from(roomArchives.get(roomId).values());
          ws.send(JSON.stringify({
            type: 'archives_update',
            roomId,
            archives
          }));
        }
      }

      else if (type === 'save_archive') {
        if (!roomArchives.has(roomId)) {
          roomArchives.set(roomId, new Map());
        }
        if (data && data.id) {
          roomArchives.get(roomId).set(data.id, data);
        }
        const archives = Array.from(roomArchives.get(roomId).values());
        broadcastToRoom(roomId, {
          type: 'archives_update',
          roomId,
          archives
        });
      }

      else if (type === 'set_state') {
        roomStates.set(roomId, data);
        // Automatically clear any active move preview once a live move commits
        roomPreviews.delete(roomId);
        broadcastToRoom(roomId, {
          type: 'preview_update',
          roomId,
          preview: null
        });

        // Broadcast state to all connected clients in this room
        broadcastToRoom(roomId, {
          type: 'state_update',
          roomId,
          state: data
        });
      }

      else if (type === 'set_preview') {
        if (data === null || data === undefined) {
          roomPreviews.delete(roomId);
        } else {
          roomPreviews.set(roomId, data);
        }
        broadcastToRoom(roomId, {
          type: 'preview_update',
          roomId,
          preview: data
        });
      }

      else if (type === 'presence_broadcast') {
        if (!roomPresences.has(roomId)) {
          roomPresences.set(roomId, new Map());
        }
        roomPresences.get(roomId).set(clientId, data);

        const presences = Array.from(roomPresences.get(roomId).values());
        broadcastToRoom(roomId, {
          type: 'presence_update',
          roomId,
          presences
        });
      }
    } catch (err) {
      console.error('[WebSocket] Message parse error:', err.message);
    }
  });

  ws.on('close', () => {
    if (subscribedRoom && clientIdentifier && roomPresences.has(subscribedRoom)) {
      const roomMap = roomPresences.get(subscribedRoom);
      roomMap.delete(clientIdentifier);
      const presences = Array.from(roomMap.values());
      broadcastToRoom(subscribedRoom, {
        type: 'presence_update',
        roomId: subscribedRoom,
        presences
      });
    }
  });
});

function broadcastToRoom(roomId, payload) {
  const jsonStr = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonStr);
    }
  });
}

server.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 Intel Games server running on http://localhost:${PORT}`);
  console.log(`⚡ Real-Time WebSocket sync active on ws://localhost:${PORT}`);
  console.log('====================================================');
});
