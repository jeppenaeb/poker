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
