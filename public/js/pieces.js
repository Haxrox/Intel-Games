/**
 * SVG Piece Definitions and Visual Assets
 * Complete, high-DPI Staunton scalable vector graphics for Chess, Xiangqi, Shogi, and Go.
 */

export const ChessPieces = {
  // White Pieces
  wK: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" class="chess-piece">
    <g fill="none" fill-rule="evenodd" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22.5 11.63V6M20 8h5" stroke-linejoin="miter"/>
      <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#fff" stroke-linecap="butt"/>
      <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-1-6 2-6 2s-3-2-9-2-9 2-9 2-2-3-6-2c-3 6 6 10.5 6 10.5v7z" fill="#fff"/>
      <path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/>
      <circle cx="22.5" cy="20" r="1.5" fill="#1c1917"/>
    </g>
  </svg>`,

  wQ: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" class="chess-piece">
    <g fill="#fff" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 22l-3.5-14-5 14-5-14-3.5 14-7.5-8.5L9 26z"/>
      <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 2-1 .5-2.5 0 0 0-1.5-1.5-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" stroke-linecap="butt"/>
      <path d="M11 38.5c6.5 2 16.5 2 23 0m-23 3c6.5 2 16.5 2 23 0"/>
      <circle cx="6" cy="12" r="2" fill="#fff"/>
      <circle cx="14" cy="9" r="2" fill="#fff"/>
      <circle cx="22.5" cy="8" r="2" fill="#fff"/>
      <circle cx="31" cy="9" r="2" fill="#fff"/>
      <circle cx="39" cy="12" r="2" fill="#fff"/>
    </g>
  </svg>`,

  wR: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" class="chess-piece">
    <g fill="#fff" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 39h27v-3H9v3zm3.5-7l1.5-17.5h17l1.5 17.5h-20zm-2.5-17.5h25v-6h-4.5v3h-5v-3h-6v3h-5v-3H10v6z" stroke-linecap="butt"/>
      <path d="M12 36v-4h21v4H12z"/>
      <path d="M14 29.5v-13h17v13H14z" stroke-width="1" stroke-linejoin="miter"/>
      <path d="M14 16.5L12.5 9h20L31 16.5H14z"/>
      <path d="M11 14h23"/>
    </g>
  </svg>`,

  wB: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" class="chess-piece">
    <g fill="none" fill-rule="evenodd" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <g fill="#fff">
        <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2z"/>
        <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/>
        <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/>
      </g>
      <path d="M17.5 26h10M22.5 21v10" stroke="#1c1917"/>
      <path d="M22.5 15.5c2 2.5 4 3 4 3" stroke="#1c1917"/>
    </g>
  </svg>`,

  wN: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" class="chess-piece">
    <g fill="none" fill-rule="evenodd" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" fill="#fff"/>
      <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,7.4 17.03,6.5 18,10 C 19.5,8.5 24.5,7 24,18 z" fill="#fff"/>
      <circle cx="10.5" cy="20.5" r="1.2" fill="#1c1917"/>
      <circle cx="15.5" cy="18.5" r="0.8" fill="#1c1917"/>
      <path d="M 24.5,10.5 C 26,11.5 28.5,14 27.5,17 C 26.5,20 28,21.5 27,24" stroke="#1c1917"/>
      <path d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5 25.5 A 0.5 0.5 0 1 1 9.5 25.5 z" fill="#1c1917"/>
    </g>
  </svg>`,

  wP: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" class="chess-piece">
    <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#fff" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // Black Pieces
  bK: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" class="chess-piece">
    <g fill="none" fill-rule="evenodd" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22.5 11.63V6M20 8h5" stroke-linejoin="miter"/>
      <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#262626" stroke-linecap="butt"/>
      <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-1-6 2-6 2s-3-2-9-2-9 2-9 2-2-3-6-2c-3 6 6 10.5 6 10.5v7z" fill="#262626"/>
      <path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0" stroke="#fff"/>
      <circle cx="22.5" cy="20" r="1.5" fill="#fff"/>
    </g>
  </svg>`,

  bQ: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" class="chess-piece">
    <g fill="#262626" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 22l-3.5-14-5 14-5-14-3.5 14-7.5-8.5L9 26z"/>
      <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 2-1 .5-2.5 0 0 0-1.5-1.5-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" stroke-linecap="butt"/>
      <path d="M11 38.5c6.5 2 16.5 2 23 0m-23 3c6.5 2 16.5 2 23 0" stroke="#fff"/>
      <circle cx="6" cy="12" r="2" fill="#262626"/>
      <circle cx="14" cy="9" r="2" fill="#262626"/>
      <circle cx="22.5" cy="8" r="2" fill="#262626"/>
      <circle cx="31" cy="9" r="2" fill="#262626"/>
      <circle cx="39" cy="12" r="2" fill="#262626"/>
    </g>
  </svg>`,

  bR: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" class="chess-piece">
    <g fill="#262626" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 39h27v-3H9v3zm3.5-7l1.5-17.5h17l1.5 17.5h-20zm-2.5-17.5h25v-6h-4.5v3h-5v-3h-6v3h-5v-3H10v6z" stroke-linecap="butt"/>
      <path d="M12 36v-4h21v4H12z"/>
      <path d="M14 29.5v-13h17v13H14z" stroke="#fff" stroke-width="1" stroke-linejoin="miter"/>
      <path d="M14 16.5L12.5 9h20L31 16.5H14z"/>
      <path d="M11 14h23" stroke="#fff"/>
    </g>
  </svg>`,

  bB: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" class="chess-piece">
    <g fill="none" fill-rule="evenodd" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <g fill="#262626">
        <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2z"/>
        <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/>
        <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/>
      </g>
      <path d="M17.5 26h10M22.5 21v10" stroke="#fff"/>
      <path d="M22.5 15.5c2 2.5 4 3 4 3" stroke="#fff"/>
    </g>
  </svg>`,

  bN: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" class="chess-piece">
    <g fill="none" fill-rule="evenodd" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" fill="#262626"/>
      <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,7.4 17.03,6.5 18,10 C 19.5,8.5 24.5,7 24,18 z" fill="#262626"/>
      <circle cx="10.5" cy="20.5" r="1.2" fill="#fff"/>
      <circle cx="15.5" cy="18.5" r="0.8" fill="#fff"/>
      <path d="M 24.5,10.5 C 26,11.5 28.5,14 27.5,17 C 26.5,20 28,21.5 27,24" stroke="#fff"/>
      <path d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5 25.5 A 0.5 0.5 0 1 1 9.5 25.5 z" fill="#fff"/>
    </g>
  </svg>`,

  bP: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" class="chess-piece">
    <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#262626" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
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
