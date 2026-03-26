# Connect4-Multiplayer-
Multiplayer connect 4 now able to have different servers play a game
Connect 4 Multiplayer Game


Requirements:
- Node.js installed (v14+ recommended)
- npm installed

Installation:
1. Open a terminal in the project folder.
2. Run the following commands:

   npm install express socket.io

Running the Server:
1. In the terminal, run:

   node server.js

2. Open a browser and go to:

   http://localhost:3000/

How to Play:
- Open the game in two different browser windows or devices.
- Enter your name on the start screen.
- The server will match two players automatically.
- When matched, both players are sent to the game screen.
- Players take turns placing pieces.
- The server checks for wins and updates both clients in real time.

Project Structure:
- server.js ........ Node.js + Express + Socket.io server
- public/
    startscreen.html
    game.html
    script.js
    style.css
    images/ (optional)
    sounds/ (optional)

Notes:
- The server uses Socket.io rooms to support multiple games at the same time.
- Game state is stored per-room so matches do not interfere with each other.
- Clients reconnecting will attempt to rejoin their previous room.
