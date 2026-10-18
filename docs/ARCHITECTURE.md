# Architecture

This document records the architectural decisions for the Hanabi project. Change it in the same PR as
any change that departs from it.

## Goals

- A deterministic, well-tested rules engine for the base game of Hanabi.
- An H-Group decision engine that ranks every move for a seat, usable both as an AI player and for
  reviewing games, with the convention level configurable.
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
  hgroup/      @hanabi/hgroup     card deduction, H-Group convention reading, move ranking, game review
  ai/          @hanabi/ai         seat interface, game runner, simulator CLI
apps/
  web/         (later)            play UI and replay viewer
docs/
  conventions/                    specs of the implemented H-Group conventions
```

Packages are private and consumed as TypeScript source: each package's `exports` points at
`src/index.ts` and TypeScript uses `"moduleResolution": "bundler"`. There is no build step until the UI
needs one.

Dependency direction is one-way: `engine` ← `hgroup` ← `ai` ← `apps/web`.

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

| Export                      | Purpose                                                               |
| --------------------------- | --------------------------------------------------------------------- |
| `standardConfig(players)`   | The hanab.live base-game `GameConfig` for 2 to 5 players.             |
| `RANKS`                     | The ranks 1 to 5, in order.                                           |
| `shuffledDeck(config, rng)` | Produce a shuffled deck. Randomness lives here, outside the reducer.  |
| `createGame(config, deck)`  | Deal from a given deck and return the initial state.                  |
| `apply(state, action)`      | Returns `{ state, event }`. Throws on an illegal action.              |
| `validate(state, action)`   | Returns `null` if legal, otherwise a human-readable reason.           |
| `legalActions(state)`       | All legal actions for the current player.                             |
| `playerView(state, seat)`   | The projection of state that one seat is allowed to see.              |
| `score(state)`              | Current score (0 after a strikeout).                                  |
| `maxScore(config)`          | The score with every stack complete.                                  |
| `replay(record)`            | Every state and event of a recorded game. Throws naming the bad turn. |

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
- `log`: the event of every action so far, oldest first.
- `opening`: the public table before the first action (hands as card ids, stacks, discard pile and
  clue knowledge). With `log`, it rebuilds every earlier table; see Events.

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
`{ type: "play", seat, cardId, card, success: false, drawn }`. Events reveal what the action uncovered
(the identity of a played or discarded card, which cards a clue touched). AIs observe events, and the UI
animates them, so nobody has to diff states.

`applyEvent(moment, event)` applies one event's public effects to a `Moment` (the public table: hands,
stacks, discard pile and clue knowledge), and `history(state or view)` folds the log over `opening` to
get the table before every event. A property test checks that the rebuilt tables match every state the
reducer produced, so the two can't drift apart.

### Hidden information

`playerView(state, seat)` is a first-class projection: other players' cards are visible, the viewer's
own cards have their identity blanked out, and clue knowledge is visible for all cards. The draw pile
is reduced to its size. Every card id still has an entry in `cards`, with `card: null` where its identity
is hidden, so card ids index a view the same way they index state. AIs only ever
receive a `PlayerView`, so they cannot cheat by construction. The UI renders the same projection for the
human's seat.

Conventions depend on the order of moves and who made them, so state, and with it every `PlayerView`,
carries the game's event log so far. Events hold only public information (which cards a clue touched,
what a played or discarded card was, which card id was drawn), so the log needs no filtering and
nothing needs re-deriving.

### Clue knowledge

The engine records only rules-level facts about each card: which clues touched it (positive
information) and which clues it was present for but not touched by (negative information).

Deduction beyond that (for example "this can't be a red 3, both are visible") is strategy, not rules,
and lives in `@hanabi/hgroup`, which AIs and the UI opt into.

### Test helpers

`@hanabi/engine/testing` exports the scenario builder (`deal`) and `randomGame`, so other packages'
tests can build games the same way. It is for tests only and is not part of the public API above.

## Seats and AIs

AIs and (later) humans plug in through one async interface:

```ts
interface SeatController {
  chooseAction(view: PlayerView): Promise<Action>;
  observe?(event: GameEvent, view: PlayerView): void;
}
```

A human seat is a promise the UI resolves. Async also leaves room for running AIs in a Web Worker. A
helper (`syncSeat`) wraps simple synchronous AIs. The only AI is the H-Group decision engine below: its
seat controller (`hgroupSeat(level)`) plays the top-ranked move. There is no separate simple rule-based AI.

`runGame(state, seats)` in `@hanabi/ai` is the headless runner: it plays from any state (a fresh deal or
a test scenario) to the end, asking the current seat for each move, rejecting illegal ones, and showing
every seat its view of each event. It returns the final state and the actions, which with the config and
deck make the game's replay.

The simulator CLI (`pnpm simulate`) plays seeded self-play games with every seat on `hgroupSeat` and
prints the mean score, perfect games, strikeouts and the worst seed per player count. `--verbose` prints
every move with its category and reasons. Game i of a batch is dealt from seed + i, so a seed reproduces a
game. It is for exploring how the engine plays; nothing gates on its numbers.

## Decision engine

`@hanabi/hgroup` follows the [H-Group conventions](https://hanabi.github.io/). It is built for analysis
as much as for play: given a view, it judges every legal move rather than picking one.
[H-GROUP-LEVELS.md](./H-GROUP-LEVELS.md) lists the conventions per level, each with a stable id.

### Inputs and output

- **Input:** a `PlayerView` (including its event log) and the table's convention level. The call is
  stateless: a pure function replays the log to rebuild convention state. Caching can come later if it
  is slow.
- **Output:** `rankMoves(view, level)` returns every legal move, each with a category (`mandated`, `permitted` or `violates`), a score
  and structured reasons. Moves rank by category first, then by score. The score is a heuristic that only
  orders moves within one decision; it is not comparable across turns.
- **Reasons** name a convention id (or none, for a rules-level reason such as a possible misplay) and
  the cards involved, for example a play clue on Bob's red 3 that
  finesses Cathy's slot 1. `hgroup` also renders each reason as a default English sentence, for the CLI
  and the review output. The UI may render the structured form itself.
- **Deterministic:** the same view and level always give the same ranked list, with ties broken in a
  fixed order. A seat controller may add randomness later if self-play wants variety.

A move is judged from the acting player's view only: what they could know at the time. A hindsight mode
that compares against the hidden cards may be layered on later.

### Levels

There is one level for the whole table; mixed-level tables are out of scope (the goal is practice, not
modelling mismatched teammates). A convention applies when its level is at or below the table's level.
Below that, a move that would be the convention is not one: the engine does not suggest it and does not
read a teammate's move as it. Overrides, where a later level changes an earlier meaning, are keyed by
level the same way. Implementation starts at level 1 and adds levels one at a time.

Only H-Group is supported. There is no abstract "convention set" interface.

### Knowledge model

- **Card possibilities:** rules-level deduction of each card's possible identities from clue knowledge
  and visible cards. It is a module of `hgroup` with no convention logic in it, so the UI can show what
  a card could be and the review can contrast "the rules say" with "the conventions say". It can be
  split into its own package later. `cluePossibilities(config, clues)` is what the clues alone allow,
  which every player knows. `possibilities(view)` adds the viewer's eliminations: an identity is ruled
  out when every copy is visible or deduced for another of the viewer's cards, repeated until nothing
  changes. A property test checks that a card's real identity is always among its possibilities.
- **Common knowledge:** what every player agrees each card could be once conventions are applied. It is
  what lets the engine predict how a receiver will read a clue before suggesting it. `readGame(view,
level)` builds it by folding `advance(view, knowledge, event)` over the log: each event is applied to the
  public table with the engine's `applyEvent`, and each clue is read (`readClue`) on the table it was given on.
  `advance` also shows what an event being considered would change. Cards that start the game already clued (as
  test scenarios allow) begin from their clues, with Good Touch applied but no reading. The same `readClue` predicts how a clue the
  viewer is considering would be read.
- **Private knowledge:** what one seat can add to common knowledge from the cards it sees
  (`privateKnowledge`). It takes a `Sight` (a view's cards and config) rather than a whole view, so a
  seat can also work out what a teammate would know.
- **Convention specs:** each implemented convention has a short spec in [conventions/](./conventions/),
  with its source, its reading and the judgment calls made where H-Group leaves room.
- **Pending interpretations:** a clue can have several readings (a prompt or a finesse, say). Each one
  is kept until later moves rule it out, and marked with the turn that did, so the review can say when an
  ambiguity was resolved. Readings use only public information, so every seat reads a game the same way;
  `privateKnowledge` keeps the interpretations that fit what one seat sees.
- **Off-convention moves:** a teammate's move that means nothing at the table's level contributes only
  its rules-level information, and the review flags it. Mistake-recovery conventions (such as the Wrong
  Prompt) arrive as ordinary convention rules at their own levels.

### Approach

Convention rules are hand-written: they generate candidate moves, classify them and give reasons, and
heuristics score them. Search or simulation may later re-rank the permitted moves without changing the
output shape.

### Game review

`reviewGame(replay, level)` evaluates every turn from the acting player's view and reports where the move
actually made landed: its category, its rank and the top alternative. The simulator CLI can print it.

## Replays

The canonical replay format is the config, the dealt deck and the action list:

```ts
interface Replay {
  config: GameConfig;
  deck: readonly Card[];
  actions: readonly Action[];
}
```

Storing the deck (rather than only a seed) means replays survive changes to the PRNG. A seed can still
be used to generate the deck. `replay(record)` deals the deck and applies each action,
returning every intermediate state (so a viewer can scrub) and every event. Immer's structural sharing
keeps the intermediate states cheap.

The format is kept structurally close to hanab.live's JSON export so that an import/export converter is
easy to add later. That converter is not part of the engine phase.

## Testing

- Unit tests for each rule.
- A "stacked deck" scenario builder, so tests read like
  `deal({ hands, drawPile, stacks }).clue(BOB, 2).play(0)`. Cards on the given stacks are taken out of
  the deck, so scenario states conserve cards like real ones.
  Hand cards can start already clued: `"r*4"` is a red 4 whose color is known, `"r4*"` one whose rank
  is known, and `"r*4*"` both. Those clues are on the card from the start with no logged clue and no
  negative information on other cards, so a test shows the situation under test without setup clues.
  A `discardPile` (oldest first) starts the game with those cards already discarded: they come out of
  the deck, nothing is logged and clue tokens are unchanged, so no setup discards are needed.
- Property tests with fast-check: random legal games must preserve invariants (cards are conserved,
  clue tokens stay within 0 to 8, score never decreases, the game always terminates, `validate` and
  `legalActions` agree, views never leak hidden cards). The random games
  peek at the cards to pick plays, so they end in strikeouts, final rounds and perfect scores alike.
  Local runs use 200 games to stay fast; CI sets `PROPERTY_GAMES=2000`.
- Name player seats in tests. A test file that refers to seats declares the names it uses at the top
  (`const ALICE = 0`, `BOB = 1`, `CATHY = 2`, `DONALD = 3`, `EMILY = 4`) and uses them wherever a seat
  is meant, e.g. `clue(BOB, 2)` or `cardAt(4, BOB)`. Hand slots and ranks stay numeric. The names are
  file-local, not a shared export.
- The decision engine is tested with scenarios: each convention gets tests built from the examples on
  its H-Group page. Simulator self-play is for exploring how the engine plays, not a test, and nothing
  gates on its scores.
