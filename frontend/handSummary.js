(function () {
  const originalRenderGame = window.renderGame;

  if (typeof originalRenderGame !== "function") return;

  function playerName(game, playerId) {
    return game.players.find((player) => player.id === playerId)?.name || "Ukendt spiller";
  }

  function joinNames(names) {
    if (names.length <= 1) return names[0] || "";
    if (names.length === 2) return `${names[0]} og ${names[1]}`;
    return `${names.slice(0, -1).join(", ")} og ${names[names.length - 1]}`;
  }

  function potValue(hand) {
    return (hand.awardedPots || []).reduce((sum, pot) => sum + Number(pot.amount || 0), 0);
  }

  function fallbackPot(game) {
    return Object.values(game.hand?.contributions || {}).reduce((sum, amount) => sum + Number(amount || 0), 0);
  }

  function summarizePot(game, pot, index, totalPots) {
    const winnerNames = (pot.winnerPlayerIds || []).map((playerId) => playerName(game, playerId));
    const winners = joinNames(winnerNames);
    const amount = Number(pot.amount || 0);
    const potName = totalPots > 1 ? (index === 0 ? "hovedpuljen" : "sidepuljen") : "puljen";
    const handText = pot.winningHand ? ` med ${pot.winningHand}` : "";

    if (game.hand.winningReason === "fold") {
      return `${winners} vinder ${potName} på ${amount}, fordi alle andre foldede.`;
    }

    if (winnerNames.length > 1) {
      return `${winners} deler ${potName} på ${amount}${handText}.`;
    }

    return `${winners} vinder ${potName} på ${amount}${handText}.`;
  }

  function handCompleteSummary(game) {
    const hand = game.hand;
    if (!hand || hand.phase !== "hand_complete") return "";

    const awardedPots =
      hand.awardedPots && hand.awardedPots.length > 0
        ? hand.awardedPots
        : [
            {
              amount: fallbackPot(game),
              winnerPlayerIds: hand.winnerPlayerIds || (hand.winnerPlayerId ? [hand.winnerPlayerId] : []),
              winningHand: hand.winningHand || ""
            }
          ];

    const summaries = awardedPots.map((pot, index) => summarizePot(game, pot, index, awardedPots.length));
    return `Hånden er færdigspillet. ${summaries.join(" ")}`;
  }

  function applyHandSummary(game) {
    const hand = game.hand;
    if (!hand || hand.phase !== "hand_complete") return;

    const summary = handCompleteSummary(game);
    const streetLabel = document.getElementById("streetLabel");
    const gameStatus = document.getElementById("gameStatus");
    const potBox = document.getElementById("potBox");
    const totalPot = potValue(hand) || fallbackPot(game);

    if (streetLabel) streetLabel.textContent = "Hånden er færdigspillet";
    if (gameStatus) gameStatus.textContent = summary;
    if (potBox) potBox.textContent = `Pulje: ${totalPot}`;
  }

  window.renderGame = function renderGameWithHandSummary(game) {
    originalRenderGame(game);
    applyHandSummary(game);
  };
})();
