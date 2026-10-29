# Level 2 conventions

Specs for the level 2 conventions `@hanabi/hgroup` implements so far, by their ids in
[H-GROUP-LEVELS.md](../H-GROUP-LEVELS.md), in the same shape as [level-1.md](./level-1.md). The site's
content is CC BY-SA 4.0. The tests are in `packages/hgroup/src/stall.test.ts` (`5-stall`) and
`packages/hgroup/src/connections.test.ts` (prompts and finesses).

## `5-stall`

- **Source:** [level 2](https://hanabi.github.io/level-2#the-5-stall-cluing-off-chop-5s).
- **Reading:** in the Early Game, a 5 clue focused off chop is a stall, not a play clue: like a 5 Save,
  its focus is any 5 that isn't trash, and nothing has to play. A 5 clue focused on chop is still a 5
  Save, and after the Early Game an off-chop 5 clue is a play clue again, as at level 1.
- **Rules out:** the play clue on the 5, and any prompt or finesse that would lead up to it.
- **Ranking:** a 5 Stall is permitted with a fixed score: above discarding the chop, since the site
  gives it as a way to extend the Early Game, but below discarding known trash and below a play or
  save clue that gets a card. It is not a play or save clue, so a chop discard stays permitted
  rather than violating `early-game`.
- **Judgment calls:** the Early Game lasts until the first discard in the log, as for `early-game`; a
  test scenario that starts with cards in the discard pile starts after it. Mid-game 5 Stalls in a
  stalling situation, and the rules on when a 5 Stall is required or which 5 it goes to, are the
  level 9 additions and are not read. The site gives no worked example, so the tests follow its
  description.

## `multi-prompt`

- **Source:** [level 2](https://hanabi.github.io/level-2#the-double-prompt--triple-prompt--quadruple-prompt).
- **Reading:** a play clue can need several prompted cards in a row, from one player or several. Each
  is a prompt as in [level-1.md](./level-1.md#prompt): the clued cards that could be the missing card,
  leftmost first, without the ones an earlier prompt in the clue already claims. So a player with two
  clued cards that could both be the r2 and the r3 plays them left to right, as in the site's example.
- **Limit:** prompts only. A clue that needs a finesse as well (`prompt-plus-finesse`) or several
  finesses (`multi-finesse`) is not read yet.
- **Judgment call:** the giver answers for the order. If the prompted cards sit in the wrong order the
  interpretation is still read, but a player who sees them rules it out, and move ranking flags the
  clue as misread.
