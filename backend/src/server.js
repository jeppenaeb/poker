const express = require("express");
const cors = require("cors");
const path = require("path");
const { createGame, joinGame, getGame, startGame, updateSeats } = require("./gameStore");
const { normalizeGameCode } = require("./gameCode");

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE = "/poker/api";

app.use(cors());
app.use(express.json());
app.use("/poker", express.static(path.join(__dirname, "../../frontend")));

app.get("/poker", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/index.html"));
});

app.get(`${API_BASE}/health`, (req, res) => {
  res.json({ ok: true });
});

app.post(`${API_BASE}/games`, (req, res) => {
  try {
    const {
      hostName,
      gameName,
      maxPlayers,
      buyInsEnabled = false,
      maxBuyIns = 1,
      buyInsUntilLevel = 3
    } = req.body;

    const playerCount = Number(maxPlayers);
    const rebuyLimit = Number(maxBuyIns);
    const rebuyLevel = Number(buyInsUntilLevel);

    if (!hostName || !gameName || !playerCount) {
      return res.status(400).json({ error: "MISSING_FIELDS" });
    }

    if (playerCount < 2 || playerCount > 6) {
      return res.status(400).json({ error: "MAX_PLAYERS_OUT_OF_RANGE" });
    }

    if (buyInsEnabled && ![1, 2].includes(rebuyLimit)) {
      return res.status(400).json({ error: "INVALID_BUY_IN_LIMIT" });
    }

    const result = createGame({
      hostName,
      gameName,
      maxPlayers: playerCount,
      buyInsEnabled: Boolean(buyInsEnabled),
      maxBuyIns: rebuyLimit,
      buyInsUntilLevel: rebuyLevel || 3
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(`${API_BASE}/games/:code/join`, (req, res) => {
  try {
    const code = normalizeGameCode(req.params.code);
    const { playerName } = req.body;

    const result = joinGame({
      code,
      playerName
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post(`${API_BASE}/games/:code/start`, (req, res) => {
  try {
    const code = normalizeGameCode(req.params.code);
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: "MISSING_PLAYER_ID" });
    }

    const game = startGame({ code, playerId });
    res.json({ game });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post(`${API_BASE}/games/:code/seats`, (req, res) => {
  try {
    const code = normalizeGameCode(req.params.code);
    const { playerId, tableSeats } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: "MISSING_PLAYER_ID" });
    }

    const game = updateSeats({ code, playerId, tableSeats });
    res.json({ game });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get(`${API_BASE}/games/:code/state`, (req, res) => {
  const code = normalizeGameCode(req.params.code);
  const game = getGame(code);

  if (!game) {
    return res.status(404).json({ error: "GAME_NOT_FOUND" });
  }

  res.json({ game });
});

app.listen(PORT, () => {
  console.log(`Poker backend running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}${API_BASE}/health`);
});
