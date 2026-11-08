# Level 2 conventions

Specs for the level 2 conventions `@hanabi/hgroup` implements so far, by their ids in
[H-GROUP-LEVELS.md](../H-GROUP-LEVELS.md), in the same shape as [level-1.md](./level-1.md). The site's
content is CC BY-SA 4.0. The tests are in `packages/hgroup/src/stall.test.ts` (`5-stall`) and
`packages/hgroup/src/connections.test.ts` (prompts and finesses, including reverse and self-finesses) and `packages/hgroup/src/strikes.test.ts` (`after-a-strike`, `wrong-prompt`).

## `5-stall`

- **Source:** [level 2](https://hanabi.github.io/level-2#the-5-stall-cluing-off-chop-5s).
- **Reading:** in the Early Game, a 5 clue focused off chop is a stall, not a play clue: like a 5 Save,
  its focus is any 5 that isn't trash, and nothing has to play. A 5 clue focused on chop is still a 5
  Save, and after the Early Game an off-chop 5 clue is a play clue again, as at level 1.
- **Rules out:** the play clue on the 5, and any prompt or finesse that would lead up to it.
- **Ranking:** a 5 Stall is permitted with a fixed score, as the last resort for stalling the Early
  Game: below every play or save clue that gets a card, even one that spends the last clue token or
  a 2 Save that isn't urgent yet (unless it touches trash), and below discarding known trash. It is not a play or save clue, so
  a chop discard stays permitted rather than violating `early-game`, but while a 5 Stall is
  available in the Early Game the chop discard scores just below it, since the stall keeps the
  Early Game going.
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

## `reverse-finesse`

- **Source:** [level 2](https://hanabi.github.io/level-2#the-reverse-finesse).
- **Reading:** a finesse as in [level-1.md](./level-1.md#finesse), but on a player who plays after the
  receiver (and before the giver). It combines with the other level 2 chains: a later card in a chain
  can be finessed from a player after the receiver too.
- **Receiver:** waiting needs no extra rule. In the site's first example Bob sees the r1 on Cathy's
  finesse position, so his red card could be the r1 (a play clue) or the r2 (a Reverse Finesse). It
  isn't known to be playable, so he does something else. Cathy sees the r2 in Bob's hand, so the
  finesse is the only reading she can't rule out and she blind-plays. Then Bob knows his card is the
  r2.
- **Rules out:** as for any finesse, the finessed player's next turn must be the blind-play. In the
  site's second example Bob's card is the r1, so Cathy, who sees it, doesn't blind-play, and that
  rules the Reverse Finesse out: Bob plays his r1 next turn.
- **Ranking:** a clue read as a Reverse Finesse is labelled `reverse-finesse` ahead of the other
  level 2 chain conventions.
- **Judgment calls:** a player who doesn't see a connecting card on someone's finesse position (it
  isn't there, or it's in their own hand) has nothing to wait for, so the receiver only waits when
  the card is visible to them. Common knowledge keeps longer chains open (Cathy finessed again for
  the r3 and on), as for `multi-finesse`; the players rule them out from the cards they see.

## `self-finesse`

- **Source:** [level 2](https://hanabi.github.io/level-2#the-self-finesse).
- **Reading:** a finesse as in [level-1.md](./level-1.md#finesse), but on the receiver's own finesse
  position. It combines with the other level 2 chains, like `reverse-finesse`.
- **Receiver:** reads a Self-Finesse only when nothing else fits: a direct play clue, a prompt, or a
  finesse on another player (before or after them) comes first. So the receiver waits while another
  player could still blind-play, and blind-plays once every other reading is ruled out. In the site's
  example Cathy sees no 2 on Bob's finesse position, so after Bob's turn she blind-plays her finesse
  position as any 2. It is the r2, so her 3 is the r3.
- **Others:** the fallback is only the receiver's. A player who sees the connecting card on the
  receiver's finesse position doesn't blind-play for it, because it may be the receiver's: in the
  example Bob sees Cathy's r2 and discards.
- **Ranking:** the giver's clue is a misread when the receiver would fall back on something else.
  A 3 clue meant as a Self-Finesse on the r3 while the y3 is playable is read as the y3. Clues read
  as a Self-Finesse are labelled `self-finesse`, ahead of the other level 2 chain conventions.
  The Save Principle's check of what the next player knows applies the same fallback when they are
  the receiver.
- **Judgment calls:** a Self-Finesse is never read for a card that another player's clued card could
  be. The receiver would wait for that prompt, and the prompted card may well play first, so the
  giver can't count on the Self-Finesse (the site says the receiver waits "until the other player
  has had a chance to play", but a later fallback after a failed prompt isn't read). The fallback
  works on what the receiver can rule out from what they see, so a
  finesse on another player whose finesse position visibly isn't the card doesn't hold them back.
  Move ranking judges the receiver's reading as of the clue, so a Self-Finesse that the receiver
  would only reach after another player's turn (Bob holding a 2 on his finesse position too) is
  flagged as a misread, which is conservative. Common knowledge keeps Self-Finesse readings, so
  tests that list a clue's interpretations now also see them.

## `after-a-strike`

- **Source:** [level 2](https://hanabi.github.io/level-2#what-to-do-after-a-strike).
- **Reading:** when a card misplays, every clue that asked for it, as its focus or as a connecting
  card in one of its pending interpretations, stops meaning anything. Its interpretations are ruled
  out, and the cards it touched fall back to what the clues on them say outright. So in the site's
  example Cathy doesn't play her red card or guess what it is once Bob misplays.
- **Judgment calls:** the site says this applies at all levels, but H-GROUP-LEVELS.md files it under
  level 2, so it is read from level 2 on. At level 1 the misplay only rules out the interpretations it
  contradicts, as before. Clues that didn't ask for the misplayed card are unaffected. Falling back
  to what the clues say outright also drops narrowing from other clues on the same cards; Good Touch
  on trash still holds.

## `wrong-prompt`

- **Source:** [level 2](https://hanabi.github.io/level-2#the-wrong-prompt).
- **Reading:** a prompt remembers the prompted player's finesse position when the clue was given. If
  the prompted card misplays, the giver probably meant a finesse there: the prompt becomes a finesse
  on that card, and the player blind-plays it on their next turn (`after-a-strike` doesn't wipe the
  clue). The clue's other interpretations that didn't ask for the misplayed card stay open: in the
  site's example Cathy, who can't see Bob's r2, still can't tell the r2 from the r3 until he plays it.
- **Judgment call:** it applies only while that finesse position is still in the player's hand.
  The finesse it turns into is urgent from the player's next turn, not the turn of the misplay.

## Owed plays

A prompt or finesse is owed (mandated in move ranking) when every interpretation the player can't
rule out needs that card to play now. From level 2 on there can be several finesse readings for one
clue, such as Bob holding the r2 and Cathy the r3, or Bob holding both. So "can't rule out" also
checks the connecting cards against what the player sees, as private knowledge does, not only the
focus.
