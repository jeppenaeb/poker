(function () {
  const originalRenderGame = window.renderGame;
  if (typeof originalRenderGame !== "function") return;

  const CARD_FLIP_SOUND_URL = "https://pixabay.com/sound-effects/download/522520/";
  let lastHandKey = "";
  let lastCommunityCount = 0;
  let animationId = 0;
  let activeAnimation = null;
  let flipAudio = null;
  let flipAudioPrimed = false;

  function getFlipAudio() {
    if (flipAudio) return flipAudio;

    flipAudio = new Audio(CARD_FLIP_SOUND_URL);
    flipAudio.preload = "auto";
    flipAudio.volume = 0.65;
    return flipAudio;
  }

  function primeFlipAudio() {
    if (flipAudioPrimed) return;

    const audio = getFlipAudio();
    audio.load();
    flipAudioPrimed = true;
  }

  function playFlipSound() {
    const baseAudio = getFlipAudio();
    const audio = baseAudio.cloneNode(true);
    audio.volume = baseAudio.volume;
    audio.play().catch(() => {});
  }

  ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
    window.addEventListener(eventName, primeFlipAudio, { once: true, passive: true });
  });

  function cardLabel(card) {
    if (!card) return "";
    const suit = card.slice(0, 1);
    const rank = card.slice(1);
    const symbols = {
      S: "&spades;",
      H: "&hearts;",
      D: "&diams;",
      C: "&clubs;"
    };
    return `${symbols[suit] || suit}${rank}`;
  }

  function cardClass(card, extraClass = "") {
    const red = card && ["H", "D"].includes(card.slice(0, 1));
    return ["card", red ? "red-card" : "", extraClass].filter(Boolean).join(" ");
  }

  function faceUpCard(card, extraClass = "") {
    return `<div class="${cardClass(card, extraClass)}">${cardLabel(card)}</div>`;
  }

  function faceDownCard() {
    return `<div class="card card-back" aria-label="Kort med bagsiden opad"></div>`;
  }

  function setCommunityHtml(row, htmlParts) {
    const html = htmlParts.join("");
    row.innerHTML = html;

    if (activeAnimation) {
      activeAnimation.currentHtml = html;
    }
  }

  function animateNewCommunityCards(game, fromCount) {
    const row = document.getElementById("communityCards");
    const cards = game.hand?.communityCards || [];
    if (!row || cards.length <= fromCount) return;

    animationId += 1;
    const currentAnimationId = animationId;
    const handKey = `${game.code}-${game.hand.number}`;
    const htmlParts = cards.slice(0, fromCount).map((card) => faceUpCard(card));
    const newCards = cards.slice(fromCount);
    const totalDuration = newCards.length * 1000 + 150;

    activeAnimation = {
      handKey,
      currentHtml: htmlParts.join(""),
      done: false
    };

    setCommunityHtml(row, htmlParts);

    let delay = 0;
    newCards.forEach(() => {
      delay += 500;
      window.setTimeout(() => {
        if (currentAnimationId !== animationId || !activeAnimation) return;
        htmlParts.push(faceDownCard());
        setCommunityHtml(row, htmlParts);
      }, delay);
    });

    newCards.forEach((card, index) => {
      delay += 500;
      window.setTimeout(() => {
        if (currentAnimationId !== animationId || !activeAnimation) return;
        playFlipSound();
        htmlParts[fromCount + index] = faceUpCard(card, "card-revealed");
        setCommunityHtml(row, htmlParts);
      }, delay);
    });

    window.setTimeout(() => {
      if (currentAnimationId !== animationId || !activeAnimation) return;
      activeAnimation.done = true;
      activeAnimation = null;
    }, totalDuration);
  }

  window.renderGame = function renderGameWithCommunityAnimation(game) {
    const hand = game.hand;
    const handKey = hand ? `${game.code}-${hand.number}` : "";
    const communityCards = hand?.communityCards || [];
    const previousHandKey = lastHandKey;
    const previousCommunityCount = lastCommunityCount;

    originalRenderGame(game);

    if (!hand) return;

    if (activeAnimation && !activeAnimation.done && activeAnimation.handKey === handKey) {
      const row = document.getElementById("communityCards");
      if (row) row.innerHTML = activeAnimation.currentHtml;
    }

    if (previousHandKey === handKey && communityCards.length > previousCommunityCount) {
      animateNewCommunityCards(game, previousCommunityCount);
    } else if (previousHandKey !== handKey) {
      animationId += 1;
      activeAnimation = null;
    }

    lastHandKey = handKey;
    lastCommunityCount = communityCards.length;
  };

  renderGame = window.renderGame;
})();
