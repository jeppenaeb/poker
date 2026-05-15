(function () {
  const originalRenderGame = window.renderGame;
  if (typeof originalRenderGame !== "function") return;

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

  function singleRankName(value) {
    const names = {
      14: "es",
      13: "konge",
      12: "dame",
      11: "knægt",
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

  function madeRankName(value) {
    const names = {
      14: "esser",
      13: "konger",
      12: "damer",
      11: "knægte",
      10: "10ere",
      9: "9ere",
      8: "8ere",
      7: "7ere",
      6: "6ere",
      5: "5ere",
      4: "4ere",
      3: "3ere",
      2: "2ere"
    };

    return names[value] || "";
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

  function describeEvaluation(evaluation) {
    const [first, second] = evaluation.tiebreakers;

    if (evaluation.category === 8 && first === 14) return "Royal flush";
    if (evaluation.category === 8) return "Straight flush";
    if (evaluation.category === 7) return `Fire ${madeRankName(first)}`;
    if (evaluation.category === 6) return "Fuldt hus";
    if (evaluation.category === 5) return "Flush";
    if (evaluation.category === 4) return "Straight";
    if (evaluation.category === 3) return `Tre ${madeRankName(first)}`;
    if (evaluation.category === 2) return `To par, ${singleRankName(first)} og ${singleRankName(second)}`;
    if (evaluation.category === 1) return `Par ${singleRankName(first)}`;
    return `Højt kort ${singleRankName(first)}`;
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

    evaluation.name = describeEvaluation(evaluation);
    return evaluation;
  }

  function bestHandName(cards) {
    if (!Array.isArray(cards) || cards.length < 5) return "-";

    const best = combinations(cards, 5).reduce((currentBest, candidate) => {
      const evaluation = evaluateFiveCards(candidate);
      return compareEvaluations(evaluation, currentBest) > 0 ? evaluation : currentBest;
    }, null);

    return best?.name || "-";
  }

  function ownPlayerIdFromGame(game) {
    return typeof currentPlayerId === "undefined" ? Object.keys(game.hand?.holeCards || {})[0] || "" : currentPlayerId;
  }

  function updateHandStrength(game) {
    const handStrength = document.getElementById("handStrength");
    const ownPlayerId = ownPlayerIdFromGame(game);
    const ownCards = game.hand?.holeCards?.[ownPlayerId] || [];
    const communityCards = game.hand?.communityCards || [];

    if (!handStrength) return;
    handStrength.textContent = `Din hånd: ${bestHandName([...ownCards, ...communityCards])}`;
  }

  window.renderGame = function renderGameWithBestHandDisplay(game) {
    originalRenderGame(game);
    updateHandStrength(game);
  };

  renderGame = window.renderGame;
})();
