import { describe, expect, it } from "vitest";
import { EMPTY_NOTE, markedPossibilities, setNote, toggleIdentity } from "./notes.ts";

const R1 = { suit: "red", rank: 1 } as const;
const R2 = { suit: "red", rank: 2 } as const;
const B1 = { suit: "blue", rank: 1 } as const;

describe("card notes", () => {
  it("crosses an identity off and back on", () => {
    const crossed = toggleIdentity(EMPTY_NOTE, R2);
    expect(markedPossibilities([R1, R2, B1], crossed)).toEqual([R1, B1]);
    expect(toggleIdentity(crossed, R2)).toEqual(EMPTY_NOTE);
  });

  it("leaves possibilities alone without a note", () => {
    expect(markedPossibilities([R1, R2], undefined)).toEqual([R1, R2]);
  });

  it("drops a card's note once it is empty", () => {
    const notes = setNote({}, 3, { crossedOff: [], text: "finessed?" });
    expect(notes).toEqual({ 3: { crossedOff: [], text: "finessed?" } });
    expect(setNote(notes, 3, { crossedOff: [], text: "  " })).toEqual({});
  });
});
