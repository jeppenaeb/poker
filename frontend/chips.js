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

  window.renderGame = function renderGameWithChips(game) {
    originalRenderGame(game);
    enhanceChipControls();
    decorateStackChips(game);
  };
})();
