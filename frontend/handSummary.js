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

  function awardedPotsForGame(game) {
    const hand = game.hand;
    return hand.awardedPots && hand.awardedPots.length > 0
      ? hand.awardedPots
      : [
          {
            amount: fallbackPot(game),
            winnerPlayerIds: hand.winnerPlayerIds || (hand.winnerPlayerId ? [hand.winnerPlayerId] : []),
            winningHand: hand.winningHand || ""
          }
        ];
  }

  function mergeEquivalentPots(game, pots) {
    const merged = new Map();

    pots.forEach((pot) => {
      const winnerIds = [...(pot.winnerPlayerIds || [])].sort();
      const key = [game.hand.winningReason, winnerIds.join(","), pot.winningHand || ""].join("|");
      const existing = merged.get(key);

      if (existing) {
        existing.amount += Number(pot.amount || 0);
      } else {
        merged.set(key, {
          ...pot,
          winnerPlayerIds: winnerIds,
          amount: Number(pot.amount || 0)
        });
      }
    });

    return [...merged.values()];
  }

  function summarizePot(game, pot) {
    const winnerNames = (pot.winnerPlayerIds || []).map((playerId) => playerName(game, playerId));
    const winners = joinNames(winnerNames);
    const amount = Number(pot.amount || 0);
    const handText = pot.winningHand ? ` med ${pot.winningHand}` : "";

    if (game.hand.winningReason === "fold") {
      return `${winners} vinder ${amount}, fordi alle andre foldede.`;
    }

    if (winnerNames.length > 1) {
      return `${winners} deler ${amount}${handText}.`;
    }

    return `${winners} vinder ${amount}${handText}.`;
  }

  function tableResultSummary(game) {
    const hand = game.hand;
    if (!hand || hand.phase !== "hand_complete") return "";

    return mergeEquivalentPots(game, awardedPotsForGame(game))
      .map((pot) => summarizePot(game, pot))
      .join(" ");
  }

  function handCompleteSummary(game) {
    const hand = game.hand;
    if (!hand || hand.phase !== "hand_complete") return "";

    return `Hånden er færdigspillet. ${tableResultSummary(game)}`;
  }

  function applyHandSummary(game) {
    const hand = game.hand;
    if (!hand || hand.phase !== "hand_complete") return;

    const tableSummary = tableResultSummary(game);
    const summary = handCompleteSummary(game);
    const streetLabel = document.getElementById("streetLabel");
    const gameStatus = document.getElementById("gameStatus");
    const potBox = document.getElementById("potBox");
    const totalPot = potValue(hand) || fallbackPot(game);

    if (streetLabel) streetLabel.textContent = tableSummary;
    if (gameStatus) gameStatus.textContent = summary;
    if (potBox) potBox.textContent = `Pulje: ${totalPot}`;
  }

  window.renderGame = function renderGameWithHandSummary(game) {
    originalRenderGame(game);
    applyHandSummary(game);
  };
})();
