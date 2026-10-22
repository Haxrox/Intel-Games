/**
 * SVG Piece Definitions and Visual Assets
 * High-DPI scalable vector graphics for Chess, Xiangqi, Shogi, and Go.
 */

export const ChessPieces = {
  wK: `<svg viewBox="0 0 45 45" class="chess-piece"><g fill="#fff" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6M20 8h5M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path d="M11.5 37c5.5 3.5 16.5 3.5 22 0 1-5.5-3-11.5-3-11.5-6 3.5-10 3.5-16 0 0 0-4 6-3 11.5z"/><path d="M12 37.5c4 2.5 17 2.5 21 0"/><path d="M11.5 39.5c5.5 3.5 16.5 3.5 22 0"/><path d="M11.5 41.5c5.5 3.5 16.5 3.5 22 0"/></g></svg>`,
  wQ: `<svg viewBox="0 0 45 45" class="chess-piece"><g fill="#fff" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm16.5-4.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-26 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm19 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/><path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11-6-15-5.5 15-7-11 2 12zm0 0c0 4 7 8 13.5 8s13.5-4 13.5-8"/><path d="M11 38.5c5.5 3 17.5 3 23 0"/><path d="M11 41.5c5.5 3 17.5 3 23 0"/></g></svg>`,
  wR: `<svg viewBox="0 0 45 45" class="chess-piece"><g fill="#fff" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zm3-3v-4.5h21V36H12zm2-4.5l1.5-12.5h14l1.5 12.5H14zm-3-15.5l2 3h19l2-3v-5h-5v3h-4.5v-3h-4v3H16v-3h-5v5z"/></g></svg>`,
  wB: `<svg viewBox="0 0 45 45" class="chess-piece"><g fill="#fff" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/><path d="M17.5 26h10M22.5 21v10" stroke="#1c1917"/></g></svg>`,
  wN: `<svg viewBox="0 0 45 45" class="chess-piece"><g fill="#fff" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0-.06 1.42-1 1-1.36-.61-1.92-2.22-1-3 1.5-.7 4.1-.7 6-2 1.5-1 2.5-4 2-5.5-1-1.5-4.5-2.5-4.5-2.5s6.5-2 11.5 2z"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z"/></g></svg>`,
  wP: `<svg viewBox="0 0 45 45" class="chess-piece"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#fff" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round"/></svg>`,

  bK: `<svg viewBox="0 0 45 45" class="chess-piece"><g fill="#1e293b" stroke="#f8fafc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6M20 8h5M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path d="M11.5 37c5.5 3.5 16.5 3.5 22 0 1-5.5-3-11.5-3-11.5-6 3.5-10 3.5-16 0 0 0-4 6-3 11.5z"/><path d="M12 37.5c4 2.5 17 2.5 21 0"/><path d="M11.5 39.5c5.5 3.5 16.5 3.5 22 0"/><path d="M11.5 41.5c5.5 3.5 16.5 3.5 22 0"/></g></svg>`,
  bQ: `<svg viewBox="0 0 45 45" class="chess-piece"><g fill="#1e293b" stroke="#f8fafc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm16.5-4.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-26 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm19 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/><path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11-6-15-5.5 15-7-11 2 12zm0 0c0 4 7 8 13.5 8s13.5-4 13.5-8"/><path d="M11 38.5c5.5 3 17.5 3 23 0"/><path d="M11 41.5c5.5 3 17.5 3 23 0"/></g></svg>`,
  bR: `<svg viewBox="0 0 45 45" class="chess-piece"><g fill="#1e293b" stroke="#f8fafc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zm3-3v-4.5h21V36H12zm2-4.5l1.5-12.5h14l1.5 12.5H14zm-3-15.5l2 3h19l2-3v-5h-5v3h-4.5v-3h-4v3H16v-3h-5v5z"/></g></svg>`,
  bB: `<svg viewBox="0 0 45 45" class="chess-piece"><g fill="#1e293b" stroke="#f8fafc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/><path d="M17.5 26h10M22.5 21v10" stroke="#f8fafc"/></g></svg>`,
  bN: `<svg viewBox="0 0 45 45" class="chess-piece"><g fill="#1e293b" stroke="#f8fafc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0-.06 1.42-1 1-1.36-.61-1.92-2.22-1-3 1.5-.7 4.1-.7 6-2 1.5-1 2.5-4 2-5.5-1-1.5-4.5-2.5-4.5-2.5s6.5-2 11.5 2z"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z"/></g></svg>`,
  bP: `<svg viewBox="0 0 45 45" class="chess-piece"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#1e293b" stroke="#f8fafc" stroke-width="1.5" stroke-linecap="round"/></svg>`
};

export const XiangqiTokens = {
  // Red pieces
  K: { char: '帥', color: '#dc2626', name: 'General' },
  A: { char: '仕', color: '#dc2626', name: 'Advisor' },
  E: { char: '相', color: '#dc2626', name: 'Elephant' },
  H: { char: '傌', color: '#dc2626', name: 'Horse' },
  R: { char: '俥', color: '#dc2626', name: 'Chariot' },
  C: { char: '炮', color: '#dc2626', name: 'Cannon' },
  S: { char: '兵', color: '#dc2626', name: 'Soldier' },

  // Black pieces
  k: { char: '將', color: '#1e293b', name: 'General' },
  a: { char: '士', color: '#1e293b', name: 'Advisor' },
  e: { char: '象', color: '#1e293b', name: 'Elephant' },
  h: { char: '馬', color: '#1e293b', name: 'Horse' },
  r: { char: '車', color: '#1e293b', name: 'Chariot' },
  c: { char: '砲', color: '#1e293b', name: 'Cannon' },
  s: { char: '卒', color: '#1e293b', name: 'Soldier' }
};

export const ShogiKanji = {
  K: { char: '玉', name: 'King' },
  R: { char: '飛', name: 'Rook' },
  '+R': { char: '竜', name: 'Dragon', promoted: true },
  B: { char: '角', name: 'Bishop' },
  '+B': { char: '馬', name: 'Horse', promoted: true },
  G: { char: '金', name: 'Gold' },
  S: { char: '銀', name: 'Silver' },
  '+S': { char: '全', name: 'Promoted Silver', promoted: true },
  N: { char: '桂', name: 'Knight' },
  '+N': { char: '圭', name: 'Promoted Knight', promoted: true },
  L: { char: '香', name: 'Lance' },
  '+L': { char: '杏', name: 'Promoted Lance', promoted: true },
  P: { char: '歩', name: 'Pawn' },
  '+P': { char: 'と', name: 'Tokin', promoted: true }
};
