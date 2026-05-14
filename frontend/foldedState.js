(function () {
  const originalRenderGame = window.renderGame;

  if (typeof originalRenderGame !== "function") return;

  window.renderGame = function renderGameWithFoldedPlayers(game) {
    originalRenderGame(game);

    const hand = game.hand;
    if (!hand || !Array.isArray(hand.foldedPlayerIds)) return;

    for (let i = 0; i < 6; i += 1) {
      const seat = document.getElementById(`gameSeat${i}`);
      const playerId = game.tableSeats[i];

      if (!seat || !playerId || seat.style.display === "none") continue;

      const isFolded = hand.foldedPlayerIds.includes(playerId);
      seat.classList.toggle("is-folded", isFolded);

      if (isFolded) {
        seat.classList.remove("is-current");
      }

      const existingStamp = seat.querySelector(".folded-stamp");

      if (isFolded && !existingStamp) {
        const stamp = document.createElement("div");
        stamp.className = "folded-stamp";
        stamp.textContent = "Folded";
        seat.appendChild(stamp);
      }

      if (!isFolded && existingStamp) {
        existingStamp.remove();
      }
    }
  };
})();
