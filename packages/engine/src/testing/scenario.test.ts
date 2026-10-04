import { describe, expect, it } from "vitest";
import { deal } from "./scenario";

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
});
