

// connect socket
const socket = io();

// read values from sessionStorage
const roomID = sessionStorage.getItem("roomID");
const myPlayerNumber = parseInt(sessionStorage.getItem("playerNumber"), 10);

console.log("Loaded game.html — roomID:", roomID, "playerNumber(session):", sessionStorage.getItem("playerNumber"));
console.log("Parsed myPlayerNumber:", myPlayerNumber);

const dropSound = new Audio("sounds/coinsound.mp3");
const win = new Audio("sounds/win.mp3");
const background = new Audio("sounds/background.mp3");
background.loop = true;

let currentPlayer; // server will assign who's player 1
let gameEnded = false;


let gameState = [
  ["", "", "", "", "", "", ""],
  ["", "", "", "", "", "", ""],
  ["", "", "", "", "", "", ""],
  ["", "", "", "", "", "", ""],
  ["", "", "", "", "", "", ""],
  ["", "", "", "", "", "", ""]
];

// finds the lowest empty row in a column
function findLowestEmptyRow(col) {
  for (let row = 5; row >= 0; row--) {
    if (gameState[row][col] === "") {
      return row;
    }
  }
  return null;
}

// when this new socket connects, tell the server to rejoin the room as this player
socket.on("connect", () => {
  console.log("socket connected (game):", socket.id, "emitting rejoinRoom for", roomID, myPlayerNumber);

  socket.emit("rejoinRoom", {
    roomID,
    playerNumber: myPlayerNumber,
    name: sessionStorage.getItem("playerName")
  });

  // retry once if syncState doesn't arrive quickly
  const t = setTimeout(() => {
    console.warn("No syncState received yet; re-emitting rejoinRoom");
    socket.emit("rejoinRoom", {
      roomID,
      playerNumber: myPlayerNumber,
      name: sessionStorage.getItem("playerName")
    });
  }, 1000);

  socket.once("syncState", () => clearTimeout(t));
});

socket.on("helloFromServer", (msg) => {
  console.log("Server says:", msg);
});

// server will send the authoritative board and turn after rejoin
socket.on("syncState", (data) => {
  console.log("syncState received:", data);
  if (data && data.board) {
    gameState = data.board;
  }
  currentPlayer = data && data.turn === 1 ? "Player 1" : "Player 2";

  // update visuals to match gameState 
  document.querySelectorAll(".cell").forEach(cell => {
    const r = parseInt(cell.dataset.row, 10);
    const c = parseInt(cell.dataset.col, 10);
    cell.classList.remove("red", "yellow", "drop");
    if (gameState[r][c] === "R") cell.classList.add("red");
    if (gameState[r][c] === "Y") cell.classList.add("yellow");
  });

  console.log("Synced board and turn from server:", currentPlayer);

  socket.on("returnToStart", (data) => {
  console.log("Server requested return to start:", data);

  // clear per-tab game identity so the start screen is clean
  sessionStorage.removeItem("roomID");
  sessionStorage.removeItem("playerNumber");
  sessionStorage.removeItem("opponentName");

  // optional: show a brief message before redirecting

  window.location.href = "startscreen.html";
});
});

// initialize currentPlayer from session storage fallback (will be overwritten by syncState)
currentPlayer = myPlayerNumber === 1 ? "Player 1" : "Player 2";

// updates the turn
socket.on("turnUpdate", (num) => {
  currentPlayer = num == 1 ? "Player 1" : "Player 2";
  console.log("It is now:", currentPlayer, "'s turn");
});

// player movement received from server
socket.on("playerMove", (data) => {
  console.log("Received move from another player:", data);

  const { row, col, player } = data;

  // update internal game state
  gameState[row][col] = player;

  // updates the board visually
  const targetCell = document.querySelector(
    `.cell[data-row='${row}'][data-col='${col}']`
  );
  if (targetCell) {
    targetCell.classList.add(player == "R" ? "red" : "yellow");
    targetCell.classList.add("drop");
  }
});

// when a game is complete
socket.on("gameOver", (data) => {
  win.play();

  setTimeout(() => {
    const winBox = document.getElementById("winBox");
    const winMessage = document.getElementById("winMessage");

    if (winMessage) winMessage.textContent = `${data.winner} wins!`;
    if (winBox) {
      winBox.classList.remove("hidden");
      winBox.classList.add("show");
    }
  }, 50);

  gameEnded = true;
});

// when a player disconnects
socket.on("opponentDisconnected", () => {
  gameEnded = true; // stop clicks

  const winBox = document.getElementById("winBox");
  const winMessage = document.getElementById("winMessage");

  if (winMessage) winMessage.textContent = "Your opponent has disconnected.";
  if (winBox) {
    winBox.classList.remove("hidden");
    winBox.classList.add("show");
  }
  const playAgainBtn = document.getElementById("playAgain");
  if (playAgainBtn) playAgainBtn.disabled = true;
});

const board = document.getElementById("board");

// build the board
for (let row = 0; row < 6; row++) {
  for (let col = 0; col < 7; col++) {

    const cell = document.createElement("div");
    cell.classList.add("cell");
    cell.dataset.row = row;
    cell.dataset.col = col;

    cell.addEventListener("click", function () {

      if (gameEnded) return;

      const isMyTurn =
        (myPlayerNumber == 1 && currentPlayer == "Player 1") ||
        (myPlayerNumber == 2 && currentPlayer == "Player 2");

      if (!isMyTurn) {
        console.log("Not your turn!");
        return;
      }

      if (background.paused) background.play();

      const lowestRow = findLowestEmptyRow(col);
      console.log("Lowest empty row:", lowestRow);

      if (lowestRow === null) {
        console.log("Column is full!");
        return;
      }

      // update local game state
      gameState[lowestRow][col] =
        currentPlayer == "Player 1" ? "R" : "Y";

      // send move to server
      socket.emit("playerMove", {
        row: lowestRow,
        col: col,
        player: currentPlayer == "Player 1" ? "R" : "Y",
        playerNumber: myPlayerNumber,
        roomID: roomID
      });

      // updates board locally (will be confirmed by server sync)
      const targetCell = document.querySelector(
        `.cell[data-row='${lowestRow}'][data-col='${col}']`
      );

      if (targetCell) {
        targetCell.classList.add(
          currentPlayer == "Player 1" ? "red" : "yellow"
        );
        targetCell.classList.add("drop");
      }

      dropSound.currentTime = 0;
      dropSound.play();
    });

    if (board) board.appendChild(cell);
  }
}

// play again button
const playAgainBtn = document.getElementById("playAgain");
if (playAgainBtn) {
  playAgainBtn.addEventListener("click", () => {
    socket.emit("resetGameRequest", roomID);
  });
}

// server tells both clients to reset
socket.on("resetGame", () => {

  const winBox = document.getElementById("winBox");
  if (winBox) {
    winBox.classList.remove("show");
    setTimeout(() => winBox.classList.add("hidden"), 300);
  }

  // clear board
  document.querySelectorAll(".cell").forEach(cell => {
    cell.classList.remove("red", "yellow", "drop");
  });

  // reset local gameState
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      gameState[r][c] = "";
    }
  }

  gameEnded = false;

  // restore game
  currentPlayer = myPlayerNumber == 1 ? "Player 1" : "Player 2";

  console.log("Game reset!");
});