(function () {
  function currentPlayerIdFromApp() {
    if (window.pokerCurrentPlayerId) return window.pokerCurrentPlayerId;
    return typeof currentPlayerId === "undefined" ? "" : currentPlayerId;
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
    const ownPlayerId = currentPlayerIdFromApp();
    const ownCards = game.hand?.holeCards?.[ownPlayerId] || [];
    const description = holeDescription(ownCards);
    const handStrength = document.getElementById("handStrength");

    if (!handStrength || !description) return;

    handStrength.textContent = `${handStrength.textContent} · ${description}`;
  }

  if (typeof renderGame === "function") {
    const originalRenderGame = window.renderGame || renderGame;
    window.renderGame = (game) => {
      originalRenderGame(game);
      applyHoleDescription(game);
    };
    renderGame = window.renderGame;
  }
})();
