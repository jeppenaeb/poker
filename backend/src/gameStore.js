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

function createPlayer(name, isHost = false, color = randomPlayerColor()) {
  return {
    id: crypto.randomUUID(),
    name,
    isHost,
    stack: 1000,
    buyInsUsed: 0,
    chipsBought: 1000,
    status: "active",
    color
  };
}

function sanitizeName(name) {
  return String(name || "").trim().slice(0, 12);
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
  return games.get(normalizeGameCode(code));
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

  game.tableSeats = Array.isArray(game.tableSeats) && game.tableSeats.length > 0 ? game.tableSeats : game.players.map((item) => item.id);
  game.status = "in_progress";
  createFirstHand(game);

  return game;
}

function reorderSeats({ code, playerId, tableSeats }) {
  const game = getGame(code);

  if (!game) throw new Error("GAME_NOT_FOUND");

  const player = game.players.find((item) => item.id === playerId);
  if (!player || !player.isHost) throw new Error("ONLY_HOST_CAN_REORDER");
  if (game.status !== "lobby") throw new Error("GAME_ALREADY_STARTED");

  const currentIds = new Set(game.players.map((item) => item.id));
  const normalizedSeats = Array.isArray(tableSeats) ? tableSeats.filter((seatPlayerId) => currentIds.has(seatPlayerId)) : [];

  if (normalizedSeats.length !== game.players.length || new Set(normalizedSeats).size !== game.players.length) {
    throw new Error("INVALID_SEAT_ORDER");
  }

  game.tableSeats = normalizedSeats;
  return game;
}

const updateSeats = reorderSeats;

function playerAction({ code, playerId, action, amount }) {
  const game = getGame(code);

  if (!game) throw new Error("GAME_NOT_FOUND");
  if (game.status !== "in_progress") throw new Error("GAME_NOT_IN_PROGRESS");

  const player = game.players.find((item) => item.id === playerId);
  if (!player) throw new Error("PLAYER_NOT_FOUND");

  return applyPlayerAction(game, { playerId, action, amount });
}

function nextHand({ code, playerId }) {
  const game = getGame(code);

  if (!game) throw new Error("GAME_NOT_FOUND");

  const player = game.players.find((item) => item.id === playerId);
  if (!player || !player.isHost) throw new Error("ONLY_HOST_CAN_START_NEXT_HAND");
  if (!game.hand || game.hand.phase !== "hand_complete") throw new Error("HAND_NOT_COMPLETE");

  createNextHand(game);
  return game;
}

module.exports = {
  createGame,
  joinGame,
  getGame,
  getGameForPlayer,
  startGame,
  reorderSeats,
  updateSeats,
  playerAction,
  nextHand
};
