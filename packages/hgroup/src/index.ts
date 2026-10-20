// H-Group convention reading, card-possibility deduction and move ranking. See docs/ARCHITECTURE.md.
export {
  clueMatches,
  cluePossibilities,
  copies,
  identities,
  possibilities,
  sameCard,
  type Sight,
} from "./possibilities.ts";
export { applies, CONVENTION_LEVELS, type ConventionId, type Level } from "./conventions.ts";
export {
  advance,
  chop,
  type ClueReading,
  type Connection,
  finessePosition,
  focusCards,
  type GivenClue,
  type Interpretation,
  type Knowledge,
  type PastReading,
  privateKnowledge,
  readClue,
  readGame,
  type Table,
} from "./knowledge.ts";
export { type Category, rankMoves, type RankedMove, type Reason } from "./moves.ts";
