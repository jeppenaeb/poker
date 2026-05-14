(function () {
  const originalRenderGame = window.renderGame;

  if (typeof originalRenderGame !== "function") return;

  function rankValue(card) {
    const rank = card.slice(1);
    const values = {
      "2": 2,
      "3": 3,
      "4": 4,
      "5": 5,
      "6": 6,
      "7": 7,
      "8": 8,
      "9": 9,
      "10": 10,
      J: 11,
      Q: 12,
      K: 13,
      A: 14
    };

    return values[rank] || 0;
  }

  function rankName(value) {
    const names = {
      14: "esser",
      13: "konger",
      12: "damer",
      11: "kn\u00e6gte",
      10: "tiere",
      9: "niere",
      8: "ottere",
      7: "syvere",
      6: "seksere",
      5: "femmere",
      4: "firere",
      3: "treere",
      2: "toere"
    };

    return names[value] || "";
  }

  function highCardName(value) {
    const names = {
      14: "es",
      13: "konge",
      12: "dame",
      11: "kn\u00e6gt",
      10: "10",
      9: "9",
      8: "8",
      7: "7",
      6: "6",
      5: "5",
      4: "4",
      3: "3",
      2: "2"
    };

    return names[value] || "";
  }

  function hasStraight(values) {
    const unique = [...new Set(values)].sort((a, b) => a - b);
    if (unique.includes(14)) unique.unshift(1);

    let run = 1;
    for (let i = 1; i < unique.length; i += 1) {
      if (unique[i] === unique[i - 1] + 1) {
        run += 1;
        if (run >= 5) return true;
      } else {
        run = 1;
      }
    }

    return false;
  }

  function evaluateDisplayHand(cards) {
    if (!cards || cards.length < 2) return "-";

    const values = cards.map(rankValue).filter(Boolean);
    const counts = values.reduce((acc, value) => {
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
    const grouped = Object.entries(counts)
      .map(([value, count]) => ({ value: Number(value), count }))
      .sort((a, b) => b.count - a.count || b.value - a.value);

    const suits = cards.reduce((acc, card) => {
      const suit = card.slice(0, 1);
      acc[suit] = acc[suit] || [];
      acc[suit].push(rankValue(card));
      return acc;
    }, {});
    const flushValues = Object.values(suits).find((items) => items.length >= 5);
    const straight = hasStraight(values);
    const straightFlush = flushValues ? hasStraight(flushValues) : false;

    if (straightFlush && flushValues.includes(14) && flushValues.includes(13)) return "Royal flush";
    if (straightFlush) return "Straight flush";
    if (grouped[0]?.count === 4) return `Fire ens, ${rankName(grouped[0].value)}`;
    if (grouped[0]?.count === 3 && grouped.some((item, index) => index > 0 && item.count >= 2)) return "Fuldt hus";
    if (flushValues) return "Flush";
    if (straight) return "Straight";
    if (grouped[0]?.count === 3) return `Tre ens, ${rankName(grouped[0].value)}`;

    const pairs = grouped.filter((item) => item.count === 2);
    if (pairs.length >= 2) return `To par, ${rankName(pairs[0].value)} og ${rankName(pairs[1].value)}`;
    if (pairs.length === 1) return `Par ${rankName(pairs[0].value)}`;

    return `H\u00f8jt kort ${highCardName(Math.max(...values))}`;
  }

  function updateHandStrength(hand) {
    const handStrength = document.getElementById("handStrength");
    const ownPlayerId = Object.keys(hand.holeCards || {})[0];
    const ownCards = ownPlayerId ? hand.holeCards[ownPlayerId] || [] : [];

    if (!handStrength || ownCards.length === 0) return;
    handStrength.textContent = `Din h\u00e5nd: ${evaluateDisplayHand([...ownCards, ...hand.communityCards])}`;
  }

  window.renderGame = function renderGameWithFoldedPlayers(game) {
    originalRenderGame(game);

    const hand = game.hand;
    if (!hand) return;

    updateHandStrength(hand);

    if (!Array.isArray(hand.foldedPlayerIds)) return;

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
