# Level 2 conventions

Specs for the level 2 conventions `@hanabi/hgroup` implements so far, by their ids in
[H-GROUP-LEVELS.md](../H-GROUP-LEVELS.md), in the same shape as [level-1.md](./level-1.md). The site's
content is CC BY-SA 4.0. The tests are in `packages/hgroup/src/connections.test.ts`.

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
