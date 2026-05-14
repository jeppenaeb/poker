(function () {
  const originalRenderGame = window.renderGame;
  const visualSlotsByPlayerCount = {
    2: [3, 0],
    3: [3, 5, 1],
    4: [3, 4, 0, 2],
    5: [3, 4, 5, 1, 2],
    6: [3, 4, 5, 0, 1, 2]
  };

  if (typeof originalRenderGame !== "function") return;

  function ownPlayerIdFromGame(game) {
    return Object.keys(game.hand?.holeCards || {})[0] || "";
  }

  function orderedPlayersForPerspective(game) {
    const ownPlayerId = ownPlayerIdFromGame(game);
    const currentIndex = game.tableSeats.indexOf(ownPlayerId);
    const orderedPlayerIds =
      currentIndex === -1
        ? game.tableSeats
        : [...game.tableSeats.slice(currentIndex), ...game.tableSeats.slice(0, currentIndex)];

    return orderedPlayerIds
      .map((playerId) => game.players.find((player) => player.id === playerId))
      .filter(Boolean);
  }

  function cardText(card) {
    const suit = card.slice(0, 1);
    const rank = card.slice(1);
    const symbols = {
      S: "♠",
      H: "♥",
      D: "♦",
      C: "♣"
    };
    return `${symbols[suit] || suit}${rank}`;
  }

  function renderMiniCard(card, bestCards, isWinner) {
    const suit = card.slice(0, 1);
    const isRed = suit === "H" || suit === "D";
    const isBest = isWinner && bestCards.has(card);
    return `
      <span class="showdown-mini-card ${isRed ? "is-red" : ""} ${isBest ? "is-best" : "is-neutral"}">
        ${cardText(card)}
      </span>
    `;
  }

  function clearShowdownReveals() {
    document.querySelectorAll(".showdown-reveal").forEach((element) => element.remove());
    document.querySelectorAll("#communityCards .card").forEach((card) => {
      card.classList.remove("showdown-board-best", "showdown-board-unused");
    });
  }

  function winningPlayerIds(hand) {
    const ids = new Set(hand.winnerPlayerIds || []);
    (hand.awardedPots || []).forEach((pot) => {
      (pot.winnerPlayerIds || []).forEach((playerId) => ids.add(playerId));
    });
    return ids;
  }

  function winningBestCards(hand) {
    const winners = winningPlayerIds(hand);
    const bestCards = new Set();

    (hand.showdownResults || []).forEach((result) => {
      if (!winners.has(result.playerId)) return;
      (result.cards || []).forEach((card) => bestCards.add(card));
    });

    return bestCards;
  }

  function highlightBoardCards(hand) {
    const bestCards = winningBestCards(hand);
    const boardCards = document.querySelectorAll("#communityCards .card");

    (hand.communityCards || []).forEach((card, index) => {
      const cardElement = boardCards[index];
      if (!cardElement) return;
      cardElement.classList.add(bestCards.has(card) ? "showdown-board-best" : "showdown-board-unused");
    });
  }

  function renderShowdownReveals(game) {
    const hand = game.hand;
    if (!hand || hand.phase !== "hand_complete" || hand.winningReason !== "showdown") return;

    const resultsByPlayer = new Map((hand.showdownResults || []).map((result) => [result.playerId, result]));
    const revealedHoleCards = hand.revealedHoleCards || {};
    const winners = winningPlayerIds(hand);
    const orderedPlayers = orderedPlayersForPerspective(game);
    const visualSlots = visualSlotsByPlayerCount[orderedPlayers.length] || visualSlotsByPlayerCount[6];

    orderedPlayers.forEach((player, index) => {
      const result = resultsByPlayer.get(player.id);
      const holeCards = revealedHoleCards[player.id] || [];
      if (!result || holeCards.length === 0) return;

      const seat = document.getElementById(`gameSeat${visualSlots[index]}`);
      if (!seat || seat.style.display === "none") return;

      const bestCards = new Set(result.cards || []);
      const isWinner = winners.has(player.id);
      const reveal = document.createElement("div");
      reveal.className = `showdown-reveal ${isWinner ? "is-winner" : ""}`;
      reveal.innerHTML = `
        <div class="showdown-hand-label">${result.hand}</div>
        <div class="showdown-card-row">
          ${holeCards.map((card) => renderMiniCard(card, bestCards, isWinner)).join("")}
        </div>
      `;

      seat.appendChild(reveal);
    });

    highlightBoardCards(hand);
  }

  window.renderGame = function renderGameWithShowdownReveal(game) {
    originalRenderGame(game);
    clearShowdownReveals();
    renderShowdownReveals(game);
  };
})();
