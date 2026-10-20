// Test helpers for packages that build on the engine: the scenario builder and random games.
// Imported as `@hanabi/engine/testing`, from tests only.
export {
  type CardName,
  deal,
  type HandCardName,
  parseCard,
  parseHandCard,
  Scenario,
  type ScenarioSetup,
} from "./scenario.ts";
export { type RandomGame, randomGame } from "./randomGame.ts";
