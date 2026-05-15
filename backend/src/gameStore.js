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

function sanitizeMessage(message, maxLength = 120) {
  return String(message || "").trim().slice(0, maxLength);
}

function setEphemeralMessage(player, message) {
  player.message = sanitizeMessage(message);
  player.messageAt = player.message ? new Date().toISOString() : null;
}

function playerName(game, playerId) {
  return game.players.find((player) => player.id === playerId)?.name || "næste spiller";
}

function previousRoundActions(game) {
  const hand = game.hand;
  if (!hand) return [];

  return (hand.actionLog || []).filter((entry) => entry.phase === hand.phase);
}

function hasPreviousAction(game, actions) {
  const wantedActions = Array.isArray(actions) ? actions : [actions];
  return previousRoundActions(game).some((entry) => wantedActions.includes(entry.action));
}

function currentBet(hand) {
  return Math.max(0, ...Object.values(hand?.bets || {}));
}

function isPlayerActionableBeforeAction(game, playerId) {
  const hand = game.hand;
  const player = game.players.find((item) => item.id === playerId);
  return Boolean(
    hand &&
      player &&
      player.status === "active" &&
      player.stack > 0 &&
      !hand.foldedPlayerIds.includes(playerId) &&
      !hand.allInPlayerIds.includes(playerId)
  );
}

function isFinalCallBeforeNewCards(game, playerId) {
  const hand = game.hand;
  if (!hand || hand.phase === "river") return false;

  const betToMatch = currentBet(hand);
  const projectedActedPlayerIds = new Set([...(hand.actedPlayerIds || []), playerId]);

  return game.tableSeats.filter((seatPlayerId) => isPlayerActionableBeforeAction(game, seatPlayerId)).every((seatPlayerId) => {
    const projectedBet = seatPlayerId === playerId ? betToMatch : hand.bets[seatPlayerId] || 0;
    return projectedActedPlayerIds.has(seatPlayerId) && projectedBet === betToMatch;
  });
}

function actionMessage(game, action, amount, playerId) {
  const raiseAmount = Number(amount || 0);

  if (action === "check") {
    const options = ["Check.", "Jeg checker.", "Jeg nøjes med at checke."];
    if (hasPreviousAction(game, "check")) options.push("Jeg checker også.");
    return randomText(options);
  }

  if (action === "call") {
    if (isFinalCallBeforeNewCards(game, playerId)) return "Jeg caller. Lad os se nogle kort.";

    const options = ["Jeg caller.", "Jeg er med.", "Jeg vil gerne se."];
    if (hasPreviousAction(game, "call")) options.push("Jeg caller også.");
    return randomText(options);
  }

  if (action === "raise") {
    const options = [`Jeg raiser til ${raiseAmount}.`, `Jeg forhøjer til ${raiseAmount}.`];
    if (hasPreviousAction(game, ["raise", "all_in"])) options.push(`Jeg re-raiser til ${raiseAmount}.`);
    return randomText(options);
  }

  if (action === "fold") {
    const options = ["Jeg folder.", "Jeg smider kortene.", "Jeg er ude.", "Tjaeh, I fortsætter bare uden mig."];
    if (hasPreviousAction(game, "fold")) options.push("Jeg er også ude.");
    return randomText(options);
  }

  if (action === "all_in") {
    const options = ["All-in!", "Jeg er all-in!", "Jeg skubber hele stacken ind. All-in!"];
    if (hasPreviousAction(game, "all_in")) options.push("Jeg er med på all-in. Action time!");
    return randomText(options);
  }

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

  const startedGame = createFirstHand(game);
  const dealer = startedGame.players.find((item) => item.id === startedGame.hand.dealerPlayerId);
  const starterName = playerName(startedGame, startedGame.hand.currentPlayerId);

  if (dealer) {
    setEphemeralMessage(dealer, `Jeg vandt lodtrækningen og er dealer i første runde. ${starterName}, du starter.`);
  }

  return startedGame;
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
  const message = actionMessage(game, action, amount, playerId);
  const updatedGame = applyPlayerAction(game, { playerId, action, amount });

  if (player) {
    setEphemeralMessage(player, message);
  }

  return updatedGame;
}

function setPlayerMessage({ code, playerId, message }) {
  const game = getGame(code);

  if (!game) throw new Error("GAME_NOT_FOUND");

  const player = game.players.find((item) => item.id === playerId);
  if (!player) throw new Error("PLAYER_NOT_FOUND");

  setEphemeralMessage(player, sanitizeMessage(message, 50));
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
