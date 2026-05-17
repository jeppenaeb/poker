(function () {
  const originalRenderGame = window.renderGame;
  if (typeof originalRenderGame !== "function") return;

  const DEAL_STEP_MS = 500;
  const completedDeals = new Set();
  const dealStates = new Map();
  let latestGame = null;
  let audioContext = null;
  let audioPrimed = false;

  function getAudioContext() {
    if (audioContext) return audioContext;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    audioContext = new AudioContextClass();
    return audioContext;
  }

  function primeDealAudio() {
    const context = getAudioContext();
    if (!context || audioPrimed) return;

    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    audioPrimed = true;
  }

  function playDealSound() {
    const context = getAudioContext();
    if (!context) return;

    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    const now = context.currentTime;
    const duration = 0.12;
    const bufferSize = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < bufferSize; index += 1) {
      const progress = index / bufferSize;
      data[index] = (Math.random() * 2 - 1) * (1 - progress) * 0.55;
    }

    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    const thump = context.createOscillator();
    const thumpGain = context.createGain();

    noise.buffer = buffer;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(1400, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(520, now + duration);
    noiseFilter.Q.setValueAtTime(0.7, now);

    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.12, now + 0.012);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    thump.type = "triangle";
    thump.frequency.setValueAtTime(115, now);
    thump.frequency.exponentialRampToValueAtTime(76, now + 0.09);
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.045, now + 0.01);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(context.destination);

    thump.connect(thumpGain);
    thumpGain.connect(context.destination);

    noise.start(now);
    noise.stop(now + duration);
    thump.start(now);
    thump.stop(now + 0.1);
  }

  ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
    window.addEventListener(eventName, primeDealAudio, { once: true, passive: true });
  });

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

  function activeSeatIds(game) {
    const activePlayers = new Set(
      (game.players || [])
        .filter((player) => player.status === "active")
        .map((player) => player.id)
    );

    return (game.tableSeats || []).filter((playerId) => activePlayers.has(playerId));
  }

  function dealRoundOrder(game) {
    const seats = activeSeatIds(game);
    const dealerId = game.hand?.dealerPlayerId;
    const dealerIndex = seats.indexOf(dealerId);

    if (seats.length === 0) return [];
    if (dealerIndex === -1) return seats;

    return [...seats.slice(dealerIndex + 1), ...seats.slice(0, dealerIndex + 1)];
  }

  function dealOrder(game) {
    const roundOrder = dealRoundOrder(game);
    return [...roundOrder, ...roundOrder];
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

  function freshDeal(game, visibleDealCount) {
    const order = dealOrder(game);
    const playerId = order[visibleDealCount - 1];
    if (!playerId) return null;

    return {
      playerId,
      cardNumber: visibleCardCounts(game, visibleDealCount)[playerId]
    };
  }

  function removeSeatCards() {
    document.querySelectorAll(".dealt-hole-cards").forEach((element) => element.remove());
  }

  function findSeatForPlayer(playerId) {
    return Array.from(document.querySelectorAll(".game-seat")).find((item) => {
      return item.dataset.playerId === playerId && item.style.display !== "none";
    });
  }

  function addSeatCards(game, cardCounts, freshCard = null) {
    removeSeatCards();

    if (!isActiveHand(game.hand)) return;

    Object.entries(cardCounts).forEach(([playerId, count]) => {
      const seat = findSeatForPlayer(playerId);

      if (!seat || count <= 0) return;

      const holder = document.createElement("div");
      holder.className = "dealt-hole-cards";
      holder.dataset.cardCount = String(count);

      for (let index = 0; index < count; index += 1) {
        const cardNumber = index + 1;
        const isFresh = freshCard?.playerId === playerId && freshCard.cardNumber === cardNumber;
        holder.appendChild(createBackCard(isFresh));
      }

      seat.appendChild(holder);
    });
  }

  function showAllSeatCards(game) {
    const counts = {};
    activeSeatIds(game).forEach((playerId) => {
      counts[playerId] = 2;
    });
    addSeatCards(game, counts);
  }

  function setDealingDockState(isDealing) {
    const dock = document.getElementById("playerDock");
    dock?.classList.toggle("is-dealing-hand", isDealing);
  }

  function hidePlayerActionsWhileDealing() {
    const panel = document.getElementById("actionPanel");
    const status = document.getElementById("gameStatus");

    if (panel) panel.hidden = true;
    setDealingDockState(true);
    if (status) status.textContent = "Dealer kort...";
  }

  function finishDeal(key) {
    completedDeals.add(key);
    dealStates.delete(key);
    setDealingDockState(false);

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
        playDealSound();
        addSeatCards(
          latestGame,
          visibleCardCounts(latestGame, currentState.visibleCount),
          freshDeal(latestGame, currentState.visibleCount)
        );
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
      setDealingDockState(false);
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
    setDealingDockState(false);
    showAllSeatCards(game);
  }

  window.renderGame = function renderGameWithDealAnimation(game) {
    originalRenderGame(game);
    applyDealState(game);
  };

  renderGame = window.renderGame;
})();
