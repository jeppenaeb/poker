(function () {
  const originalRenderGame = window.renderGame;
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

  function rankValue(card) {
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

    return values[card.slice(1)] || 0;
  }

  function combinations(items, size) {
    const result = [];

    function walk(start, picked) {
      if (picked.length === size) {
        result.push(picked);
        return;
      }

      for (let index = start; index <= items.length - (size - picked.length); index += 1) {
        walk(index + 1, [...picked, items[index]]);
      }
    }

    walk(0, []);
    return result;
  }

  function straightHigh(values) {
    const unique = [...new Set(values)].sort((first, second) => first - second);

    if (unique.length !== 5) return 0;
    if (unique.join(",") === "2,3,4,5,14") return 5;

    return unique[4] - unique[0] === 4 ? unique[4] : 0;
  }

  function compareEvaluations(left, right) {
    if (!right) return 1;
    if (left.category !== right.category) return left.category - right.category;

    const length = Math.max(left.tiebreakers.length, right.tiebreakers.length);
    for (let index = 0; index < length; index += 1) {
      const diff = (left.tiebreakers[index] || 0) - (right.tiebreakers[index] || 0);
      if (diff !== 0) return diff;
    }

    return 0;
  }

  function evaluateFiveCards(cards) {
    const values = cards.map(rankValue).sort((first, second) => second - first);
    const flush = cards.every((card) => card[0] === cards[0][0]);
    const straight = straightHigh(values);
    const counts = values.reduce((acc, value) => {
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
    const groups = Object.entries(counts)
      .map(([value, count]) => ({ value: Number(value), count }))
      .sort((first, second) => second.count - first.count || second.value - first.value);

    let evaluation;

    if (flush && straight) {
      evaluation = { category: 8, tiebreakers: [straight] };
    } else if (groups[0].count === 4) {
      evaluation = {
        category: 7,
        tiebreakers: [groups[0].value, groups.find((group) => group.count === 1).value]
      };
    } else if (groups[0].count === 3 && groups[1].count === 2) {
      evaluation = { category: 6, tiebreakers: [groups[0].value, groups[1].value] };
    } else if (flush) {
      evaluation = { category: 5, tiebreakers: values };
    } else if (straight) {
      evaluation = { category: 4, tiebreakers: [straight] };
    } else if (groups[0].count === 3) {
      evaluation = {
        category: 3,
        tiebreakers: [
          groups[0].value,
          ...groups.filter((group) => group.count === 1).map((group) => group.value)
        ]
      };
    } else if (groups[0].count === 2 && groups[1].count === 2) {
      const pairs = groups.filter((group) => group.count === 2).map((group) => group.value);
      const kicker = groups.find((group) => group.count === 1).value;
      evaluation = { category: 2, tiebreakers: [...pairs, kicker] };
    } else if (groups[0].count === 2) {
      evaluation = {
        category: 1,
        tiebreakers: [
          groups[0].value,
          ...groups.filter((group) => group.count === 1).map((group) => group.value)
        ]
      };
    } else {
      evaluation = { category: 0, tiebreakers: values };
    }

    evaluation.cards = cards;
    return evaluation;
  }

  function evaluateBestCards(cards) {
    if (!Array.isArray(cards) || cards.length < 5) return null;

    return combinations(cards, 5).reduce((best, candidate) => {
      const evaluation = evaluateFiveCards(candidate);
      return compareEvaluations(evaluation, best) > 0 ? evaluation : best;
    }, null);
  }

  function cardsMatchingRanks(cards, ...ranks) {
    return cards.filter((card) => ranks.includes(rankValue(card)));
  }

  function scoringCards(evaluation, allCards) {
    if (!evaluation) return new Set();

    const bestFive = evaluation.cards || [];

    switch (evaluation.category) {
      case 0:
        return new Set(cardsMatchingRanks(allCards, evaluation.tiebreakers[0]).slice(0, 1));
      case 1:
        return new Set(cardsMatchingRanks(allCards, evaluation.tiebreakers[0]).slice(0, 2));
      case 2:
        return new Set(cardsMatchingRanks(allCards, evaluation.tiebreakers[0], evaluation.tiebreakers[1]).slice(0, 4));
      case 3:
        return new Set(cardsMatchingRanks(allCards, evaluation.tiebreakers[0]).slice(0, 3));
      case 7:
        return new Set(cardsMatchingRanks(allCards, evaluation.tiebreakers[0]).slice(0, 4));
      case 4:
      case 5:
      case 6:
      case 8:
        return new Set(bestFive);
      default:
        return new Set(bestFive);
    }
  }

  function cardText(card) {
    const suit = card.slice(0, 1);
    const rank = card.slice(1);
    const symbols = {
      S: "♠",
      H: "♥",
      D: "♦",
      C: "♣"
    };
    return `${symbols[suit] || suit}${rank}`;
  }

  function renderMiniCard(card, bestCards, isWinner) {
    const suit = card.slice(0, 1);
    const isRed = suit === "H" || suit === "D";
    const isBest = isWinner && bestCards.has(card);
    return `
      <span class="showdown-mini-card ${isRed ? "is-red" : ""} ${isBest ? "is-best" : "is-neutral"} ${isWinner ? "is-winner-card" : "is-loser-card"}">
        ${cardText(card)}
      </span>
    `;
  }

  function clearShowdownReveals() {
    document.querySelectorAll(".showdown-reveal").forEach((element) => element.remove());
    document.querySelectorAll("#communityCards .card").forEach((card) => {
      card.classList.remove("showdown-board-best", "showdown-board-unused");
    });
  }

  function winningPlayerIds(hand) {
    const ids = new Set(hand.winnerPlayerIds || []);
    (hand.awardedPots || []).forEach((pot) => {
      (pot.winnerPlayerIds || []).forEach((playerId) => ids.add(playerId));
    });
    return ids;
  }

  function bestCardsForPlayer(hand, playerId) {
    const holeCards = hand.revealedHoleCards?.[playerId] || [];
    const allCards = [...holeCards, ...(hand.communityCards || [])];
    const evaluated = evaluateBestCards(allCards);
    return scoringCards(evaluated, allCards);
  }

  function winningBestCards(hand) {
    const winners = winningPlayerIds(hand);
    const bestCards = new Set();

    winners.forEach((playerId) => {
      bestCardsForPlayer(hand, playerId).forEach((card) => bestCards.add(card));
    });

    return bestCards;
  }

  function highlightBoardCards(hand) {
    const bestCards = winningBestCards(hand);
    const boardCards = document.querySelectorAll("#communityCards .card");

    (hand.communityCards || []).forEach((card, index) => {
      const cardElement = boardCards[index];
      if (!cardElement) return;
      cardElement.classList.add(bestCards.has(card) ? "showdown-board-best" : "showdown-board-unused");
    });
  }

  function renderShowdownReveals(game) {
    const hand = game.hand;
    if (!hand || hand.phase !== "hand_complete" || hand.winningReason !== "showdown") return;

    const resultsByPlayer = new Map((hand.showdownResults || []).map((result) => [result.playerId, result]));
    const revealedHoleCards = hand.revealedHoleCards || {};
    const winners = winningPlayerIds(hand);
    const orderedPlayers = orderedPlayersForPerspective(game);
    const visualSlots = visualSlotsByPlayerCount[orderedPlayers.length] || visualSlotsByPlayerCount[6];

    orderedPlayers.forEach((player, index) => {
      const result = resultsByPlayer.get(player.id);
      const holeCards = revealedHoleCards[player.id] || [];
      if (!result || holeCards.length === 0) return;

      const seat = document.getElementById(`gameSeat${visualSlots[index]}`);
      if (!seat || seat.style.display === "none") return;

      const bestCards = bestCardsForPlayer(hand, player.id);
      const isWinner = winners.has(player.id);
      const reveal = document.createElement("div");
      reveal.className = `showdown-reveal ${isWinner ? "is-winner" : "is-loser"}`;
      reveal.innerHTML = `
        ${isWinner ? `<div class="showdown-hand-label">${result.hand}</div>` : ""}
        <div class="showdown-card-row">
          ${holeCards.map((card) => renderMiniCard(card, bestCards, isWinner)).join("")}
        </div>
      `;

      seat.appendChild(reveal);
    });

    highlightBoardCards(hand);
  }

  window.renderGame = function renderGameWithShowdownReveal(game) {
    originalRenderGame(game);
    clearShowdownReveals();
    renderShowdownReveals(game);
  };
})();
