# Tic-Tac-Toe — Play your way

A responsive single-player Tic-Tac-Toe game built with HTML, CSS and vanilla JavaScript.

## Run in VS Code
1. Extract the ZIP archive.
2. Open this folder in Visual Studio Code.
3. Open `index.html` in a browser, or install the Live Server extension and choose **Open with Live Server**.

No package installation or build process is needed. An internet connection is only needed to load the optional Google Fonts; the game itself works offline with fallback fonts.

## Features
- Play against the computer as X or O
- Three difficulty levels:
  - Easy: random legal moves
  - Medium: wins immediately when possible, blocks immediate threats, and prefers strategic squares
  - Hard: minimax search for optimal play
- Seven preset accent colours and a custom colour picker
- Scoreboard for player, computer and draws
- New round preserves the match score
- Reset score clears the match
- Responsive desktop and mobile layout
- Accessible button labels, focus indicators and reduced-motion support

## Project structure
- `index.html` — semantic page structure
- `style.css` — theme tokens, layout, responsive rules and visual states
- `script.js` — game state, AI logic, event handling and rendering

## Implementation notes
The board is a nine-element array. Every move is checked against the eight possible winning lines. The hard AI uses minimax to evaluate the remaining game tree. Difficulty and symbol selections are applied when the user presses **Apply settings**; the current match score is preserved.
