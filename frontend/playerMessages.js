(function () {
  const API_BASE = "/poker/api";
  const MESSAGE_VISIBLE_MS = 5000;
  let latestGame = null;
  let latestOwnPlayerId = "";

  function currentPlayerIdFromApp() {
    return typeof currentPlayerId === "undefined" ? "" : currentPlayerId;
  }

  function ownPlayerIdFromGame(game) {
    return Object.keys(game.hand?.holeCards || {})[0] || currentPlayerIdFromApp();
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
    return Array.from(document.querySelectorAll(".game-seat, .seat")).find((seat) => {
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

  function isFreshMessage(player) {
    if (!player.message || !player.messageAt) return false;
    return Date.now() - new Date(player.messageAt).getTime() <= MESSAGE_VISIBLE_MS;
  }

  function addMessageText(seat, player) {
    if (!isFreshMessage(player)) return;

    const bubble = document.createElement("div");
    bubble.className = "player-chat-text";
    bubble.textContent = player.message;
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

      addMessageText(seat, player);
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

      if (data.game.status === "lobby" && typeof renderLobby === "function") {
        renderLobby(data.game);
      } else {
        window.renderGame(data.game);
      }
    } catch (error) {
      const status = document.getElementById(latestGame.status === "lobby" ? "lobbyStatus" : "gameStatus");
      if (status) status.textContent = `Kunne ikke sende besked: ${error.message}`;
    }
  }

  async function copyGameCode(code, button) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const input = document.createElement("input");
        input.value = code;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }

      button.textContent = "Kopieret";
      setTimeout(() => {
        button.textContent = "Kopiér";
      }, 1200);
    } catch (_error) {
      button.textContent = "Kunne ikke kopiere";
      setTimeout(() => {
        button.textContent = "Kopiér";
      }, 1600);
    }
  }

  function renderCopyCodeButton(game, isHost) {
    document.querySelectorAll(".copy-code-button").forEach((button) => button.remove());

    if (!isHost || game.status !== "lobby") return;

    const codePill = document.getElementById("lobbyCode");
    if (!codePill) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-code-button";
    button.dataset.copyCode = game.code;
    button.textContent = "Kopiér";
    codePill.insertAdjacentElement("afterend", button);
  }

  if (typeof renderLobby === "function") {
    const originalRenderLobby = renderLobby;
    renderLobby = (game) => {
      originalRenderLobby(game);

      const currentPlayer = game.players.find((player) => player.id === currentPlayerIdFromApp());
      const isHost = Boolean(currentPlayer?.isHost);
      const hint = document.getElementById("tableHint");

      if (hint) {
        hint.textContent = isHost && game.status === "lobby"
          ? "Træk spillerne mellem pladserne, for at ændre rækkefølgen"
          : "Host styrer bordplacering";
      }

      renderCopyCodeButton(game, isHost);
      renderPlayerMessages(game);
    };
    window.renderLobby = renderLobby;
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
    const copyButton = event.target.closest(".copy-code-button");
    if (copyButton) {
      copyGameCode(copyButton.dataset.copyCode || "", copyButton);
      return;
    }

    if (!event.target.closest(".player-chat-button")) return;
    submitMessage();
  });
})();
