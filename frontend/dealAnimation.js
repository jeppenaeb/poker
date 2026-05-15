(function () {
  const originalRenderGame = window.renderGame;
  if (typeof originalRenderGame !== "function") return;

  const DEAL_STEP_MS = 500;
  const completedDeals = new Set();
  const dealStates = new Map();
  let latestGame = null;

  function handKey(game) {
    return game?.hand ? `${game.code}-${game.hand.number}` : "";
  }

  function isActiveHand(hand) {
    return hand && !["showdown", "hand_complete"].includes(hand.phase);
  }

  function shouldAnimateDeal(game) {
    const hand = game.hand;
    if (!hand || hand.phase !== "preflop") return false;
    if ((hand.actionLog || []).length > 0) return false;
    return !completedDeals.has(handKey(game));
  }

  function dealOrder(game) {
    const activeIds = new Set(Object.keys(game.hand?.holeCards || {}));
    const seats = (game.tableSeats || []).filter((playerId) => activeIds.has(playerId));
    return [...seats, ...seats];
  }

  function createBackCard(isFresh) {
    const card = document.createElement("span");
    card.className = `seat-hole-card-back${isFresh ? " is-dealt-now" : ""}`;
    card.setAttribute("aria-label", "Skjult kort");
    return card;
  }

  function visibleCardCounts(game, visibleDealCount) {
    const counts = {};
    const order = dealOrder(game);

    order.slice(0, visibleDealCount).forEach((playerId) => {
      counts[playerId] = Math.min(2, (counts[playerId] || 0) + 1);
    });

    return counts;
  }

  function removeSeatCards() {
    document.querySelectorAll(".dealt-hole-cards").forEach((element) => element.remove());
  }

  function addSeatCards(game, cardCounts) {
    removeSeatCards();

    if (!isActiveHand(game.hand)) return;

    Object.entries(cardCounts).forEach(([playerId, count]) => {
      const seat = Array.from(document.querySelectorAll(".game-seat")).find((item) => {
        return item.dataset.playerId === playerId && item.style.display !== "none";
      });

      if (!seat || count <= 0) return;

      const holder = document.createElement("div");
      holder.className = "dealt-hole-cards";
      holder.dataset.cardCount = String(count);

      for (let index = 0; index < count; index += 1) {
        holder.appendChild(createBackCard(index === count - 1));
      }

      seat.appendChild(holder);
    });
  }

  function showAllSeatCards(game) {
    const counts = {};
    (game.tableSeats || []).forEach((playerId) => {
      if (game.hand?.holeCards?.[playerId]) counts[playerId] = 2;
    });
    addSeatCards(game, counts);
  }

  function hidePlayerActionsWhileDealing() {
    const panel = document.getElementById("actionPanel");
    const dock = document.getElementById("playerDock");
    const status = document.getElementById("gameStatus");

    if (panel) panel.hidden = true;
    dock?.classList.add("is-dealing-hand");
    if (status) status.textContent = "Dealer kort...";
  }

  function finishDeal(key) {
    completedDeals.add(key);
    dealStates.delete(key);

    if (latestGame && handKey(latestGame) === key) {
      window.renderGame(latestGame);
    }
  }

  function startDealAnimation(game) {
    const key = handKey(game);
    const order = dealOrder(game);
    const state = {
      visibleCount: 0,
      totalCount: order.length,
      timers: []
    };

    dealStates.set(key, state);
    addSeatCards(game, {});
    hidePlayerActionsWhileDealing();

    order.forEach((_playerId, index) => {
      const timer = window.setTimeout(() => {
        const currentState = dealStates.get(key);
        if (!currentState || !latestGame || handKey(latestGame) !== key) return;

        currentState.visibleCount = index + 1;
        addSeatCards(latestGame, visibleCardCounts(latestGame, currentState.visibleCount));
      }, DEAL_STEP_MS * (index + 1));
      state.timers.push(timer);
    });

    const finishTimer = window.setTimeout(() => finishDeal(key), DEAL_STEP_MS * (order.length + 1));
    state.timers.push(finishTimer);
  }

  function clearOtherDealTimers(activeKey) {
    dealStates.forEach((state, key) => {
      if (key === activeKey) return;
      state.timers.forEach((timer) => window.clearTimeout(timer));
      dealStates.delete(key);
    });
  }

  function applyDealState(game) {
    const hand = game.hand;
    const key = handKey(game);
    latestGame = game;

    clearOtherDealTimers(key);

    if (!isActiveHand(hand)) {
      removeSeatCards();
      return;
    }

    const activeState = dealStates.get(key);
    if (activeState) {
      addSeatCards(game, visibleCardCounts(game, activeState.visibleCount));
      hidePlayerActionsWhileDealing();
      return;
    }

    if (shouldAnimateDeal(game)) {
      startDealAnimation(game);
      return;
    }

    completedDeals.add(key);
    showAllSeatCards(game);
  }

  window.renderGame = function renderGameWithDealAnimation(game) {
    originalRenderGame(game);
    applyDealState(game);
  };

  renderGame = window.renderGame;
})();
