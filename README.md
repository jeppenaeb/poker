# Poker

A web app for playing Texas Hold'em with friends.

## Current MVP

- App runs under `/poker`
- API runs under `/poker/api`
- Host can create a game with:
  - game name, max 12 characters
  - player count from 2 to 6
  - optional buy-ins
  - max 1 or 2 buy-ins per player
  - buy-ins allowed until a chosen blind level
- Join flow uses a 4-character game code
- Game codes are case-insensitive
- Lobby polls every 2 seconds
- Start button is locked until all selected players have joined

## Game Code

Codes use this alphabet:

```text
ABCDEFGHJKLMNPQRSTUVWXYZ23456789
```

That avoids confusing characters like `0`, `O`, `1`, and `I`.

## Run Locally

```bash
cd backend
npm install
npm run dev
```

Open:

```text
http://localhost:3000/poker
```

Health check:

```text
http://localhost:3000/poker/api/health
```

## API

```text
GET  /poker/api/health
POST /poker/api/games
POST /poker/api/games/:code/join
GET  /poker/api/games/:code/state
```

## Next Steps

- Add draggable table seats in lobby
- Add start-game endpoint
- Add table-screen mode for iPad/TV
- Add player-screen mode with hold-to-reveal cards
- Add chip-based betting UI
- Add poker hand state machine
