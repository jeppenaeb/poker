const CATEGORY_NAMES = {
  8: "Straight flush",
  7: "Fire ens",
  6: "Fuldt hus",
  5: "Flush",
  4: "Straight",
  3: "Tre ens",
  2: "To par",
  1: "Par",
  0: "H\u00f8jt kort"
};

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

function singleRankName(value) {
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

function madeRankName(value) {
  const names = {
    14: "esser",
    13: "konger",
    12: "damer",
    11: "kn\u00e6gte",
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

    for (let i = start; i <= items.length - (size - picked.length); i += 1) {
      walk(i + 1, [...picked, items[i]]);
    }
  }

  walk(0, []);
  return result;
}

function straightHigh(values) {
  const unique = [...new Set(values)].sort((a, b) => a - b);

  if (unique.length !== 5) return 0;
  if (unique.join(",") === "2,3,4,5,14") return 5;

  return unique[4] - unique[0] === 4 ? unique[4] : 0;
}

function compareEvaluations(left, right) {
  if (!right) return 1;
  if (left.category !== right.category) return left.category - right.category;

  const length = Math.max(left.tiebreakers.length, right.tiebreakers.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left.tiebreakers[i] || 0) - (right.tiebreakers[i] || 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

function describeEvaluation(evaluation) {
  const [first, second] = evaluation.tiebreakers;

  if (evaluation.category === 8 && first === 14) return "Royal flush";
  if (evaluation.category === 7) return `Fire ${madeRankName(first)}`;
  if (evaluation.category === 3) return `Tre ${madeRankName(first)}`;
  if (evaluation.category === 2) return `To par, ${singleRankName(first)} og ${singleRankName(second)}`;
  if (evaluation.category === 1) return `Par ${singleRankName(first)}`;
  if (evaluation.category === 0) return `H\u00f8jt kort ${singleRankName(first)}`;

  return CATEGORY_NAMES[evaluation.category];
}

function evaluateFiveCards(cards) {
  const values = cards.map(rankValue).sort((a, b) => b - a);
  const flush = cards.every((card) => card[0] === cards[0][0]);
  const straight = straightHigh(values);
  const counts = values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  const groups = Object.entries(counts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

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
  evaluation.name = describeEvaluation(evaluation);
  return evaluation;
}

function evaluateBestHand(cards) {
  if (!Array.isArray(cards) || cards.length < 5) {
    throw new Error("NOT_ENOUGH_CARDS_TO_EVALUATE");
  }

  return combinations(cards, 5).reduce((best, candidate) => {
    const evaluation = evaluateFiveCards(candidate);
    return compareEvaluations(evaluation, best) > 0 ? evaluation : best;
  }, null);
}

module.exports = {
  compareEvaluations,
  evaluateBestHand
};
