(function () {
  const originalRenderGame = window.renderGame;

  if (typeof originalRenderGame !== "function") return;

  const visualSlotsByPlayerCount = {
    2: [3, 0],
    3: [3, 5, 1],
    4: [3, 4, 0, 2],
    5: [3, 4, 5, 1, 2],
    6: [3, 4, 5, 0, 1, 2]
  };

  function ownPlayerIdFromGame(game) {
    return Object.keys(game.hand?.holeCards || {})[0] || "";
  }

  function playerOrderFromCurrentPlayer(tableSeats, ownPlayerId) {
    const currentIndex = tableSeats.indexOf(ownPlayerId);

    if (currentIndex === -1) return tableSeats;

    return [...tableSeats.slice(currentIndex), ...tableSeats.slice(0, currentIndex)];
  }

  function clearGameSeats() {
    for (let i = 0; i < 6; i += 1) {
      const seat = document.getElementById(`gameSeat${i}`);
      if (!seat) continue;

      seat.style.display = "none";
      seat.innerHTML = "";
      seat.classList.remove("is-current", "is-you", "is-folded");
    }
  }

  function renderSeat(seat, game, hand, player, ownPlayerId) {
    const isFolded = hand.foldedPlayerIds.includes(player.id);
    const badges = [
      player.id === hand.dealerPlayerId ? "D" : "",
      player.id === hand.smallBlindPlayerId ? "SB" : "",
      player.id === hand.bigBlindPlayerId ? "BB" : ""
    ].filter(Boolean);

    seat.style.display = "";
    seat.classList.toggle("is-current", player.id === hand.currentPlayerId && !isFolded);
    seat.classList.toggle("is-you", player.id === ownPlayerId);
    seat.classList.toggle("is-folded", isFolded);

    seat.innerHTML = `
      <strong>${player.id === ownPlayerId ? "Dig" : player.name}</strong>
      <span>${player.stack} units</span>
      <span>Bet: ${hand.bets[player.id] || 0}</span>
      <div class="badge-line">${badges.map((badge) => `<b>${badge}</b>`).join("")}</div>
      ${isFolded ? `<div class="folded-stamp">Folded</div>` : ""}
    `;
  }

  function applyPerspectiveSeating(game) {
    const hand = game.hand;
    if (!hand || !Array.isArray(game.tableSeats)) return;

    const ownPlayerId = ownPlayerIdFromGame(game);
    const orderedPlayerIds = playerOrderFromCurrentPlayer(game.tableSeats, ownPlayerId).filter((playerId) => {
      return game.players.some((player) => player.id === playerId);
    });
    const visualSlots = visualSlotsByPlayerCount[orderedPlayerIds.length] || visualSlotsByPlayerCount[6];

    clearGameSeats();

    orderedPlayerIds.forEach((playerId, index) => {
      const slotIndex = visualSlots[index];
      const seat = document.getElementById(`gameSeat${slotIndex}`);
      const player = game.players.find((item) => item.id === playerId);

      if (!seat || !player) return;
      renderSeat(seat, game, hand, player, ownPlayerId);
    });
  }

  window.renderGame = function renderGameWithPerspectiveSeating(game) {
    originalRenderGame(game);
    applyPerspectiveSeating(game);
  };
})();
