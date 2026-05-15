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
  const betPositions = {
    0: { x: 50, y: 27 },
    1: { x: 70, y: 36 },
    2: { x: 70, y: 54 },
    3: { x: 50, y: 62 },
    4: { x: 30, y: 54 },
    5: { x: 30, y: 36 }
  };
  const potScatter = [
    { x: -22, y: -8, r: -12 },
    { x: 0, y: -13, r: 8 },
    { x: 22, y: -7, r: 17 },
    { x: -12, y: 10, r: 12 },
    { x: 13, y: 11, r: -9 },
    { x: 34, y: 8, r: 6 },
    { x: -32, y: 8, r: -5 },
    { x: 0, y: 18, r: 15 }
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

  function syncChipPreview() {
    const raiseInput = document.getElementById("raiseAmount");
    const total = document.getElementById("chipRaiseTotal");
    const preview = document.getElementById("chipRaisePreview");

    if (!raiseInput || !total || !preview) return;

    const amount = Number(raiseInput.value || 0);
    const { chips, rest } = amountAsChips(amount);

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

      amountAsChips(player.stack, stackValues, 5).chips.forEach((value) => {
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

    const potAmount = Math.max(0, Number(hand.pot || 0));
    if (potAmount > 0) {
      const pot = document.createElement("div");
      pot.className = "pot-chip-scatter";
      pot.setAttribute("aria-label", `Pulje ${potAmount}`);

      const { chips, rest } = amountAsChips(potAmount, stackValues, 14);
      chips.forEach((value, index) => pot.appendChild(makeTableChip(value, index, "pot-table-chip")));
      addRemainder(pot, rest);
      layer.appendChild(pot);
    }

    renderBetChips(game, layer);
    table.appendChild(layer);
  }

  function renderBetChips(game, layer) {
    const hand = game.hand;
    const orderedPlayers = orderedPlayersForPerspective(game);
    const visualSlots = visualSlotsByPlayerCount[orderedPlayers.length] || visualSlotsByPlayerCount[6];

    orderedPlayers.forEach((player, index) => {
      const amount = Number(hand.bets?.[player.id] || 0);
      if (amount <= 0) return;

      const visualSlot = visualSlots[index];
      const position = betPositions[visualSlot];
      if (!position) return;

      const bet = document.createElement("div");
      bet.className = `player-bet-chips player-bet-slot-${visualSlot}`;
      bet.style.left = `${position.x}%`;
      bet.style.top = `${position.y}%`;
      bet.setAttribute("aria-label", `${player.name} har bettet ${amount}`);

      const label = document.createElement("span");
      label.className = "player-bet-chip-label";
      label.textContent = amount;
      bet.appendChild(label);

      const { chips, rest } = amountAsChips(amount, stackValues, 8);
      chips.forEach((value, chipIndex) => {
        const chip = makeChip(value, "table-chip bet-table-chip");
        chip.style.setProperty("--bet-chip-i", String(chipIndex));
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
    renderPotChips(game);
  };
})();
