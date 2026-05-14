(() => {
  const API_BASE = "/poker/api";
  let button = document.getElementById("nextHandButton");
  let message = document.getElementById("nextHandMessage");

  if (!button) {
    const actionPanel = document.getElementById("actionPanel");
    if (!actionPanel) return;

    button = document.createElement("button");
    button.className = "primary-action";
    button.id = "nextHandButton";
    button.type = "button";
    button.hidden = true;
    button.textContent = "Næste hånd";

    message = document.createElement("p");
    message.className = "message";
    message.id = "nextHandMessage";

    actionPanel.insertAdjacentElement("afterend", button);
    button.insertAdjacentElement("afterend", message);
  }

  let lastGame = null;
  let lastPlayerId = "";

  function ownPlayerIdFromGame(game) {
    return Object.keys(game.hand?.holeCards || {})[0] || "";
  }

  function setMessage(text) {
    if (message) message.textContent = text || "";
  }

  function renderNextHandButton(game) {
    lastGame = game;
    lastPlayerId = ownPlayerIdFromGame(game);

    const ownPlayer = game.players.find((player) => player.id === lastPlayerId);
    const canStartNextHand =
      game.status === "in_progress" &&
      game.hand?.phase === "hand_complete" &&
      Boolean(ownPlayer?.isHost);

    button.hidden = !canStartNextHand;
    button.disabled = !canStartNextHand;
    setMessage("");

    const gameStatus = document.getElementById("gameStatus");
    if (game.status === "completed" && gameStatus) {
      const winner = game.players.find((player) => player.id === game.winnerPlayerId);
      gameStatus.textContent = winner ? `${winner.name} vinder spillet.` : "Spillet er slut.";
    }
  }

  const originalRenderGame = window.renderGame;
  if (typeof originalRenderGame === "function") {
    window.renderGame = (game) => {
      originalRenderGame(game);
      renderNextHandButton(game);
    };
  }

  button.addEventListener("click", async () => {
    if (!lastGame || !lastPlayerId) return;

    button.disabled = true;
    setMessage("Starter næste hånd...");

    try {
      const response = await fetch(`${API_BASE}/games/${lastGame.code}/next-hand`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ playerId: lastPlayerId })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "REQUEST_FAILED");
      }

      window.renderGame(data.game);
    } catch (error) {
      button.disabled = false;
      setMessage(`Kunne ikke starte næste hånd: ${error.message}`);
    }
  });
})();

(() => {
  const visualSlotsByPlayerCount = {
    2: [3, 0],
    3: [3, 5, 1],
    4: [3, 4, 0, 2],
    5: [3, 4, 5, 1, 2],
    6: [3, 4, 5, 0, 1, 2]
  };

  function getCurrentPlayerId() {
    return typeof currentPlayerId === "undefined" ? "" : currentPlayerId;
  }

  function getVisibleSeatCount(game) {
    return Math.max(2, Math.min(6, Number(game.maxPlayers || 6)));
  }

  function rotateIndexesAroundPlayer(game) {
    const seatCount = getVisibleSeatCount(game);
    const indexes = Array.from({ length: seatCount }, (_, index) => index);
    const ownSeatIndex = game.tableSeats.indexOf(getCurrentPlayerId());

    if (ownSeatIndex < 0 || ownSeatIndex >= seatCount) {
      return indexes;
    }

    return indexes.slice(ownSeatIndex).concat(indexes.slice(0, ownSeatIndex));
  }

  function clearLobbySeats() {
    for (let index = 0; index < 6; index += 1) {
      const seat = document.getElementById(`seat${index}`);
      if (!seat) continue;

      seat.classList.remove("empty");
      seat.innerHTML = "";
      seat.style.display = "none";
      seat.draggable = false;
      seat.dataset.playerId = "";
      seat.dataset.logicalIndex = "";
    }
  }

  function renderSeat(seat, game, logicalIndex, isHost) {
    const playerId = game.tableSeats[logicalIndex] || "";
    const player = game.players.find((item) => item.id === playerId);

    seat.style.display = "";
    seat.dataset.logicalIndex = String(logicalIndex);
    seat.dataset.playerId = playerId;
    seat.draggable = false;

    if (!player) {
      seat.classList.add("empty");
      seat.innerHTML = `<strong>Ledig</strong><span>venter</span>`;
      return;
    }

    seat.classList.remove("empty");
    seat.draggable = isHost && game.status === "lobby";
    seat.innerHTML = `
      <strong>${player.id === getCurrentPlayerId() ? "Dig" : player.name}</strong>
      <span>${player.isHost ? "Host" : "Klar"} - ${player.stack} units</span>
    `;
  }

  function applyLobbyPerspective(game) {
    if (!game || game.status !== "lobby") return;

    const seatCount = getVisibleSeatCount(game);
    const visualSlots = visualSlotsByPlayerCount[seatCount] || visualSlotsByPlayerCount[6];
    const logicalIndexes = rotateIndexesAroundPlayer(game);
    const currentPlayer = game.players.find((player) => player.id === getCurrentPlayerId());
    const isHost = Boolean(currentPlayer?.isHost);

    clearLobbySeats();

    logicalIndexes.forEach((logicalIndex, visualIndex) => {
      const visualSlot = visualSlots[visualIndex];
      const seat = document.getElementById(`seat${visualSlot}`);
      if (!seat) return;
      renderSeat(seat, game, logicalIndex, isHost);
    });
  }

  if (typeof renderLobby === "function") {
    const originalRenderLobby = renderLobby;
    renderLobby = (game) => {
      originalRenderLobby(game);
      applyLobbyPerspective(game);
    };
  }

  if (typeof getRenderedSeatOrder === "function") {
    getRenderedSeatOrder = () => {
      const seats = [];

      for (let index = 0; index < 6; index += 1) {
        const seat = document.getElementById(`seat${index}`);
        if (!seat || seat.style.display === "none") continue;

        const logicalIndex = Number(seat.dataset.logicalIndex);
        if (!Number.isInteger(logicalIndex)) continue;

        seats.push({
          logicalIndex,
          playerId: seat.dataset.playerId || null
        });
      }

      return seats
        .sort((first, second) => first.logicalIndex - second.logicalIndex)
        .map((item) => item.playerId);
    };
  }
})();
