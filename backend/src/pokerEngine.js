const SUITS = ["S", "H", "D", "C"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const { compareEvaluations, evaluateBestHand } = require("./handEvaluator");

function createDeck() {
  return SUITS.flatMap((suit) => RANKS.map((rank) => `${suit}${rank}`));
}

function shuffleDeck(deck) {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function nextSeatIndex(seats, currentIndex) {
  return (currentIndex + 1) % seats.length;
}

function normalizeSeatsForDealer(tableSeats, dealerPlayerId) {
  const dealerIndex = tableSeats.indexOf(dealerPlayerId);
  if (dealerIndex === -1) throw new Error("DEALER_NOT_IN_SEATS");
  return [...tableSeats.slice(dealerIndex), ...tableSeats.slice(0, dealerIndex)];
}

function pickRandomDealer(tableSeats) {
  return tableSeats[Math.floor(Math.random() * tableSeats.length)];
}

function activeSeatIds(game) {
  return game.tableSeats.filter((playerId) => {
    const player = game.players.find((item) => item.id === playerId);
    return player && player.status === "active" && player.stack > 0;
  });
}

function getPositions(tableSeats) {
  const dealerIndex = 0;

  if (tableSeats.length === 2) {
    return {
      dealerPlayerId: tableSeats[dealerIndex],
      smallBlindPlayerId: tableSeats[dealerIndex],
      bigBlindPlayerId: tableSeats[nextSeatIndex(tableSeats, dealerIndex)],
      firstToActPlayerId: tableSeats[dealerIndex]
    };
  }

  const smallBlindIndex = nextSeatIndex(tableSeats, dealerIndex);
  const bigBlindIndex = nextSeatIndex(tableSeats, smallBlindIndex);
  const firstToActIndex = nextSeatIndex(tableSeats, bigBlindIndex);

  return {
    dealerPlayerId: tableSeats[dealerIndex],
    smallBlindPlayerId: tableSeats[smallBlindIndex],
    bigBlindPlayerId: tableSeats[bigBlindIndex],
    firstToActPlayerId: tableSeats[firstToActIndex]
  };
}

function dealHoleCards(deck, playerIds) {
  const holeCards = {};
  playerIds.forEach((playerId) => {
    holeCards[playerId] = [deck.pop(), deck.pop()];
  });
  return holeCards;
}

function postBlind(player, amount) {
  const paid = Math.min(player.stack, amount);
  player.stack -= paid;
  return paid;
}

function addUnique(list, item) {
  if (!list.includes(item)) list.push(item);
}

function currentBet(hand) {
  return Math.max(0, ...Object.values(hand.bets));
}

function eligiblePlayerIds(game) {
  return game.tableSeats.filter((playerId) => {
    const player = game.players.find((item) => item.id === playerId);
    return player && player.status === "active" && !game.hand.foldedPlayerIds.includes(playerId);
  });
}

function actionablePlayerIds(game) {
  return eligiblePlayerIds(game).filter((playerId) => {
    const player = game.players.find((item) => item.id === playerId);
    return player && player.stack > 0 && !game.hand.allInPlayerIds.includes(playerId);
  });
}

function nextActionPlayerId(game, fromPlayerId) {
  const seats = game.tableSeats;
  let index = seats.indexOf(fromPlayerId);

  for (let i = 0; i < seats.length; i += 1) {
    index = nextSeatIndex(seats, index);
    const playerId = seats[index];
    if (actionablePlayerIds(game).includes(playerId)) return playerId;
  }

  return null;
}

function firstPostFlopPlayerId(game) {
  return nextActionPlayerId(game, game.hand.dealerPlayerId);
}

function resetRoundBets(game) {
  game.tableSeats.forEach((playerId) => {
    game.hand.bets[playerId] = 0;
  });
  game.hand.actedPlayerIds = [];
}

function awardPotToLastPlayer(game) {
  const winnerId = eligiblePlayerIds(game)[0];
  const winner = game.players.find((player) => player.id === winnerId);
  const potAmount = game.hand.pot;

  if (winner) {
    winner.stack += potAmount;
  }

  game.hand.winnerPlayerId = winnerId;
  game.hand.winnerPlayerIds = winnerId ? [winnerId] : [];
  game.hand.awardedPots = [
    {
      amount: potAmount,
      winnerPlayerIds: winnerId ? [winnerId] : [],
      winningHand: ""
    }
  ];
  game.hand.winningHand = "";
  game.hand.winningReason = "fold";
  game.hand.phase = "hand_complete";
  game.hand.currentPlayerId = null;
  game.hand.pot = 0;
}

function addContribution(hand, playerId, amount) {
  hand.contributions[playerId] = (hand.contributions[playerId] || 0) + amount;
}

function evaluateShowdownPlayers(game) {
  const hand = game.hand;

  return eligiblePlayerIds(game).map((playerId) => {
    const cards = [...(hand.holeCards[playerId] || []), ...hand.communityCards];
    return {
      playerId,
      evaluation: evaluateBestHand(cards)
    };
  });
}

function bestPlayersForPot(showdownResults, eligibleWinnerIds) {
  let best = null;
  let winners = [];

  showdownResults
    .filter((result) => eligibleWinnerIds.includes(result.playerId))
    .forEach((result) => {
      const comparison = compareEvaluations(result.evaluation, best);
      if (comparison > 0) {
        best = result.evaluation;
        winners = [result.playerId];
      } else if (comparison === 0) {
        winners.push(result.playerId);
      }
    });

  return { best, winners };
}

function distributePot(game, amount, winnerIds) {
  if (amount <= 0 || winnerIds.length === 0) return;

  const share = Math.floor(amount / winnerIds.length);
  let remainder = amount % winnerIds.length;
  const orderedWinners = game.tableSeats.filter((playerId) => winnerIds.includes(playerId));

  orderedWinners.forEach((playerId) => {
    const player = game.players.find((item) => item.id === playerId);
    if (!player) return;

    player.stack += share + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  });
}

function buildSidePots(game) {
  const hand = game.hand;
  const playerIds = Object.keys(hand.contributions);
  const levels = [...new Set(Object.values(hand.contributions).filter((amount) => amount > 0))].sort((a, b) => a - b);
  const pots = [];
  let previousLevel = 0;

  levels.forEach((level) => {
    const contributors = playerIds.filter((playerId) => hand.contributions[playerId] >= level);
    const amount = (level - previousLevel) * contributors.length;

    if (amount > 0) {
      pots.push({
        amount,
        contributors,
        eligibleWinnerIds: contributors.filter((playerId) => !hand.foldedPlayerIds.includes(playerId))
      });
    }

    previousLevel = level;
  });

  return pots;
}

function settleShowdown(game) {
  const hand = game.hand;
  const showdownResults = evaluateShowdownPlayers(game);
  const pots = buildSidePots(game);
  const awardedPots = [];
  const allWinnerIds = new Set();

  pots.forEach((pot) => {
    const { best, winners } = bestPlayersForPot(showdownResults, pot.eligibleWinnerIds);
    distributePot(game, pot.amount, winners);
    winners.forEach((playerId) => allWinnerIds.add(playerId));

    awardedPots.push({
      amount: pot.amount,
      winnerPlayerIds: winners,
      winningHand: best ? best.name : "-"
    });
  });

  const primaryPot = awardedPots[0];

  hand.phase = "hand_complete";
  hand.currentPlayerId = null;
  hand.winningReason = "showdown";
  hand.winnerPlayerIds = [...allWinnerIds];
  hand.winnerPlayerId = primaryPot?.winnerPlayerIds[0] || null;
  hand.winningHand = primaryPot?.winningHand || "-";
  hand.showdownResults = showdownResults.map((result) => ({
    playerId: result.playerId,
    hand: result.evaluation.name,
    cards: result.evaluation.cards
  }));
  hand.awardedPots = awardedPots;
  hand.pot = 0;
}

function isBettingRoundComplete(game) {
  const playerIds = actionablePlayerIds(game);
  const betToMatch = currentBet(game.hand);

  if (playerIds.length === 0) return true;

  return playerIds.every((playerId) => {
    return game.hand.actedPlayerIds.includes(playerId) && game.hand.bets[playerId] === betToMatch;
  });
}

function advanceStreet(game) {
  const hand = game.hand;

  if (hand.phase === "preflop") {
    hand.phase = "flop";
    hand.communityCards.push(hand.deck.pop(), hand.deck.pop(), hand.deck.pop());
  } else if (hand.phase === "flop") {
    hand.phase = "turn";
    hand.communityCards.push(hand.deck.pop());
  } else if (hand.phase === "turn") {
    hand.phase = "river";
    hand.communityCards.push(hand.deck.pop());
  } else if (hand.phase === "river") {
    settleShowdown(game);
    return;
  }

  resetRoundBets(game);
  hand.currentPlayerId = firstPostFlopPlayerId(game);

  if (!hand.currentPlayerId) {
    advanceStreet(game);
  }
}

function settleAfterAction(game) {
  if (eligiblePlayerIds(game).length === 1) {
    awardPotToLastPlayer(game);
    return;
  }

  if (isBettingRoundComplete(game)) {
    advanceStreet(game);
    return;
  }

  game.hand.currentPlayerId = nextActionPlayerId(game, game.hand.currentPlayerId);
}

function payChips(player, amount) {
  const paid = Math.min(player.stack, Math.max(0, amount));
  player.stack -= paid;
  return paid;
}

function logAction(hand, playerId, action, amount) {
  if (!Array.isArray(hand.actionLog)) hand.actionLog = [];

  hand.actionLog.push({
    playerId,
    action,
    amount: Number.isFinite(Number(amount)) ? Number(amount) : null,
    phase: hand.phase
  });
}

function applyPlayerAction(game, { playerId, action, amount }) {
  if (game.status !== "in_progress" || !game.hand) throw new Error("GAME_NOT_IN_PROGRESS");

  const hand = game.hand;
  const player = game.players.find((item) => item.id === playerId);

  if (!player) throw new Error("PLAYER_NOT_FOUND");
  if (hand.currentPlayerId !== playerId) throw new Error("NOT_PLAYERS_TURN");
  if (hand.phase === "showdown" || hand.phase === "hand_complete") throw new Error("HAND_ALREADY_COMPLETE");

  const playerBet = hand.bets[playerId] || 0;
  const betToMatch = currentBet(hand);
  let loggedAmount = amount;

  if (action === "fold") {
    addUnique(hand.foldedPlayerIds, playerId);
    addUnique(hand.actedPlayerIds, playerId);
  } else if (action === "check") {
    if (playerBet !== betToMatch) throw new Error("CANNOT_CHECK");
    addUnique(hand.actedPlayerIds, playerId);
  } else if (action === "call") {
    const paid = payChips(player, betToMatch - playerBet);
    hand.bets[playerId] = playerBet + paid;
    hand.pot += paid;
    addContribution(hand, playerId, paid);
    if (player.stack === 0) addUnique(hand.allInPlayerIds, playerId);
    addUnique(hand.actedPlayerIds, playerId);
    loggedAmount = hand.bets[playerId];
  } else if (action === "raise") {
    const raiseTo = Number(amount);
    if (!Number.isFinite(raiseTo) || raiseTo <= betToMatch) throw new Error("INVALID_RAISE");
    if (raiseTo > player.stack + playerBet) throw new Error("RAISE_ABOVE_STACK");

    const paid = payChips(player, raiseTo - playerBet);
    hand.bets[playerId] = playerBet + paid;
    hand.pot += paid;
    addContribution(hand, playerId, paid);
    if (player.stack === 0) addUnique(hand.allInPlayerIds, playerId);
    hand.actedPlayerIds = [playerId];
    loggedAmount = raiseTo;
  } else if (action === "all_in") {
    const allInTo = playerBet + player.stack;
    const paid = payChips(player, player.stack);
    hand.bets[playerId] = allInTo;
    hand.pot += paid;
    addContribution(hand, playerId, paid);
    addUnique(hand.allInPlayerIds, playerId);
    hand.actedPlayerIds = allInTo > betToMatch ? [playerId] : [...new Set([...hand.actedPlayerIds, playerId])];
    loggedAmount = allInTo;
  } else {
    throw new Error("UNKNOWN_ACTION");
  }

  logAction(hand, playerId, action, loggedAmount);
  settleAfterAction(game);
  return game;
}

function createHand(game, dealerPlayerId, handNumber) {
  const activeSeats = activeSeatIds(game);
  const normalizedSeats = normalizeSeatsForDealer(activeSeats, dealerPlayerId);
  const deck = shuffleDeck(createDeck());
  const positions = getPositions(normalizedSeats);
  const holeCards = dealHoleCards(deck, normalizedSeats);
  const bets = {};

  normalizedSeats.forEach((playerId) => {
    bets[playerId] = 0;
  });

  const smallBlindPlayer = game.players.find((player) => player.id === positions.smallBlindPlayerId);
  const bigBlindPlayer = game.players.find((player) => player.id === positions.bigBlindPlayerId);

  bets[positions.smallBlindPlayerId] = postBlind(smallBlindPlayer, game.blinds.small);
  bets[positions.bigBlindPlayerId] = postBlind(bigBlindPlayer, game.blinds.big);

  game.tableSeats = normalizedSeats;
  game.hand = {
    number: handNumber,
    phase: "preflop",
    deck,
    communityCards: [],
    holeCards,
    dealerPlayerId: positions.dealerPlayerId,
    smallBlindPlayerId: positions.smallBlindPlayerId,
    bigBlindPlayerId: positions.bigBlindPlayerId,
    currentPlayerId: positions.firstToActPlayerId,
    pot: bets[positions.smallBlindPlayerId] + bets[positions.bigBlindPlayerId],
    bets,
    contributions: { ...bets },
    actedPlayerIds: [],
    foldedPlayerIds: [],
    allInPlayerIds: [],
    actionLog: []
  };

  return game;
}

function markEliminatedPlayers(game) {
  game.players.forEach((player) => {
    if (player.status === "active" && player.stack <= 0) {
      player.status = "eliminated";
    }
  });
}

function nextDealerAfter(game, previousDealerPlayerId, activeSeats) {
  const previousIndex = game.tableSeats.indexOf(previousDealerPlayerId);

  if (previousIndex === -1) return activeSeats[0];

  let index = previousIndex;
  for (let i = 0; i < game.tableSeats.length; i += 1) {
    index = nextSeatIndex(game.tableSeats, index);
    const playerId = game.tableSeats[index];
    if (activeSeats.includes(playerId)) return playerId;
  }

  return activeSeats[0];
}

function createFirstHand(game) {
  const firstDealerPlayerId = pickRandomDealer(activeSeatIds(game));
  return createHand(game, firstDealerPlayerId, 1);
}

function createNextHand(game) {
  if (!game.hand || game.hand.phase !== "hand_complete") {
    throw new Error("HAND_NOT_COMPLETE");
  }

  const previousDealerPlayerId = game.hand.dealerPlayerId;
  const previousHandNumber = game.hand.number;

  markEliminatedPlayers(game);

  const activeSeats = activeSeatIds(game);

  if (activeSeats.length < 2) {
    game.status = "completed";
    game.completedAt = new Date().toISOString();
    game.winnerPlayerId = activeSeats[0] || null;
    game.hand.currentPlayerId = null;
    return game;
  }

  const nextDealerPlayerId = nextDealerAfter(game, previousDealerPlayerId, activeSeats);
  game.tableSeats = activeSeats;

  return createHand(game, nextDealerPlayerId, previousHandNumber + 1);
}

module.exports = {
  applyPlayerAction,
  createFirstHand,
  createNextHand
};
