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
    foldedPlayerIds: [],
    allInPlayerIds: []
  };

  return game;
}

module.exports = {
  createFirstHand
};
