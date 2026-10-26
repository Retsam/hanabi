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
- **Ranking:** a 5 Stall is permitted with a fixed low score, below discarding the chop and below a
  play or save clue that gets a card. It is not a play or save clue, so it doesn't stop the chop discard that ends the Early Game.
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
- **Limit:** a clue that needs a finesse as well is `prompt-plus-finesse`, below.
- **Judgment call:** the giver answers for the order. If the prompted cards sit in the wrong order the
  interpretation is still read, but a player who sees them rules it out, and move ranking flags the
  clue as misread.

## `multi-finesse`

- **Source:** [level 2](https://hanabi.github.io/level-2#the-double-finesse--triple-finesse--quadruple-finesse).
- **Reading:** a play clue can need several finessed cards in a row. Each is a finesse as in
  [level-1.md](./level-1.md#finesse) on a player after the giver and before the receiver, except that
  only the first has to be playable now: a later one becomes playable once the cards before it in the
  chain have played. The players hold them in turn order, so each blind-plays on their turn once the
  card before is down, which is Bob's r2 and then Cathy's r3 in the site's first example. One player
  can be finessed more than once, and then blind-plays their finesse positions left to right on
  successive turns (the site's second example). A Triple or Quadruple Finesse is the same with more
  cards.
- **Rules out:** a later finesse waits for the cards before it, so a finessed player who acts before
  their card is playable has not broken the finesse. Once it is playable, their next turn must be the
  blind-play. A connecting card played by another player rules the interpretation out.
- **Receiver:** waiting needs no extra rule. In the site's second example, after Bob's first
  blind-play Cathy still can't tell a Finesse (r2) from a Double Finesse (r3), because she saw an r2
  next to Bob's r1. Her card isn't known to be playable, so she doesn't play it. Bob's next turn
  settles it.
- **Judgment calls:** a finesse never needs a player who plays before the holder of an earlier card
  in the chain: that player would have to wait a full round. Common knowledge keeps longer chains
  open after the last blind-play: Bob could be finessed once more. The receiver rules that out from
  the cards they see.

## `prompt-plus-finesse`

- **Source:** [level 2](https://hanabi.github.io/level-2#the-prompt--finesse).
- **Reading:** a play clue can need prompts and finesses together, in any mix, from one player or
  several. Prompts come before finesses as at level 1: a player with a clued card that could be the
  missing card is prompted. Only a player whose clued candidates are all claimed by earlier prompts
  in the chain can be finessed for a later card. In the site's example, Bob's one clued red card is
  prompted as the r2 and his finesse position is finessed as the r3. He plays the prompt first,
  because the finesse waits for it (as in `multi-finesse`).
- **Receiver:** Cathy saw the r3 on Bob's finesse position, so after the prompt she can't tell the r3
  from the r4, and she waits.
- **Judgment call:** a finesse followed by a prompt is level 2 here too. At level 1 a clue asks for one
  prompt or one finesse, beyond the cards that play anyway.

## Owed plays

A prompt or finesse is owed (mandated in move ranking) when every interpretation the player can't
rule out needs that card to play now. From level 2 on there can be several finesse readings for one
clue, such as Bob holding the r2 and Cathy the r3, or Bob holding both. So "can't rule out" also
checks the connecting cards against what the player sees, as private knowledge does, not only the
focus.
