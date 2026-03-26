const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

let waitingPlayer = null;

let games = {}; // { roomID: { board: [...], turn: 1, players: {1: socketId, 2: socketId} } }

// creates empty board
function createEmptyBoard() {
  return [
    ["", "", "", "", "", "", ""],
    ["", "", "", "", "", "", ""],
    ["", "", "", "", "", "", ""],
    ["", "", "", "", "", "", ""],
    ["", "", "", "", "", "", ""],
    ["", "", "", "", "", "", ""]
  ];
}

// checks for win
function countInDirection(board, row, col, rowDir, colDir, player) {
  let count = 0;
  let r = row;
  let c = col;

  while (
    r >= 0 && r < 6 &&
    c >= 0 && c < 7 &&
    board[r][c] === player
  ) {
    count++;
    r += rowDir;
    c += colDir;
  }

  return count;
}

function checkWin(board, row, col, player) {
  let horizontal =
    countInDirection(board, row, col, 0, -1, player) +
    countInDirection(board, row, col, 0, 1, player) - 1;

  let vertical =
    countInDirection(board, row, col, 1, 0, player) +
    countInDirection(board, row, col, -1, 0, player) - 1;

  let diag1 =
    countInDirection(board, row, col, 1, 1, player) +
    countInDirection(board, row, col, -1, -1, player) - 1;

  let diag2 =
    countInDirection(board, row, col, 1, -1, player) +
    countInDirection(board, row, col, -1, 1, player) - 1;

  return (
    horizontal >= 4 ||
    vertical >= 4 ||
    diag1 >= 4 ||
    diag2 >= 4
  );
}

io.on("connection", (socket) => {
  console.log("A player connected:", socket.id);

  // player join the lobby
  socket.on("joinLobby", (name) => {
    socket.playerName = name;

    if (!waitingPlayer) {
      waitingPlayer = socket;
      socket.emit("waitingForOpponent");
      return;
    }

    // makes matches
    const roomID = waitingPlayer.id + "_" + socket.id;

    waitingPlayer.join(roomID);
    socket.join(roomID);

    // create room record and track which socket is player 1/2
    games[roomID] = {
      board: createEmptyBoard(),
      turn: 1,
      players: {
        1: waitingPlayer.id,
        2: socket.id
      }
    };

    io.to(roomID).emit("matchFound", {
      roomID,
      players: [
        { id: waitingPlayer.id, name: waitingPlayer.playerName, number: 1 },
        { id: socket.id, name: socket.playerName, number: 2 }
      ]
    });

    waitingPlayer = null;
  });

  // allow a user that navigated to game.html to rejoin the room
  socket.on("rejoinRoom", ({ roomID, playerNumber, name }) => {
    if (!roomID) return;
    socket.join(roomID);

    // ensure the game record exists
    if (!games[roomID]) {
      games[roomID] = {
        board: createEmptyBoard(),
        turn: 1,
        players: {}
      };
    }

    // map this player number to the current socket id
    games[roomID].players = games[roomID].players || {};
    games[roomID].players[playerNumber] = socket.id;

    // send the authoritative board and turn to the rejoined client
    socket.emit("syncState", {
      board: games[roomID].board,
      turn: games[roomID].turn
    });

    console.log(`Socket ${socket.id} rejoined room ${roomID} as player ${playerNumber}`);
  });

  // checks player movement
  socket.on("playerMove", (data) => {
    const game = games[data.roomID];
    if (!game) return;

    // checks turn
    if (data.playerNumber !== game.turn) {
      console.log("Not your turn!");
      return;
    }

    // updates board
    game.board[data.row][data.col] = data.player;

    // moves to room
    io.to(data.roomID).emit("playerMove", data);

    // checks for win
    if (checkWin(game.board, data.row, data.col, data.player)) {
      io.to(data.roomID).emit("gameOver", {
        winner: data.player === "R" ? "Red" : "Yellow"
      });
      return;
    }

    // Switch turn
    game.turn = game.turn === 1 ? 2 : 1;

    io.to(data.roomID).emit("turnUpdate", game.turn);
  });



socket.on("disconnect", () => {
  console.log("A player disconnected:", socket.id);

  for (const roomID in games) {
    const g = games[roomID];
    if (!g.players) continue;

    let playerNum = null;
    if (g.players[1] === socket.id) playerNum = 1;
    if (g.players[2] === socket.id) playerNum = 2;

    if (playerNum) {
      // mark player as disconnected but keep game state for a short window
      g.players[playerNum] = null;

      // notify the other player (if connected) to return to start screen
      const otherNum = playerNum === 1 ? 2 : 1;
      const otherSocketId = g.players[otherNum];
      if (otherSocketId) {
        io.to(otherSocketId).emit("returnToStart", {
          reason: "opponentDisconnected",
          roomID
        });
      } else {
        // if no other player connected, nothing to notify
      }

      // schedule cleanup if the other player doesn't reconnect within 60s
      g._cleanupTimeout = setTimeout(() => {
        console.log(`Cleaning up room ${roomID} due to inactivity.`);
        delete games[roomID];
      }, 60000);

      console.log(`Marked player ${playerNum} disconnected in room ${roomID}.`);
    }
  }
});

  socket.on("resetGameRequest", (roomID) => {
    const game = games[roomID];
    if (!game) return;

    // reset board
    game.board = createEmptyBoard();
    game.turn = 1;

    io.to(roomID).emit("resetGame");
  });
});

// starts server
const PORT = 3000;
http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});