const SUITS = ["S", "H", "D", "C"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

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

  if (winner) {
    winner.stack += game.hand.pot;
  }

  game.hand.winnerPlayerId = winnerId;
  game.hand.winningReason = "fold";
  game.hand.phase = "hand_complete";
  game.hand.currentPlayerId = null;
  game.hand.pot = 0;
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
    hand.phase = "showdown";
    hand.currentPlayerId = null;
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

function applyPlayerAction(game, { playerId, action, amount }) {
  if (game.status !== "in_progress" || !game.hand) throw new Error("GAME_NOT_IN_PROGRESS");

  const hand = game.hand;
  const player = game.players.find((item) => item.id === playerId);

  if (!player) throw new Error("PLAYER_NOT_FOUND");
  if (hand.currentPlayerId !== playerId) throw new Error("NOT_PLAYERS_TURN");
  if (hand.phase === "showdown" || hand.phase === "hand_complete") throw new Error("HAND_ALREADY_COMPLETE");

  const playerBet = hand.bets[playerId] || 0;
  const betToMatch = currentBet(hand);

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
    if (player.stack === 0) addUnique(hand.allInPlayerIds, playerId);
    addUnique(hand.actedPlayerIds, playerId);
  } else if (action === "raise") {
    const raiseTo = Number(amount);
    if (!Number.isFinite(raiseTo) || raiseTo <= betToMatch) throw new Error("INVALID_RAISE");
    if (raiseTo > player.stack + playerBet) throw new Error("RAISE_ABOVE_STACK");

    const paid = payChips(player, raiseTo - playerBet);
    hand.bets[playerId] = playerBet + paid;
    hand.pot += paid;
    if (player.stack === 0) addUnique(hand.allInPlayerIds, playerId);
    hand.actedPlayerIds = [playerId];
  } else if (action === "all_in") {
    const allInTo = playerBet + player.stack;
    const paid = payChips(player, player.stack);
    hand.bets[playerId] = allInTo;
    hand.pot += paid;
    addUnique(hand.allInPlayerIds, playerId);
    hand.actedPlayerIds = allInTo > betToMatch ? [playerId] : [...new Set([...hand.actedPlayerIds, playerId])];
  } else {
    throw new Error("UNKNOWN_ACTION");
  }

  settleAfterAction(game);
  return game;
}

function createFirstHand(game) {
  const firstDealerPlayerId = pickRandomDealer(game.tableSeats);
  const normalizedSeats = normalizeSeatsForDealer(game.tableSeats, firstDealerPlayerId);
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
    number: 1,
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
    actedPlayerIds: [],
    foldedPlayerIds: [],
    allInPlayerIds: []
  };

  return game;
}

module.exports = {
  applyPlayerAction,
  createFirstHand
};
