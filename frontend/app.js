const API_BASE = "/poker/api";

let currentGameCode = "";
let currentPlayerId = "";
let lobbyTimer = null;
let draggedPlayerId = "";

const views = document.querySelectorAll(".view");
const buyInsEnabled = document.getElementById("buyInsEnabled");
const buyInOptions = document.getElementById("buyInOptions");
const hostForm = document.getElementById("hostForm");
const joinLookupForm = document.getElementById("joinLookupForm");
const joinForm = document.getElementById("joinForm");

function showView(id) {
  views.forEach((view) => view.classList.toggle("is-active", view.id === id));

  if (id !== "lobbyView" && lobbyTimer) {
    clearInterval(lobbyTimer);
    lobbyTimer = null;
  }
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function setMessage(id, text) {
  document.getElementById(id).textContent = text || "";
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "REQUEST_FAILED");
  }

  return data;
}

function formatBuyIns(game) {
  if (!game.buyIns.enabled) return "Ingen buy-ins";
  return `Op til ${game.buyIns.maxBuyIns} pr. spiller til og med level ${game.buyIns.untilBlindLevel}`;
}

function renderJoinSummary(game) {
  document.getElementById("joinSummary").innerHTML = `
    <strong>${game.gameName}</strong>
    <span>Kode: ${game.code}</span>
    <span>Spillere: ${game.players.length} / ${game.maxPlayers}</span>
    ${game.buyIns.enabled ? `<span>Buy-ins: ${formatBuyIns(game)}</span>` : ""}
    <span>Startstack: 1000 units - Blinds: ${game.blinds.small}/${game.blinds.big}</span>
  `;
}

function renderLobby(game) {
  if (game.status === "in_progress") {
    renderGame(game);
    showView("gameView");
    return;
  }

  document.getElementById("lobbyTitle").textContent = game.gameName;
  document.getElementById("lobbyCode").textContent = game.code;

  const joined = game.players.length;
  const full = joined === game.maxPlayers;
  const currentPlayer = game.players.find((player) => player.id === currentPlayerId);
  const isHost = Boolean(currentPlayer && currentPlayer.isHost);
  const canStart = full && isHost && game.status === "lobby";

  if (game.status !== "lobby") {
    document.getElementById("lobbyStatus").textContent = "Spillet er startet.";
  } else if (full && isHost) {
    document.getElementById("lobbyStatus").textContent = `${joined} / ${game.maxPlayers} spillere er klar. Du kan starte spillet.`;
  } else if (full) {
    document.getElementById("lobbyStatus").textContent = `${joined} / ${game.maxPlayers} spillere er klar. Venter paa at host starter spillet.`;
  } else {
    document.getElementById("lobbyStatus").textContent = `${joined} / ${game.maxPlayers} spillere joinet. Lobbyen opdateres automatisk.`;
  }

  document.getElementById("startGameButton").hidden = !isHost;
  document.getElementById("startGameButton").disabled = !canStart;
  document.getElementById("startGameButton").textContent = "Start spil";

  for (let i = 0; i < 6; i += 1) {
    const seat = document.getElementById(`seat${i}`);
    const playerId = game.tableSeats[i];
    const player = game.players.find((item) => item.id === playerId);

    if (i >= game.maxPlayers) {
      seat.className = seat.className.replace(" empty", "");
      seat.innerHTML = "";
      seat.style.display = "none";
      seat.draggable = false;
      seat.dataset.playerId = "";
      continue;
    }

    seat.style.display = "";
    seat.draggable = false;

    if (!player) {
      seat.classList.add("empty");
      seat.dataset.playerId = "";
      seat.innerHTML = `<strong>Ledig</strong><span>venter</span>`;
    } else {
      seat.classList.remove("empty");
      seat.dataset.playerId = player.id;
      seat.innerHTML = `
        <strong>${player.name}</strong>
        <span>${player.isHost ? "Host" : "Klar"} - ${player.stack} units</span>
      `;
      seat.draggable = isHost && game.status === "lobby";
    }
  }

  document.getElementById("tableHint").textContent =
    isHost && game.status === "lobby"
      ? "Drag spillere mellem pladserne"
      : "Host styrer bordplacering";

  document.getElementById("lobbyRules").innerHTML = `
    <div class="rule-box"><span>Spillere</span><strong>${joined}/${game.maxPlayers}</strong></div>
    ${
      game.buyIns.enabled
        ? `<div class="rule-box"><span>Buy-ins</span><strong>${formatBuyIns(game)}</strong></div>`
        : ""
    }
    <div class="rule-box"><span>Startstack</span><strong>1000</strong></div>
    <div class="rule-box"><span>Blinds</span><strong>${game.blinds.small}/${game.blinds.big}</strong></div>
  `;
}

async function saveSeatOrder(nextSeats) {
  const { game } = await api(`/games/${currentGameCode}/seats`, {
    method: "POST",
    body: JSON.stringify({
      playerId: currentPlayerId,
      tableSeats: nextSeats
    })
  });
  renderLobby(game);
}

function getRenderedSeatOrder() {
  const seats = [];
  for (let i = 0; i < 6; i += 1) {
    const seat = document.getElementById(`seat${i}`);
    if (seat.style.display === "none") continue;
    seats.push(seat.dataset.playerId || null);
  }
  return seats;
}

async function loadLobby() {
  if (!currentGameCode) return;
  const playerQuery = currentPlayerId ? `?playerId=${encodeURIComponent(currentPlayerId)}` : "";
  const { game } = await api(`/games/${currentGameCode}/state${playerQuery}`);
  renderLobby(game);
}

function enterLobby(game, playerId) {
  currentGameCode = game.code;
  currentPlayerId = playerId;
  renderLobby(game);
  showView("lobbyView");
  if (lobbyTimer) clearInterval(lobbyTimer);
  lobbyTimer = setInterval(() => {
    loadLobby().catch(() => {});
  }, 2000);
}

document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.go));
});

buyInsEnabled.addEventListener("change", () => {
  buyInOptions.hidden = !buyInsEnabled.checked;
});

document.querySelectorAll(".game-code-input").forEach((input) => {
  input.addEventListener("input", () => {
    input.value = normalizeCode(input.value);
  });
});

hostForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("hostMessage", "");

  const formData = new FormData(hostForm);
  const body = {
    hostName: formData.get("hostName"),
    gameName: formData.get("gameName"),
    maxPlayers: Number(formData.get("maxPlayers")),
    buyInsEnabled: Boolean(formData.get("buyInsEnabled")),
    maxBuyIns: Number(formData.get("maxBuyIns") || 1),
    buyInsUntilLevel: Number(formData.get("buyInsUntilLevel") || 3)
  };

  try {
    const { game, playerId } = await api("/games", {
      method: "POST",
      body: JSON.stringify(body)
    });
    enterLobby(game, playerId);
  } catch (error) {
    setMessage("hostMessage", `Kunne ikke oprette spil: ${error.message}`);
  }
});

joinLookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("lookupMessage", "");

  const code = normalizeCode(new FormData(joinLookupForm).get("code"));

  try {
    const { game } = await api(`/games/${code}/state`);
    currentGameCode = game.code;
    renderJoinSummary(game);
    joinForm.hidden = false;
  } catch (error) {
    joinForm.hidden = true;
    setMessage("lookupMessage", `Kunne ikke finde spil: ${error.message}`);
  }
});

joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("joinMessage", "");

  const playerName = new FormData(joinForm).get("playerName");

  try {
    const { game, playerId } = await api(`/games/${currentGameCode}/join`, {
      method: "POST",
      body: JSON.stringify({ playerName })
    });
    enterLobby(game, playerId);
  } catch (error) {
    setMessage("joinMessage", `Kunne ikke joine: ${error.message}`);
  }
});

document.getElementById("startGameButton").addEventListener("click", async () => {
  try {
    const { game } = await api(`/games/${currentGameCode}/start`, {
      method: "POST",
      body: JSON.stringify({ playerId: currentPlayerId })
    });
    renderGame(game);
    showView("gameView");
  } catch (error) {
    document.getElementById("lobbyStatus").textContent = `Kunne ikke starte spil: ${error.message}`;
  }
});

function cardLabel(card) {
  if (!card) return "";
  const suit = card.slice(0, 1);
  const rank = card.slice(1);
  const symbols = {
    S: "&spades;",
    H: "&hearts;",
    D: "&diams;",
    C: "&clubs;"
  };
  return `${symbols[suit] || suit}${rank}`;
}

function cardClass(card) {
  return card && ["H", "D"].includes(card.slice(0, 1)) ? "card red-card" : "card";
}

function renderCards(cards) {
  if (!cards || cards.length === 0) {
    return `<div class="empty-board">Ingen faelleskort endnu</div>`;
  }

  return cards.map((card) => `<div class="${cardClass(card)}">${cardLabel(card)}</div>`).join("");
}

function renderGame(game) {
  const hand = game.hand;
  const currentPlayer = game.players.find((player) => player.id === currentPlayerId);

  document.getElementById("gameTitle").textContent = game.gameName;
  document.getElementById("gameCode").textContent = game.code;
  document.getElementById("streetLabel").textContent = hand.phase;
  document.getElementById("communityCards").innerHTML = renderCards(hand.communityCards);
  document.getElementById("potBox").textContent = `Pot: ${hand.pot}`;

  const actor = game.players.find((player) => player.id === hand.currentPlayerId);
  document.getElementById("gameStatus").textContent =
    actor && actor.id === currentPlayerId
      ? "Det er din tur."
      : `Venter paa ${actor ? actor.name : "naeste spiller"}.`;

  for (let i = 0; i < 6; i += 1) {
    const seat = document.getElementById(`gameSeat${i}`);
    const playerId = game.tableSeats[i];
    const player = game.players.find((item) => item.id === playerId);

    if (!player) {
      seat.style.display = "none";
      seat.innerHTML = "";
      continue;
    }

    seat.style.display = "";
    seat.classList.toggle("is-current", player.id === hand.currentPlayerId);
    seat.classList.toggle("is-you", player.id === currentPlayerId);

    const badges = [
      player.id === hand.dealerPlayerId ? "D" : "",
      player.id === hand.smallBlindPlayerId ? "SB" : "",
      player.id === hand.bigBlindPlayerId ? "BB" : ""
    ].filter(Boolean);

    seat.innerHTML = `
      <strong>${player.id === currentPlayerId ? "Dig" : player.name}</strong>
      <span>${player.stack} units</span>
      <span>Bet: ${hand.bets[player.id] || 0}</span>
      <div class="badge-line">${badges.map((badge) => `<b>${badge}</b>`).join("")}</div>
    `;
  }

  document.getElementById("holeCards").innerHTML = renderCards(hand.holeCards[currentPlayerId] || []);
  document.getElementById("gameRules").innerHTML = `
    <div class="rule-box"><span>Blinds</span><strong>${game.blinds.small}/${game.blinds.big}</strong></div>
    <div class="rule-box"><span>Hand</span><strong>#${hand.number}</strong></div>
    <div class="rule-box"><span>Dealer</span><strong>${game.players.find((player) => player.id === hand.dealerPlayerId)?.name || "-"}</strong></div>
    <div class="rule-box"><span>Din stack</span><strong>${currentPlayer ? currentPlayer.stack : 0}</strong></div>
  `;
}

document.querySelectorAll(".seat").forEach((seat) => {
  seat.addEventListener("dragstart", (event) => {
    if (!seat.draggable || !seat.dataset.playerId) {
      event.preventDefault();
      return;
    }
    draggedPlayerId = seat.dataset.playerId;
  });

  seat.addEventListener("dragover", (event) => {
    if (draggedPlayerId) event.preventDefault();
  });

  seat.addEventListener("drop", async (event) => {
    event.preventDefault();
    if (!draggedPlayerId) return;

    const targetPlayerId = seat.dataset.playerId || null;
    const nextSeats = getRenderedSeatOrder().map((playerId) => {
      if (playerId === draggedPlayerId) return targetPlayerId;
      if (playerId === targetPlayerId) return draggedPlayerId;
      return playerId;
    });

    draggedPlayerId = "";

    try {
      await saveSeatOrder(nextSeats);
    } catch (error) {
      document.getElementById("lobbyStatus").textContent = `Kunne ikke flytte spiller: ${error.message}`;
    }
  });
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/poker/sw.js").catch(() => {});
}
