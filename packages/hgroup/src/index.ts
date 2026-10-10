// H-Group convention reading, card-possibility deduction and move ranking. See docs/ARCHITECTURE.md.
export {
  clueMatches,
  cluePossibilities,
  copies,
  identities,
  possibilities,
  sameCard,
} from "./possibilities";
export { applies, CONVENTION_LEVELS, type ConventionId, type Level } from "./conventions";
export {
  chop,
  type ClueReading,
  type GivenClue,
  type Knowledge,
  privateKnowledge,
  readClue,
  readGame,
  type Table,
} from "./knowledge";
