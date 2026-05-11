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

  if (!["lobbyView", "gameView"].includes(id) && lobbyTimer) {
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
    document.getElementById("lobbyStatus").textContent = `${joined} / ${game.maxPlayers} spillere er klar. Venter på at host starter spillet.`;
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
    return `<div class="empty-board">Ingen fælleskort endnu</div>`;
  }

  return cards.map((card) => `<div class="${cardClass(card)}">${cardLabel(card)}</div>`).join("");
}

function rankValue(card) {
  const rank = card.slice(1);
  const values = {
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14
  };
  return values[rank] || 0;
}

function rankName(value) {
  const names = {
    14: "esser",
    13: "konger",
    12: "damer",
    11: "knægte",
    10: "tiere",
    9: "niere",
    8: "ottere",
    7: "syvere",
    6: "seksere",
    5: "femmere",
    4: "firere",
    3: "treere",
    2: "toere"
  };
  return names[value] || "";
}

function hasStraight(values) {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  if (unique.includes(14)) unique.unshift(1);

  let run = 1;
  for (let i = 1; i < unique.length; i += 1) {
    if (unique[i] === unique[i - 1] + 1) {
      run += 1;
      if (run >= 5) return true;
    } else {
      run = 1;
    }
  }

  return false;
}

function evaluateHand(cards) {
  if (!cards || cards.length < 2) return "-";

  const values = cards.map(rankValue).filter(Boolean);
  const counts = values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  const grouped = Object.entries(counts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  const suits = cards.reduce((acc, card) => {
    const suit = card.slice(0, 1);
    acc[suit] = acc[suit] || [];
    acc[suit].push(rankValue(card));
    return acc;
  }, {});
  const flushValues = Object.values(suits).find((items) => items.length >= 5);
  const straight = hasStraight(values);
  const straightFlush = flushValues ? hasStraight(flushValues) : false;

  if (straightFlush && flushValues.includes(14) && flushValues.includes(13)) return "Royal flush";
  if (straightFlush) return "Straight flush";
  if (grouped[0]?.count === 4) return `Fire ens, ${rankName(grouped[0].value)}`;
  if (grouped[0]?.count === 3 && grouped.some((item, index) => index > 0 && item.count >= 2)) return "Fuldt hus";
  if (flushValues) return "Flush";
  if (straight) return "Straight";
  if (grouped[0]?.count === 3) return `Tre ens, ${rankName(grouped[0].value)}`;

  const pairs = grouped.filter((item) => item.count === 2);
  if (pairs.length >= 2) return `To par, ${rankName(pairs[0].value)} og ${rankName(pairs[1].value)}`;
  if (pairs.length === 1) return `Par ${rankName(pairs[0].value)}`;

  return `Højt kort ${rankName(Math.max(...values))}`;
}

function renderGame(game) {
  const hand = game.hand;
  const currentPlayer = game.players.find((player) => player.id === currentPlayerId);
  const winner = game.players.find((player) => player.id === hand.winnerPlayerId);

  document.getElementById("gameTitle").textContent = game.gameName;
  document.getElementById("gameCode").textContent = game.code;
  document.getElementById("streetLabel").textContent = hand.phase;
  document.getElementById("communityCards").innerHTML = renderCards(hand.communityCards);
  document.getElementById("potBox").textContent = `Pot: ${hand.pot}`;

  const actor = game.players.find((player) => player.id === hand.currentPlayerId);
  document.getElementById("gameStatus").textContent =
    winner
      ? `${winner.name} vinder hånden.`
      : actor && actor.id === currentPlayerId
      ? "Det er din tur."
      : `Venter på ${actor ? actor.name : "næste spiller"}.`;

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

  const ownCards = hand.holeCards[currentPlayerId] || [];
  document.getElementById("holeCards").innerHTML = renderCards(ownCards);
  document.getElementById("handStrength").textContent = `Din hånd: ${evaluateHand([...ownCards, ...hand.communityCards])}`;
  document.getElementById("gameRules").innerHTML = `
    <div class="rule-box"><span>Blinds</span><strong>${game.blinds.small}/${game.blinds.big}</strong></div>
    <div class="rule-box"><span>Hand</span><strong>#${hand.number}</strong></div>
    <div class="rule-box"><span>Dealer</span><strong>${game.players.find((player) => player.id === hand.dealerPlayerId)?.name || "-"}</strong></div>
    <div class="rule-box"><span>Din stack</span><strong>${currentPlayer ? currentPlayer.stack : 0}</strong></div>
  `;

  renderActionPanel(game);
}

function renderActionPanel(game) {
  const hand = game.hand;
  const panel = document.getElementById("actionPanel");
  const isYourTurn = hand.currentPlayerId === currentPlayerId;
  const handFinished = ["showdown", "hand_complete"].includes(hand.phase);

  panel.hidden = !isYourTurn || handFinished;

  if (panel.hidden) return;

  const currentBet = Math.max(0, ...Object.values(hand.bets));
  const playerBet = hand.bets[currentPlayerId] || 0;
  const callAmount = Math.max(0, currentBet - playerBet);
  const raiseInput = document.getElementById("raiseAmount");
  const minimumRaise = Math.max(game.blinds.big, currentBet + game.blinds.big);

  raiseInput.min = minimumRaise;
  raiseInput.value = Math.max(Number(raiseInput.value || 0), minimumRaise);

  const checkButton = panel.querySelector("[data-action='check']");
  const callButton = panel.querySelector("[data-action='call']");

  checkButton.disabled = callAmount > 0;
  callButton.disabled = callAmount === 0;
  callButton.textContent = callAmount > 0 ? `Call ${callAmount}` : "Call";
}

async function sendPlayerAction(action) {
  setMessage("actionMessage", "");

  const body = {
    playerId: currentPlayerId,
    action
  };

  if (action === "raise") {
    body.amount = Number(document.getElementById("raiseAmount").value);
  }

  try {
    const { game } = await api(`/games/${currentGameCode}/action`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    renderGame(game);
    showView("gameView");
  } catch (error) {
    setMessage("actionMessage", `Handling fejlede: ${error.message}`);
  }
}

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => sendPlayerAction(button.dataset.action));
});

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
