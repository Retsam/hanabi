import { createGame, shuffledDeck, standardConfig } from "@hanabi/engine";
import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";
import { describe, expect, it } from "vitest";
import {
  clearGame,
  type GameStorage,
  loadGame,
  loadLevel,
  type SavedGame,
  saveGame,
  saveLevel,
} from "./saved.ts";

const ALICE = 0;

function memoryStorage(): GameStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

const config = standardConfig(3);
const deck = shuffledDeck(config, xoroshiro128plus(7));
const aliceCard = createGame(config, deck).hands[ALICE]![0]!;
const game: SavedGame = {
  options: { numPlayers: 3, seed: 7, level: 1, humanSeat: ALICE, aiDelayMs: 600 },
  record: { config, deck, actions: [{ type: "play", cardId: aliceCard }] },
};

describe("saved games", () => {
  it("loads the game that was saved", () => {
    const storage = memoryStorage();
    expect(loadGame(storage)).toBeNull();
    saveGame(game, storage);
    expect(loadGame(storage)).toEqual(game);
  });

  it("keeps the player's card notes with the game", () => {
    const storage = memoryStorage();
    const noted = { ...game, notes: { [aliceCard]: { crossedOff: ["red 5"], text: "chop" } } };
    saveGame(noted, storage);
    expect(loadGame(storage)).toEqual(noted);
  });

  it("forgets a cleared game", () => {
    const storage = memoryStorage();
    saveGame(game, storage);
    clearGame(storage);
    expect(loadGame(storage)).toBeNull();
  });

  it("drops a save that no longer replays, is from another version, or is not JSON", () => {
    const unplayable = {
      ...game,
      record: { ...game.record, actions: [{ type: "discard", cardId: aliceCard }] },
    };
    for (const text of [
      JSON.stringify({ version: 1, game: unplayable }),
      JSON.stringify({ version: 0, game }),
      "{",
    ]) {
      const storage = memoryStorage();
      storage.setItem("hanabi.currentGame:", text);
      expect(loadGame(storage)).toBeNull();
      expect(storage.items.size).toBe(0);
    }
  });

  it("does nothing without storage, or when it throws", () => {
    const broken: GameStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    for (const storage of [null, broken]) {
      expect(() => saveGame(game, storage)).not.toThrow();
      expect(loadGame(storage)).toBeNull();
    }
  });
});

describe("saved level", () => {
  it("loads the level last picked", () => {
    const storage = memoryStorage();
    expect(loadLevel([1, 2], storage)).toBeNull();
    saveLevel(2, storage);
    expect(loadLevel([1, 2], storage)).toBe(2);
  });

  it("ignores a level that isn't offered", () => {
    const storage = memoryStorage();
    saveLevel(3, storage);
    expect(loadLevel([1, 2], storage)).toBeNull();
    storage.setItem("hanabi.level", "x");
    expect(loadLevel([1, 2], storage)).toBeNull();
  });

  it("does nothing without storage", () => {
    expect(() => saveLevel(2, null)).not.toThrow();
    expect(loadLevel([1, 2], null)).toBeNull();
  });
});
