(function () {
  const API_BASE = "/poker/api";
  let latestGame = null;
  let latestOwnPlayerId = "";

  function ownPlayerIdFromGame(game) {
    return Object.keys(game.hand?.holeCards || {})[0] || "";
  }

  function rankLabel(card) {
    const rank = card.slice(1);
    const labels = {
      A: "es",
      K: "konge",
      Q: "dame",
      J: "knægt",
      "10": "10"
    };
    return labels[rank] || rank;
  }

  function suitName(card) {
    const suits = {
      H: "hjerter",
      D: "ruder",
      S: "spar",
      C: "klør"
    };
    return suits[card.slice(0, 1)] || "";
  }

  function holeDescription(cards) {
    if (!cards || cards.length < 2) return "";

    const [first, second] = cards;
    const suited = first.slice(0, 1) === second.slice(0, 1);
    return `${rankLabel(first)}, ${rankLabel(second)}${suited ? ` suited i ${suitName(first)}` : ""}`;
  }

  function applyHoleDescription(game) {
    const ownPlayerId = ownPlayerIdFromGame(game);
    const ownCards = game.hand?.holeCards?.[ownPlayerId] || [];
    const description = holeDescription(ownCards);
    const handStrength = document.getElementById("handStrength");

    if (!handStrength || !description) return;

    handStrength.textContent = `${handStrength.textContent} · ${description}`;
  }

  function seatForPlayer(playerId) {
    return Array.from(document.querySelectorAll(".game-seat")).find((seat) => {
      return seat.dataset.playerId === playerId && seat.style.display !== "none";
    });
  }

  function clearMessageUi() {
    document.querySelectorAll(".player-chat-button, .player-chat-text").forEach((element) => element.remove());
  }

  function addMessageButton(seat) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "player-chat-button";
    button.title = "Skriv kort besked";
    button.textContent = "💬";
    seat.appendChild(button);
  }

  function addMessageText(seat, text) {
    if (!text) return;

    const bubble = document.createElement("div");
    bubble.className = "player-chat-text";
    bubble.textContent = text;
    seat.appendChild(bubble);
  }

  function renderPlayerMessages(game) {
    latestGame = game;
    latestOwnPlayerId = ownPlayerIdFromGame(game);

    clearMessageUi();

    game.players.forEach((player) => {
      const seat = seatForPlayer(player.id);
      if (!seat) return;

      if (player.id === latestOwnPlayerId) {
        addMessageButton(seat);
      }

      addMessageText(seat, player.message || "");
    });
  }

  async function submitMessage() {
    if (!latestGame || !latestOwnPlayerId) return;

    const ownPlayer = latestGame.players.find((player) => player.id === latestOwnPlayerId);
    const currentMessage = ownPlayer?.message || "";
    const text = window.prompt("Skriv en kort besked (maks 50 tegn)", currentMessage);

    if (text === null) return;

    try {
      const response = await fetch(`${API_BASE}/games/${latestGame.code}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          playerId: latestOwnPlayerId,
          message: text.slice(0, 50)
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "REQUEST_FAILED");
      }

      window.renderGame(data.game);
    } catch (error) {
      const status = document.getElementById("gameStatus");
      if (status) status.textContent = `Kunne ikke sende besked: ${error.message}`;
    }
  }

  if (typeof renderLobby === "function") {
    const originalRenderLobby = renderLobby;
    renderLobby = (game) => {
      originalRenderLobby(game);

      const currentPlayer = game.players.find((player) => player.id === currentPlayerId);
      const isHost = Boolean(currentPlayer?.isHost);
      const hint = document.getElementById("tableHint");

      if (hint) {
        hint.textContent = isHost && game.status === "lobby"
          ? "Træk spillerne mellem pladserne, for at ændre rækkefølgen"
          : "Host styrer bordplacering";
      }
    };
  }

  if (typeof renderGame === "function") {
    const originalRenderGame = window.renderGame || renderGame;
    window.renderGame = (game) => {
      originalRenderGame(game);
      applyHoleDescription(game);
      renderPlayerMessages(game);
    };
    renderGame = window.renderGame;
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".player-chat-button")) return;
    submitMessage();
  });
})();
