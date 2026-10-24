# Roadmap

Phases are ordered so that each one exercises the one before it. See [ARCHITECTURE.md](./ARCHITECTURE.md)
for the decisions these phases build on.

## Phase 0: Scaffold

- pnpm workspace with `@hanabi/engine`, `@hanabi/inference` (since renamed `@hanabi/hgroup`) and `@hanabi/ai`
  packages.
- Strict TypeScript, Vitest, oxlint, oxfmt, and CI running all of them.
- Architecture and roadmap docs.

## Phase 1: Engine

- `GameConfig`, cards, deck construction and `shuffledDeck` (seeded via `pure-rand`).
- `createGame`, `apply`, `validate`, `legalActions`, `playerView`, `score`.
- hanab.live base-game rules, including the final round and strikeout.
- Clue knowledge (positive and negative) recorded on each card.
- Semantic events returned from `apply`.
- Replay type and `replay(record)`.
- Tests: per-rule unit tests, the stacked-deck scenario builder, fast-check invariant tests.

**Done when:** a complete game can be played and replayed through the public API, and the property tests
pass over thousands of random games.

## Phase 2: H-Group decision engine, level 1

The decision engine replaces the simple rule-based AI once planned here. See
[the decision engine section](./ARCHITECTURE.md#decision-engine).

1. The event log in `PlayerView`; card-possibility deduction in `@hanabi/hgroup`.
2. Common and private knowledge, chop, clue focus, Good Touch, play clues and save clues.
3. Prompts and finesses, with pending interpretations.
4. The ranked-move output, the H-Group seat controller, the headless game runner and the simulator CLI.
5. `reviewGame`, printable from the CLI.

**Done when:** every level 1 convention has scenario tests from its H-Group examples and passes them.
The simulator can run self-play games and report scores, but nothing gates on them.

## Phase 3: Web UI for play

- `apps/web` (Vite + React): one human seat plus H-Group AI seats, dealt from a seed. Done.
- Renders the human's `PlayerView`, with each card's clue possibilities. Done.
- Animating events, and AI selection per seat once there is more than one AI.
- A post-game review of the game just played, from `reviewGame`: step through each move from its player's
  view, with its category, rank, reasons and the engine's pick. Done; it starts Phase 4.

## Phase 4: Replay viewer

- Step through and scrub any saved game.
- Inspect the game from any player's view.
- Reuses the play UI's components.

## Phase 5: Higher H-Group levels

- Add conventions level by level, following [H-GROUP-LEVELS.md](./H-GROUP-LEVELS.md), each with its
  scenario tests.
- Level selection in the UI.

## Later, unscheduled

- hanab.live replay import and export.
- Variants (rainbow, 6 suits, and so on) via `GameConfig` plus rule hooks.
- Running AIs in a Web Worker.
