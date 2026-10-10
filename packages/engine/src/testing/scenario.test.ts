import { describe, expect, it } from "vitest";
import { playerView } from "../playerView";
import { deal } from "./scenario";

const BOB = 1;

const start = () =>
  deal({
    hands: [
      ["r1", "r2", "r3", "r4", "r5"],
      ["y1", "y2", "g1", "b1", "b2"],
    ],
    drawPile: ["p1", "p2", "p3"],
  });

describe("deal", () => {
  it("takes the player count from the hands", () => {
    const game = deal({
      hands: [
        ["r1", "r2", "r3", "r4"],
        ["y1", "y2", "y3", "y4"],
        ["g1", "g2", "g3", "g4"],
        ["b1", "b2", "b3", "b4"],
      ],
    });
    expect(game.state.config.numPlayers).toBe(4);
    expect(game.state.drawPile).toHaveLength(50 - 16);
  });

  it("deals the hands and draw pile it was given", () => {
    const game = start();
    expect(game.hands).toEqual([
      ["r1", "r2", "r3", "r4", "r5"],
      ["y1", "y2", "g1", "b1", "b2"],
    ]);
    expect(game.state.drawPile.map((id) => game.name(id))).toEqual(["p1", "p2", "p3"]);
    expect(game.state.discardPile).toHaveLength(50 - 10 - 3);
  });

  it("takes the cards on the stacks out of the deck", () => {
    const hands = [
      ["g1", "g2", "g3", "g4", "g5"],
      ["y1", "y2", "y3", "y4", "y5"],
    ];
    const game = deal({ hands, stacks: { red: 3 } });
    expect(game.state.stacks.red).toBe(3);
    const names = [...game.state.drawPile, ...game.state.discardPile].map((id) => game.name(id));
    // One each of r1, r2 and r3 is on the stack.
    const reds = names.filter((name) => name[0] === "r").toSorted();
    expect(reds).toEqual(["r1", "r1", "r2", "r3", "r4", "r4", "r5"]);
    expect(() =>
      deal({ hands: [["r1", "r1", "r1", "g1", "g2"], hands[1]!], stacks: { red: 1 } }),
    ).toThrow("No r1 left in the deck");
  });

  it("rejects a stack for an unknown suit", () => {
    expect(() => deal({ hands: start().hands, stacks: { rd: 3 } })).toThrow("Unknown suit rd");
  });

  describe("starting discard pile", () => {
    const hands = start().hands;

    it("starts with the given cards discarded, oldest first", () => {
      const game = deal({ hands, discardPile: ["b5", "r1", "g4"] });
      expect(game.state.discardPile.map((id) => game.name(id))).toEqual(["b5", "r1", "g4"]);
      expect(game.state.drawPile).toHaveLength(50 - 10 - 3);
      expect(game.state.clueTokens).toBe(8);
      expect(game.events).toEqual([]);
    });

    it("takes the discarded cards out of the deck", () => {
      const game = deal({ hands, discardPile: ["b5"] });
      expect(game.state.drawPile.map((id) => game.name(id))).not.toContain("b5");
      // Alice holds one of the three r1s, so only two can be discarded.
      expect(() => deal({ hands, discardPile: ["r1", "r1", "r1"] })).toThrow(
        "No r1 left in the deck",
      );
    });

    it("puts unnamed cards after the given discards when the draw pile is given", () => {
      const game = deal({ hands, drawPile: ["p1"], discardPile: ["b5", "g5"] });
      expect(game.state.drawPile.map((id) => game.name(id))).toEqual(["p1"]);
      expect(game.state.discardPile).toHaveLength(50 - 10 - 1);
      expect(game.state.discardPile.slice(0, 2).map((id) => game.name(id))).toEqual(["b5", "g5"]);
    });

    it("keeps cards conserved alongside stacks", () => {
      const game = deal({ hands: [["g1", "g2", "g3", "g4", "g5"], hands[1]!], stacks: { red: 2 } });
      const withDiscards = deal({
        hands: [["g1", "g2", "g3", "g4", "g5"], hands[1]!],
        stacks: { red: 2 },
        discardPile: ["r3", "r3"],
      });
      expect(withDiscards.state.drawPile).toHaveLength(game.state.drawPile.length - 2);
      expect(withDiscards.state.stacks.red).toBe(2);
      const all = [...withDiscards.state.drawPile, ...withDiscards.state.discardPile];
      expect(all.map((id) => withDiscards.name(id)).filter((n) => n === "r3")).toEqual([
        "r3",
        "r3",
      ]);
    });
  });

  describe("pre-clued cards", () => {
    const game = deal({
      hands: [
        ["r1", "r2", "r3", "r4", "r5"],
        ["y*1", "y2*", "g*1*", "b1", "b2"],
      ],
    });
    const cluesAt = (slot: number) => game.state.cards[game.cardAt(slot, BOB)]!.clues;

    it("marks a known color, a known rank, or both", () => {
      expect(game.hands[BOB]).toEqual(["y1", "y2", "g1", "b1", "b2"]);
      expect(cluesAt(0).touchedBy).toEqual([{ kind: "color", value: "yellow" }]);
      expect(cluesAt(1).touchedBy).toEqual([{ kind: "rank", value: 2 }]);
      expect(cluesAt(2).touchedBy).toEqual([
        { kind: "color", value: "green" },
        { kind: "rank", value: 1 },
      ]);
    });

    it("gives no negative information and logs no clue", () => {
      for (const slot of [0, 1, 2, 3, 4]) expect(cluesAt(slot).notTouchedBy).toEqual([]);
      expect(cluesAt(3).touchedBy).toEqual([]);
      expect(game.state.log).toEqual([]);
      expect(game.state.clueTokens).toBe(8);
    });

    it("shows in the clued player's own view", () => {
      const view = playerView(game.state, BOB);
      const card = view.cards[game.cardAt(2, BOB)]!;
      expect(card.card).toBeNull();
      expect(card.clues).toEqual(cluesAt(2));
    });

    it("adds to clues given later", () => {
      const later = game.clue(BOB, 1);
      expect(later.state.cards[later.cardAt(2, BOB)]!.clues.touchedBy).toEqual([
        { kind: "color", value: "green" },
        { kind: "rank", value: 1 },
        { kind: "rank", value: 1 },
      ]);
      expect(later.state.cards[later.cardAt(0, BOB)]!.clues.touchedBy).toHaveLength(2);
    });

    it("rejects clue marks outside hands and malformed marks", () => {
      const bob = game.hands[BOB]!;
      const hands = [["r1", "r2", "r3", "r4", "r5"], bob];
      expect(() => deal({ hands, drawPile: ["p*1"] })).toThrow("Bad card name p*1");
      const badMark = [["r**1", "r2", "r3", "r4", "r5"], bob];
      expect(() => deal({ hands: badMark })).toThrow("Bad card name r**1");
    });
  });
});
