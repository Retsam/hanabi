# Architecture

This document records the architectural decisions for the Hanabi project. Change it in the same PR as
any change that departs from it.

## Goals

- A deterministic, well-tested rules engine for the base game of Hanabi.
- AI players with configurable behavior, run headlessly or alongside a human.
- A web UI for playing single-player games (one human, AI teammates) and for replaying games.

Multiplayer between humans is out of scope.

## Stack

| Concern           | Choice                                               |
| ----------------- | ---------------------------------------------------- |
| Language          | TypeScript everywhere (engine, AI, UI)               |
| Runtime           | Node 24 LTS, ESM only                                |
| Package manager   | pnpm workspaces                                      |
| Type checking     | `tsc`, strict, plus `noUncheckedIndexedAccess`       |
| Tests             | Vitest; fast-check for property tests                |
| Lint / format     | oxlint (type-aware, via oxlint-tsgolint) / oxfmt     |
| Immutable updates | Immer                                                |
| Randomness        | `pure-rand` (seedable PRNG)                          |
| CI                | GitHub Actions: typecheck, lint, format check, tests |

Dependencies are allowed but kept light. The engine must never depend on UI or AI code.

## Repository layout

```
packages/
  engine/      @hanabi/engine     rules, state, actions, player views
  inference/   @hanabi/inference  card-knowledge deduction (strategy, not rules)
  ai/          @hanabi/ai         seat interface, game runner, AI players
apps/
  web/         (later)            play UI and replay viewer
docs/
```

Packages are private and consumed as TypeScript source: each package's `exports` points at
`src/index.ts` and TypeScript uses `"moduleResolution": "bundler"`. There is no build step until the UI
needs one.

Dependency direction is one-way: `engine` ← `inference` ← `ai` ← `apps/web`.

## Rules

We follow the hanab.live rules for the base game, with no configuration flags in the first pass:

- 5 suits, ranks 1 to 5 (three 1s, two each of 2 to 4, one 5); hand size 5 for 2 to 3 players, 4 for 4
  to 5 players.
- 8 clue tokens. Discarding at 8 clue tokens is not allowed.
- A clue must touch at least one card (no empty clues).
- Playing a 5 returns a clue token (if below 8).
- A third strike ends the game with a score of 0.
- When the last card is drawn, each player (including the one who drew it) gets one more turn.

Suits and deck composition are still represented as data (`GameConfig`), not hardcoded enums, so that
variants can be added later as config plus rule hooks.

## Engine

The engine is a pure reducer. "State machine" here means a small `status` field, not a state-machine
library:

```ts
type Status = "playing" | "finalRound" | "over";
```

### Public API

`@hanabi/engine` exports exactly these, plus their types. Everything else is internal.

| Export                      | Purpose                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| `standardConfig(players)`   | The hanab.live base-game `GameConfig` for 2 to 5 players.            |
| `RANKS`                     | The ranks 1 to 5, in order.                                          |
| `shuffledDeck(config, rng)` | Produce a shuffled deck. Randomness lives here, outside the reducer. |
| `createGame(config, deck)`  | Deal from a given deck and return the initial state.                 |
| `apply(state, action)`      | Returns `{ state, event }`. Throws on an illegal action.             |
| `validate(state, action)`   | Returns `null` if legal, otherwise a human-readable reason.          |
| `legalActions(state)`       | All legal actions for the current player.                            |
| `playerView(state, seat)`   | The projection of state that one seat is allowed to see.             |
| `score(state)`              | Current score (0 after a strikeout).                                 |

Illegal actions are programmer errors: the UI and AIs check legality first, so `apply` throws rather
than returning a `Result`.

### State shape

State is normalized and treated as immutable (updates go through Immer):

- `cards`: a table keyed by card id. Each entry holds the card's identity (suit, rank) and its clue
  knowledge.
- Hands, the draw pile and the discard pile are arrays of card ids. Hands list the newest card first,
  so index 0 is hanab.live's slot 1.
- Play stacks are a count per suit.
- Plus clue tokens, strikes, current player, turns remaining in the final round, and `status`.

Every card has a stable id: its index in the dealt deck (equivalent to hanab.live's `order`). Ids
let clue history, replays, AI notes and UI animations follow a specific card as it moves between zones.

### Actions

Actions do not name the acting player; the engine knows whose turn it is. Cards are referenced by id,
never by hand slot, because slots shift after every play.

```ts
type Action =
  | { type: "play"; cardId: CardId }
  | { type: "discard"; cardId: CardId }
  | {
      type: "clue";
      target: Seat;
      clue: { kind: "color"; value: Suit } | { kind: "rank"; value: Rank };
    };
```

### Events

`apply` returns a semantic event alongside the new state, for example
`{ type: "play", cardId, card, success: false, strikes: 2 }`. Events reveal what the action uncovered
(the identity of a played or discarded card, which cards a clue touched). AIs observe events, and the UI
animates them, so nobody has to diff states.

### Hidden information

`playerView(state, seat)` is a first-class projection: other players' cards are visible, the viewer's
own cards have their identity blanked out, and clue knowledge is visible for all cards. AIs only ever
receive a `PlayerView`, so they cannot cheat by construction. The UI renders the same projection for the
human's seat.

### Clue knowledge

The engine records only rules-level facts about each card: which clues touched it (positive
information) and which clues it was present for but not touched by (negative information).

Deduction beyond that (for example "this can't be a red 3, both are visible") is strategy, not rules,
and lives in `@hanabi/inference`, which AIs and the UI opt into.

## Seats and AIs

AIs and (later) humans plug in through one async interface:

```ts
interface SeatController {
  chooseAction(view: PlayerView): Promise<Action>;
  observe?(event: GameEvent, view: PlayerView): void;
}
```

A human seat is a promise the UI resolves. Async also leaves room for running AIs in a Web Worker. A
helper wraps simple synchronous AIs.

## Replays

The canonical replay format is the config, the dealt deck and the action list:

```ts
type Replay = { config: GameConfig; deck: Card[]; actions: Action[] };
```

Storing the deck (rather than only a seed) means replays survive changes to the PRNG. A seed can still
be used to generate the deck. Replaying is `actions.reduce(apply, createGame(config, deck))`.

The format is kept structurally close to hanab.live's JSON export so that an import/export converter is
easy to add later. That converter is not part of the engine phase.

## Testing

- Unit tests for each rule.
- A "stacked deck" scenario builder, so tests read like `deal([...]).play(...).expect(...)`.
- Property tests with fast-check: random legal games must preserve invariants (cards are conserved,
  clue tokens stay within 0 to 8, score never decreases, the game always terminates).
