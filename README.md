# Intel Games
**Communal Multiplayer Board Games: Standard Chess, Chinese Chess (Xiangqi), Go (Weiqi), and Shogi**

*Inspired by the physical communal chess board in the Intel office where engineers made moves as they walked by.*

A modern communal board gaming platform deployed to **Firebase Hosting** (free domain & SSL) with **Firebase Realtime Database (RTDB)** for real-time multiplayer synchronization and an optional **Local Server Engine** (deep Stockfish analysis, authoritative refereeing).

---

## 🌟 Key Features

### 1. Four Grand Strategy Games
- **Standard Chess (8x8)**: International FIDE rules, pawn promotion, castling, en passant, checkmate, stalemate, and post-game Stockfish analysis.
- **Chinese Chess (Xiangqi / 象棋, 9x10)**: Authentic River ("楚河 漢界") and Imperial Palaces, calligraphic circular wooden tokens, cannon screen jump captures, horse leg blocks, elephant river boundaries, and flying general checks.
- **Go (Weiqi / 圍棋, 9x9 / 13x13 / 19x19)**: 3D stone physics, liberty tracking, multi-stone group captures, suicide move prevention, and Ko rule enforcement.
- **Japanese Chess (Shogi / 将棋, 9x9)**: Pentagonal wooden wedge tiles pointing in attack orientation, authentic kanji, in-hand piece stands (*Komadai* / 駒台) for dropping captured pieces onto the board, promotion zones (ranks 1–3), and **Nifu (二歩)** validation.

### 2. Universal Communal Turn Alternation
- Across all games, **no user may make two consecutive moves**.
- Players are tracked by both player name and persistent browser `clientId` (`localStorage`).
- If you make a move, your board locks with a status banner: *"You made the previous move — Waiting for another player to move"*. Another participant must make an intervening move before you can play again.

### 3. Google Docs-Style Collaborative Strategy
- Every connected user is assigned a unique pastel color (Cyan, Violet, Emerald, Amber, Rose, etc.).
- When any player hovers over or drags a piece, a floating **Google Docs-style name pill** (e.g. `[ Alice ▾ ]`) and glowing colored border appears above that piece in real-time on everyone else's screen.
- Players in the same room can visualize and test tactical sequences together.

### 4. "Confirm Move" Staging Action Bar
- Moving a piece stages the move locally with a confirmation bar: `[✓ Confirm Move: e4]` and `[✗ Cancel]`.
- Eliminates misclicks or mouse slips.
- **Atomic First-Confirmed Move**: The first eligible player to click "Confirm Move" commits the move; conflicting drafts automatically refresh to the new official turn.

### 5. Interactive Time-Travel Move History
- Chronological move sheet alongside the board.
- Click any past move or use step controls (`<<`, `<`, `>`, `>> Live`) to view the exact board state at that ply.
- A floating *"Viewing Move #X (Preview) — [Return to Live Board]"* banner lets players explore history at their own pace without interrupting live games.

### 6. Post-Game Stockfish Analysis
- Evaluates every move using Win Percentage Loss (WPL).
- Chess.com-style classifications:
  - 💎 **Brilliant**: Sacrificial or tactical masterpiece.
  - ⭐ **Best**: Top engine recommendation.
  - ✨ **Excellent**: Very strong choice (< 0.2 pawn shift).
  - 👍 **Good**: Natural, playable move.
  - ❓ **Inaccuracy**: Minor slip.
  - ⁉️ **Mistake**: Noticeable error.
  - 💥 **Blunder**: Critical oversight swinging the game.
  - ❌ **Miss**: Missed tactical win.
- Calculates CAPS-style accuracy ratings (0–100%) for both sides.

---

## 🚀 Quick Start & Local Execution

### 1. Run Automated Test Suite
```bash
npm test
```
Runs unit tests for the communal anti-consecutive move restriction, all four game engines (Chess, Xiangqi, Go, Shogi), and the Stockfish analyzer.

### 2. Run Local Web App
```bash
# Serve public/ folder on port 5000 (or open public/index.html in browser)
npm run serve
```
Visit `http://localhost:5000` to play!

### 3. Run Local Server Engine (Optional Daemon)
```bash
# In local-server/
npm start
```
Connects outbound to Firebase Realtime Database via `firebase-admin` to referee moves and run deep Stockfish analysis on your local CPU (requires no router port forwarding).

---

## 🌐 Deploying to Firebase Hosting

Firebase Hosting provides a **100% free global CDN domain with automated SSL** (`https://<your-project>.web.app`).

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```
2. Log in and initialize:
   ```bash
   firebase login
   firebase use --add <your-project-id>
   ```
3. Deploy:
   ```bash
   firebase deploy --only hosting,database
   ```

---

## 🤖 GitHub Actions CI/CD

Pre-configured workflows in `.github/workflows/`:
- **`test.yml`**: Runs automated tests on every push and pull request.
- **`deploy.yml`**: Automatically deploys the web client to Firebase Hosting whenever changes are pushed to `main`.
