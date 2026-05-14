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

function activeSeatIds(game) {
  return game.tableSeats.filter((playerId) => {
    const player = game.players.find((item) => item.id === playerId);
    return player && player.status === "active" && player.stack > 0;
  });
}

function normalizeSeatsForDealer(tableSeats, dealerPlayerId) {
  const dealerIndex = tableSeats.indexOf(dealerPlayerId);
  if (dealerIndex === -1) throw new Error("DEALER_NOT_IN_SEATS");
  return [...tableSeats.slice(dealerIndex), ...tableSeats.slice(0, dealerIndex)];
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

function createHand(game, dealerPlayerId, handNumber) {
  const normalizedSeats = normalizeSeatsForDealer(activeSeatIds(game), dealerPlayerId);
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
    allInPlayerIds: []
  };

  return game;
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
  return createHand(game, nextDealerPlayerId, previousHandNumber + 1);
}

module.exports = {
  createNextHand
};
