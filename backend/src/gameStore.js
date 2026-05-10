const crypto = require("crypto");
const { generateGameCode, normalizeGameCode } = require("./gameCode");

const games = new Map();

function createPlayer(name, isHost = false) {
  return {
    id: crypto.randomUUID(),
    name,
    isHost,
    stack: 1000,
    buyInsUsed: 0,
    chipsBought: 1000,
    status: "active"
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

  const player = createPlayer(normalizedName, false);
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

module.exports = {
  createGame,
  joinGame,
  getGame
};
