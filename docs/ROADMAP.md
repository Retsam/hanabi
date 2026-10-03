# Roadmap

Phases are ordered so that each one exercises the one before it. See [ARCHITECTURE.md](./ARCHITECTURE.md)
for the decisions these phases build on.

## Phase 0: Scaffold

- pnpm workspace with `@hanabi/engine`, `@hanabi/inference` and `@hanabi/ai` packages.
- Strict TypeScript, Vitest, oxlint, oxfmt, and CI running all of them.
- Architecture and roadmap docs.

## Phase 1: Engine

- `GameConfig`, cards, deck construction and `shuffledDeck` (seeded via `pure-rand`).
- `createGame`, `apply`, `validate`, `legalActions`, `playerView`, `score`.
- hanab.live base-game rules, including the final round and strikeout.
- Clue knowledge (positive and negative) recorded on each card.
- Semantic events returned from `apply`.
- Replay type and `replay(config, deck, actions)`.
- Tests: per-rule unit tests, the stacked-deck scenario builder, fast-check invariant tests.

**Done when:** a complete game can be played and replayed through the public API, and the property tests
pass over thousands of random games.

## Phase 2: AI foundations

- `@hanabi/inference`: deduce each card's possible identities from clue knowledge and visible cards.
- `@hanabi/ai`: the `SeatController` interface and a headless game runner.
- A simple rule-based AI (for example: play known-playable, clue playable cards, discard oldest
  unclued).
- A CLI that simulates N games and reports the score distribution.

**Done when:** the CLI can run thousands of AI games and report average scores.

## Phase 3: Web UI for play

- `apps/web`: one human seat plus AI seats.
- Renders the human's `PlayerView` and animates events.
- AI selection per seat.

## Phase 4: Replay viewer

- Step through and scrub any saved game.
- Inspect the game from any player's view.
- Reuses the play UI's components.

## Phase 5: Configurable AI conventions

- Multiple AI strategies or convention sets, configurable per seat.
- Compare strategies with the simulator CLI.

## Later, unscheduled

- hanab.live replay import and export.
- Variants (rainbow, 6 suits, and so on) via `GameConfig` plus rule hooks.
- Running AIs in a Web Worker.
