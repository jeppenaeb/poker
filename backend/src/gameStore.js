const crypto = require("crypto");
const { generateGameCode, normalizeGameCode } = require("./gameCode");
const { applyPlayerAction, createFirstHand } = require("./pokerEngine");
const { createNextHand } = require("./nextHandEngine");

const PLAYER_COLORS = ["#4DA3FF", "#2EEB82", "#9B6BFF", "#FFB84D", "#42E8E0", "#FF5C7A"];
const games = new Map();

function randomPlayerColor(existingPlayers = []) {
  const usedColors = new Set(existingPlayers.map((player) => player.color).filter(Boolean));
  const availableColors = PLAYER_COLORS.filter((color) => !usedColors.has(color));
  const palette = availableColors.length > 0 ? availableColors : PLAYER_COLORS;
  return palette[Math.floor(Math.random() * palette.length)];
}

function randomText(options) {
  return options[Math.floor(Math.random() * options.length)];
}

function createPlayer(name, isHost = false, color = randomPlayerColor()) {
  return {
    id: crypto.randomUUID(),
    name,
    isHost,
    stack: 1000,
    buyInsUsed: 0,
    chipsBought: 1000,
    status: "active",
    message: "",
    messageAt: null,
    color
  };
}

function sanitizeName(name) {
  return String(name || "").trim().slice(0, 12);
}

function sanitizeMessage(message) {
  return String(message || "").trim().slice(0, 50);
}

function setEphemeralMessage(player, message) {
  player.message = sanitizeMessage(message);
  player.messageAt = player.message ? new Date().toISOString() : null;
}

function actionMessage(action, amount) {
  const raiseAmount = Number(amount || 0);

  if (action === "check") return randomText(["Jeg checker.", "Jeg checker også."]);
  if (action === "call") return randomText(["Jeg caller.", "Jeg caller også.", "Jeg er med."]);
  if (action === "fold") return randomText(["Jeg folder.", "Jeg smider kortene."]);
  if (action === "all_in") return randomText(["Jeg er all-in.", "All-in."]);
  if (action === "raise") return randomText([`Jeg raiser med ${raiseAmount}.`, `Jeg hæver til ${raiseAmount}.`]);
  return "";
}

function hideExpiredMessages(game) {
  const now = Date.now();

  game.players.forEach((player) => {
    if (!player.messageAt) return;

    if (now - new Date(player.messageAt).getTime() > 5000) {
      player.message = "";
      player.messageAt = null;
    }
  });
}

function createGame({
  hostName,
  gameName,
  maxPlayers,
  buyInsEnabled,
  maxBuyIns,
  buyInsUntilLevel
}) {
  let code;

  do {
    code = generateGameCode();
  } while (games.has(code));

  const hostPlayer = createPlayer(sanitizeName(hostName), true);

  const game = {
    code,
    gameName: sanitizeName(gameName),
    maxPlayers,
    status: "lobby",
    createdAt: new Date().toISOString(),
    players: [hostPlayer],
    tableSeats: [hostPlayer.id],
    buyIns: {
      enabled: buyInsEnabled,
      maxBuyIns: buyInsEnabled ? maxBuyIns : 0,
      untilBlindLevel: buyInsEnabled ? buyInsUntilLevel : 0
    },
    blinds: {
      level: 1,
      small: 10,
      big: 20
    }
  };

  games.set(code, game);

  return {
    game,
    playerId: hostPlayer.id
  };
}

function joinGame({ code, playerName }) {
  const normalizedCode = normalizeGameCode(code);
  const game = games.get(normalizedCode);

  if (!game) throw new Error("GAME_NOT_FOUND");
  if (game.status !== "lobby") throw new Error("GAME_ALREADY_STARTED");
  if (game.players.length >= game.maxPlayers) throw new Error("GAME_FULL");

  const normalizedName = sanitizeName(playerName);
  if (!normalizedName) throw new Error("MISSING_PLAYER_NAME");

  const player = createPlayer(normalizedName, false, randomPlayerColor(game.players));
  game.players.push(player);
  game.tableSeats.push(player.id);

  return {
    game,
    playerId: player.id
  };
}

function getGame(code) {
  const game = games.get(normalizeGameCode(code));
  if (game) hideExpiredMessages(game);
  return game;
}

function revealedShowdownHoleCards(game) {
  const hand = game.hand;

  if (!hand || hand.phase !== "hand_complete" || hand.winningReason !== "showdown") {
    return {};
  }

  return (hand.showdownResults || []).reduce((revealedCards, result) => {
    revealedCards[result.playerId] = hand.holeCards[result.playerId] || [];
    return revealedCards;
  }, {});
}

function getGameForPlayer(code, playerId) {
  const game = getGame(code);
  if (!game) return null;

  const safeGame = JSON.parse(JSON.stringify(game));

  if (safeGame.hand && safeGame.hand.holeCards) {
    safeGame.hand.revealedHoleCards = revealedShowdownHoleCards(game);

    const ownCards = safeGame.hand.holeCards[playerId] || [];
    safeGame.hand.holeCards = {
      [playerId]: ownCards
    };
  }

  return safeGame;
}

function startGame({ code, playerId }) {
  const game = getGame(code);

  if (!game) throw new Error("GAME_NOT_FOUND");
  if (game.status !== "lobby") throw new Error("GAME_ALREADY_STARTED");

  const player = game.players.find((item) => item.id === playerId);
  if (!player || !player.isHost) throw new Error("ONLY_HOST_CAN_START");

  if (game.players.length !== game.maxPlayers) {
    throw new Error("LOBBY_NOT_FULL");
  }

  game.status = "in_progress";
  game.startedAt = new Date().toISOString();

  return createFirstHand(game);
}

function updateSeats({ code, playerId, tableSeats }) {
  const game = getGame(code);

  if (!game) throw new Error("GAME_NOT_FOUND");
  if (game.status !== "lobby") throw new Error("GAME_ALREADY_STARTED");

  const player = game.players.find((item) => item.id === playerId);
  if (!player || !player.isHost) throw new Error("ONLY_HOST_CAN_UPDATE_SEATS");

  if (!Array.isArray(tableSeats)) throw new Error("INVALID_SEATS");
  if (tableSeats.length !== game.maxPlayers) throw new Error("INVALID_SEAT_COUNT");

  const joinedPlayerIds = new Set(game.players.map((item) => item.id));
  const usedPlayerIds = new Set();

  tableSeats.forEach((seatPlayerId) => {
    if (!seatPlayerId) return;
    if (!joinedPlayerIds.has(seatPlayerId)) throw new Error("UNKNOWN_PLAYER_IN_SEAT");
    if (usedPlayerIds.has(seatPlayerId)) throw new Error("DUPLICATE_PLAYER_IN_SEATS");
    usedPlayerIds.add(seatPlayerId);
  });

  game.players.forEach((joinedPlayer) => {
    if (!usedPlayerIds.has(joinedPlayer.id)) throw new Error("MISSING_PLAYER_IN_SEATS");
  });

  game.tableSeats = tableSeats;
  return game;
}

function playerAction({ code, playerId, action, amount }) {
  const game = getGame(code);

  if (!game) throw new Error("GAME_NOT_FOUND");

  const player = game.players.find((item) => item.id === playerId);
  const updatedGame = applyPlayerAction(game, { playerId, action, amount });

  if (player) {
    setEphemeralMessage(player, actionMessage(action, amount));
  }

  return updatedGame;
}

function setPlayerMessage({ code, playerId, message }) {
  const game = getGame(code);

  if (!game) throw new Error("GAME_NOT_FOUND");

  const player = game.players.find((item) => item.id === playerId);
  if (!player) throw new Error("PLAYER_NOT_FOUND");

  setEphemeralMessage(player, message);
  return game;
}

function nextHand({ code, playerId }) {
  const game = getGame(code);

  if (!game) throw new Error("GAME_NOT_FOUND");
  if (game.status !== "in_progress") throw new Error("GAME_NOT_IN_PROGRESS");

  const player = game.players.find((item) => item.id === playerId);
  if (!player || !player.isHost) throw new Error("ONLY_HOST_CAN_START_NEXT_HAND");

  return createNextHand(game);
}

module.exports = {
  createGame,
  joinGame,
  getGame,
  getGameForPlayer,
  nextHand,
 playerAction,
  setPlayerMessage,
  startGame,
  updateSeats
};
