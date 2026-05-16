(function () {
  const originalRenderGame = window.renderGame;
  const chipValues = [10, 20, 50, 100, 500];
  const stackValues = [500, 100, 50, 20, 10];
  const visualSlotsByPlayerCount = {
    2: [3, 0],
    3: [3, 5, 1],
    4: [3, 4, 0, 2],
    5: [3, 4, 5, 1, 2],
    6: [3, 4, 5, 0, 1, 2]
  };
  const potScatter = [
    { x: -10, y: -8, r: -8 },
    { x: 10, y: -8, r: 9 },
    { x: -18, y: 10, r: 12 },
    { x: 2, y: 11, r: -11 },
    { x: 22, y: 8, r: 6 }
  ];

  if (typeof originalRenderGame !== "function") return;

  function ownPlayerIdFromGame(game) {
    return Object.keys(game.hand?.holeCards || {})[0] || "";
  }

  function chipClass(value) {
    return `chip-${value}`;
  }

  function makeChip(value, className = "bet-chip") {
    const chip = document.createElement("span");
    chip.className = `${className} ${chipClass(value)}`;
    chip.textContent = value;
    chip.title = `${value} units`;
    return chip;
  }

  function amountAsChips(amount, values = stackValues, maxChips = 12) {
    const chips = [];
    let rest = Math.max(0, Number(amount) || 0);

    values.forEach((value) => {
      while (rest >= value && chips.length < maxChips) {
        chips.push(value);
        rest -= value;
      }
    });

    return { chips, rest };
  }

  function amountAsCompactChips(amount, maxChips = 5) {
    const normalizedAmount = Math.max(0, Number(amount) || 0);
    if (normalizedAmount === 0) return { chips: [], rest: 0 };

    const bestByAmount = new Map([[0, []]]);

    for (let current = 0; current <= normalizedAmount; current += 10) {
      const currentChips = bestByAmount.get(current);
      if (!currentChips) continue;

      stackValues.forEach((value) => {
        const nextAmount = current + value;
        if (nextAmount > normalizedAmount) return;

        const candidate = [...currentChips, value].sort((first, second) => second - first);
        const existing = bestByAmount.get(nextAmount);

        if (!existing || candidate.length < existing.length) {
          bestByAmount.set(nextAmount, candidate);
        }
      });
    }

    const chips = bestByAmount.get(normalizedAmount) || [];

    if (chips.length <= maxChips) {
      return { chips, rest: 0 };
    }

    return amountAsChips(normalizedAmount, stackValues, maxChips);
  }

  function activeBetTotal(hand) {
    return Object.values(hand?.bets || {}).reduce((sum, amount) => sum + Number(amount || 0), 0);
  }

  function collectedPotAmount(hand) {
    if (!hand) return 0;
    if (["hand_complete", "showdown"].includes(hand.phase)) return Number(hand.pot || 0);
    return Math.max(0, Number(hand.pot || 0) - activeBetTotal(hand));
  }

  function syncDisplayedPot(hand) {
    const potBox = document.getElementById("potBox");
    if (!potBox) return;
    potBox.textContent = `Pot: ${collectedPotAmount(hand)}`;
  }

  function syncChipPreview() {
    const raiseInput = document.getElementById("raiseAmount");
    const total = document.getElementById("chipRaiseTotal");
    const preview = document.getElementById("chipRaisePreview");

    if (!raiseInput || !total || !preview) return;

    const amount = Number(raiseInput.value || 0);
    const { chips, rest } = amountAsCompactChips(amount);

    total.textContent = amount;
    preview.innerHTML = "";
    chips.forEach((value) => preview.appendChild(makeChip(value)));

    if (rest > 0) {
      const more = document.createElement("span");
      more.className = "chip-preview-more";
      more.textContent = `+${rest}`;
      preview.appendChild(more);
    }
  }

  function setRaiseAmount(amount) {
    const raiseInput = document.getElementById("raiseAmount");
    if (!raiseInput) return;

    const min = Number(raiseInput.min || 0);
    raiseInput.value = Math.max(min, amount);
    raiseInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function enhanceChipControls() {
    const actionPanel = document.getElementById("actionPanel");
    const raiseInput = document.getElementById("raiseAmount");

    if (!actionPanel || !raiseInput || document.getElementById("chipBetPanel")) {
      syncChipPreview();
      return;
    }

    const panel = document.createElement("div");
    panel.className = "chip-bet-panel";
    panel.id = "chipBetPanel";
    panel.innerHTML = `
      <div class="chip-bet-total">
        <span>Raise til</span>
        <strong id="chipRaiseTotal">${raiseInput.value}</strong>
      </div>
      <div class="chip-preview" id="chipRaisePreview"></div>
      <div class="chip-button-row" id="chipButtonRow"></div>
    `;

    const chipButtonRow = panel.querySelector("#chipButtonRow");
    chipValues.forEach((value) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip-button";
      button.title = `Læg ${value} til raise`;
      button.appendChild(makeChip(value));
      button.addEventListener("click", () => {
        setRaiseAmount(Number(raiseInput.value || 0) + value);
      });
      chipButtonRow.appendChild(button);
    });

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "chip-reset-button";
    resetButton.textContent = "Min";
    resetButton.addEventListener("click", () => {
      setRaiseAmount(Number(raiseInput.min || 0));
    });
    chipButtonRow.appendChild(resetButton);

    raiseInput.closest("label").after(panel);
    raiseInput.addEventListener("input", syncChipPreview);
    syncChipPreview();
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

  function decorateStackChips(game) {
    document.querySelectorAll(".seat-chip-stack").forEach((item) => item.remove());

    const orderedPlayers = orderedPlayersForPerspective(game);
    const visualSlots = visualSlotsByPlayerCount[orderedPlayers.length] || visualSlotsByPlayerCount[6];

    orderedPlayers.forEach((player, index) => {
      const seat = document.getElementById(`gameSeat${visualSlots[index]}`);
      if (!seat || seat.style.display === "none") return;

      const cluster = document.createElement("div");
      cluster.className = "seat-chip-stack";

      amountAsCompactChips(player.stack, 5).chips.forEach((value) => {
        cluster.appendChild(makeChip(value, "stack-chip"));
      });

      seat.appendChild(cluster);
    });
  }

  function makeTableChip(value, index, type) {
    const chip = makeChip(value, `table-chip ${type}`);
    const scatter = potScatter[index % potScatter.length];
    chip.style.setProperty("--chip-x", `${scatter.x}px`);
    chip.style.setProperty("--chip-y", `${scatter.y}px`);
    chip.style.setProperty("--chip-r", `${scatter.r}deg`);
    chip.style.setProperty("--chip-z", String(index));
    return chip;
  }

  function addRemainder(container, rest) {
    if (rest <= 0) return;
    const more = document.createElement("span");
    more.className = "table-chip-more";
    more.textContent = `+${rest}`;
    container.appendChild(more);
  }

  function renderPotChips(game) {
    const hand = game.hand;
    const table = document.querySelector(".game-table");
    if (!table || !hand) return;

    document.querySelectorAll(".table-chip-layer").forEach((item) => item.remove());

    const layer = document.createElement("div");
    layer.className = "table-chip-layer";
    table.appendChild(layer);

    const potAmount = collectedPotAmount(hand);
    if (potAmount > 0) {
      const pot = document.createElement("div");
      pot.className = "pot-chip-scatter";
      pot.setAttribute("aria-label", `Pulje ${potAmount}`);

      const { chips, rest } = amountAsCompactChips(potAmount, 5);
      chips.forEach((value, index) => pot.appendChild(makeTableChip(value, index, "pot-table-chip")));
      addRemainder(pot, rest);
      layer.appendChild(pot);
    }

    renderBetChips(game, layer);
  }

  function betPositionForSeat(seat, layer) {
    const seatRect = seat.getBoundingClientRect();
    const layerRect = layer.getBoundingClientRect();

    if (!layerRect.width || !layerRect.height) {
      return { x: 50, y: 50 };
    }

    const seatX = ((seatRect.left + seatRect.width / 2 - layerRect.left) / layerRect.width) * 100;
    const seatY = ((seatRect.top + seatRect.height / 2 - layerRect.top) / layerRect.height) * 100;

    return {
      x: seatX + (50 - seatX) * 0.28,
      y: seatY + (50 - seatY) * 0.28
    };
  }

  function renderBetChips(game, layer) {
    const hand = game.hand;

    (game.players || []).forEach((player) => {
      const amount = Number(hand.bets?.[player.id] || 0);
      if (amount <= 0) return;

      const seat = Array.from(document.querySelectorAll(".game-seat")).find((item) => {
        return item.dataset.playerId === player.id && item.style.display !== "none";
      });
      if (!seat) return;

      const position = betPositionForSeat(seat, layer);
      const bet = document.createElement("div");
      bet.className = "player-bet-chips";
      bet.style.left = `${position.x}%`;
      bet.style.top = `${position.y}%`;
      bet.setAttribute("aria-label", `${player.name} har bettet ${amount}`);

      const { chips, rest } = amountAsCompactChips(amount, 5);
      chips.forEach((value, chipIndex) => {
        const chip = makeChip(value, "table-chip bet-table-chip");
        if (chipIndex === 0) chip.classList.add("is-first-bet-chip");
        chip.style.setProperty("--bet-chip-y", `${chipIndex % 2 === 0 ? 0 : -3}px`);
        chip.style.setProperty("--bet-chip-r", `${chipIndex * 10}deg`);
        bet.appendChild(chip);
      });
      addRemainder(bet, rest);
      layer.appendChild(bet);
    });
  }

  window.renderGame = function renderGameWithChips(game) {
    originalRenderGame(game);
    enhanceChipControls();
    decorateStackChips(game);
    syncDisplayedPot(game.hand);
    renderPotChips(game);
  };
})();
