# Level 1 conventions

Specs for the level 1 conventions `@hanabi/hgroup` implements so far, by their ids in
[H-GROUP-LEVELS.md](../H-GROUP-LEVELS.md). Each one names its source on
[hanabi.github.io](https://hanabi.github.io/) (summarised here; the site's content is CC BY-SA 4.0), what
it needs, how it reads a clue, what it rules out, and the calls we made where the site leaves room.
The tests are in `packages/hgroup/src/knowledge.test.ts`, `connections.test.ts` (prompts and
finesses) and `moves.test.ts` (move ranking), mostly built from the site's own examples.

## How a clue is read

`readClue` reads one clue from the table as it was just before the clue. Every reading has a focus and a
list of interpretations: what the focus is under each one, whether it is a play or a save, and any
connecting card that has to play first (a prompt or a finesse). `focusCards` collects the focus cards
of the interpretations not yet ruled out, and the focus's common knowledge becomes that set. When
there are none the clue is off-convention: it means nothing at the table's level and only its
rules-level information is kept.

A reading is common knowledge, so it uses only what every player knows: the cards the table has
identified, not the cards some players can see. Every seat reads the same game the same way. Each
player then keeps the interpretations that fit the cards they see (`privateKnowledge`), which is how a
prompted or finessed player learns what they hold.

### Pending interpretations

An interpretation stays pending until a later move rules it out, and `readGame` marks the turn that
did (`ruledOutOn`). After every move, common knowledge narrows to what each clue's remaining
interpretations allow. An interpretation is ruled out when:

- its focus can no longer be the card it says (it was played elsewhere, say, so Good Touch rules it
  out);
- no card can still be its connecting card: a prompted player's candidates have all turned out to be
  other cards;
- its finessed player took their turn without blind-playing the card (finesses are urgent).

If every interpretation is ruled out, a teammate broke a convention: the cards keep what they had.

## `chop`

- **Source:** [beginner/chop](https://hanabi.github.io/beginner/chop),
  [level 1](https://hanabi.github.io/level-1#the-chop).
- **Definition:** a seat's oldest (rightmost) unclued card. A hand with every card clued has no chop.
- **Judgment call:** "discard known trash before chop" is about which card to discard, so it belongs to
  move ranking (step 4), not to the chop itself. The site says the same: trash does not become the chop.

## `clue-focus`

- **Source:** [level 1](https://hanabi.github.io/level-1#clue-focus).
- **Rule:** if the clue touched no new card, the focus is the leftmost re-touched card. Otherwise, if it
  newly touched the chop, the focus is the chop. Otherwise it is the leftmost newly touched card.
- "New" means unclued before this clue. Finessed cards count as clued
  (`finessed-cards-count-as-clued`).

## `play-clue` and `delayed-play-clue`

- **Source:** [beginner/play-clues](https://hanabi.github.io/beginner/play-clues),
  [beginner/delayed-play-clues](https://hanabi.github.io/beginner/delayed-play-clues),
  [level 1](https://hanabi.github.io/level-1#the-definition-of-playable).
- **Reading:** a play clue says the focus is the next card its suit needs once every clued card the
  table has identified has played, or one card past that if a prompt or finesse supplies the card in
  between (see below). The focus is whichever of those the clue could touch.
- **Rules out:** everything else the clue could touch.
- **Tempo clues:** a clue that touches nothing new is a play clue on its focus (the leftmost re-touched
  card), as in the site's tempo clue example.
- **Delayed through cards that will play anyway:** a clued card the table hasn't identified, but whose
  every possibility will play (Cathy's clued 1's in the site's example), can connect like a prompt. The
  site doesn't call that a prompt, since the card was going to play anyway, so the reading lists it as
  `delayed-play-clue`. Only players who can see those 1's can tell which suits they cover, so the table
  reads Bob's 2 as any 2 those 1's could lead to.

## `save-clue`

- **Source:** [level 1](https://hanabi.github.io/level-1#save-clues).
- **Precondition:** only a clue whose focus is the newly touched chop can be a save. A focus off chop
  is always a play clue.
- A chop focus can be both: a color clue on chop is a play clue on the playable card or a save on the
  critical one, as in the site's critical save example (blue on chop is "b2 or b4").

## `5-save`

- **Source:** [beginner/5-save](https://hanabi.github.io/beginner/5-save),
  [level 1](https://hanabi.github.io/level-1#the-5-save).
- **Reading:** a 5 clue focused on chop is a save, not a play clue, on any 5 that is not trash. A 5 clue
  focused off chop is a play clue on the 5.

## `2-save`

- **Source:** [beginner/2-save](https://hanabi.github.io/beginner/2-save),
  [level 1](https://hanabi.github.io/level-1#the-2-save).
- **Reading:** a 2 clue focused on chop is a save on any 2 that is not trash ("It can be any 2 in the
  game").
- **Judgment call:** the Visible Rule (no 2 Save on a 2 visible in another hand) limits the clue giver.
  The receiver does not use it to narrow the 2; the move ranking will enforce it for the giver.

## `critical-save`

- **Source:** [beginner/critical-save](https://hanabi.github.io/beginner/critical-save).
- **Reading:** any clue focused on chop, other than a 5 or 2 clue, may save a critical card: one still
  needed whose other copies are all discarded. 5's are excluded, since a 5 is only saved with a 5 clue
  (a color clue on a 5 is a play clue).

## `good-touch`

- **Source:** [beginner/good-touch-principle](https://hanabi.github.io/beginner/good-touch-principle),
  [beginner/save-principle](https://hanabi.github.io/beginner/save-principle).
- **Reading:** every other newly touched card will play one day. It is no card that is trash (already
  played, unreachable, or already clued elsewhere), and not the focus's card if the focus is known.
- **Afterwards:** a clued card is never a card that has since been played, and no two clued cards are
  the same card. This is how the site's purple example pins down a purple 5.
- **Rules out:** for a clue that is off-convention, nothing: Good Touch only applies to a clue that means
  something.
- **Judgment call:** knowledge is never narrowed to nothing. If a later fact contradicts an earlier
  reading (a teammate broke a convention), the card keeps what it had, or falls back to its clues.

## `prompt`

- **Source:** [level 1](https://hanabi.github.io/level-1#the-prompt),
  [beginner/prompt](https://hanabi.github.io/beginner/prompt).
- **Reading:** a play clue on a card one past what its suit needs can be a prompt: a player other than
  the clue giver (the receiver included, a self-prompt) has clued cards that could be the missing card.
  The interpretation lists those cards leftmost first. The leftmost is the one to play.
- **Afterwards:** if the leftmost turns out to be another card, the next one is promised, and so on (the
  site's fourth example). The prompt is ruled out once none of them can be the card.
- **Judgment call:** knowledge only pins a prompted card down when it is the only candidate. With several,
  each keeps its possibilities: which one to play is a move-ranking question (step 4).
- **Judgment call:** a prompted player who passes their turn does not rule the prompt out. The site only
  calls finesses urgent.
- **Limit:** one prompt or finesse per clue. Double prompts and a prompt plus a finesse are level 2.

## `finesse`

- **Source:** [level 1](https://hanabi.github.io/level-1#the-finesse),
  [beginner/finesse](https://hanabi.github.io/beginner/finesse).
- **Reading:** a play clue on a card one past what its suit needs can be a finesse: a player who plays
  after the clue giver and before the receiver blind-plays the missing card from their finesse position.
  The missing card must be playable now.
- **Rules out:** the finesse, if that player's next turn is not the blind-play (finesses are urgent).
- **Limit:** self-finesses (on the receiver) and reverse finesses (on a player after the receiver) are
  level 2, so they are not read at level 1.

## `finesse-position`

- **Source:** [level 1](https://hanabi.github.io/level-1#finesse-position).
- **Definition:** a player's leftmost unclued card (`finessePosition`). A card already finessed by an
  earlier clue counts as clued here (see below), so while it waits to blind-play, the player's finesse
  position is the next unclued card to its right.

## `finessed-cards-count-as-clued`

- **Source:** [level 1](https://hanabi.github.io/level-1#finessed-cards).
- **Rule:** a card every remaining interpretation finesses is in `Knowledge.finessed`. Until it plays it
  counts as clued: it is never the new card when working out a clue's focus, and it is not the
  player's finesse position.
- **Judgment call:** while a finesse is still one of several readings, its card is not yet finessed.

## `prompts-before-finesses`

- **Source:** [level 1](https://hanabi.github.io/level-1#prompts--finesses).
- **Rule:** a player with a clued card that could be the missing card is prompted, never finessed, so
  their finesse position is not read as a finesse.

## `trash`

- **Source:** [level 1](https://hanabi.github.io/level-1#the-definition-of-trash).
- **Definition:** a card that can never play (on its stack already, or a lower card of its suit has every
  copy discarded), or a card another clued card already is.

## Private knowledge

`privateKnowledge` narrows common knowledge with what the viewer sees: visible cards are known, copies
the viewer can see are counted out, and under Good Touch the viewer's clued cards are not any clued card
they can see in another hand. Each pending clue then keeps only the interpretations that fit, so Bob,
seeing Cathy's red 4, knows his clued red card is the prompted red 3.

## How moves are ranked

`rankMoves(view, level)` reads the game once, then judges every legal move from what the viewer knows
(their private knowledge). Each move gets a category (`mandated`, `permitted` or `violates`), a score
that orders moves within a category, and reasons naming the conventions behind it. Moves rank by
category, then score, then a fixed order: plays, discards, then clues by seat and clue.

- **Plays:** a card the viewer knows is playable is permitted. It is mandated when a prompt or finesse
  still possible from the viewer's side is waiting on it. Any other play violates the conventions,
  since it may strike.
- **Discards:** known trash is permitted, and scores above the chop. Discarding the chop is permitted,
  except in the Early Game (below). Discarding a clued or finessed card, or an unclued card off chop,
  violates the conventions. (Chop moves are level 4.)
- **Clues:** the viewer reads the clue as the table would (`advance` on a clue event), then works out
  what the receiver would keep. A clue is permitted when the real identity of its focus is among the
  interpretations the receiver keeps and every connection is real: the prompted card is the leftmost
  candidate, and the finesse position holds the card. Otherwise it is misread and violates the
  conventions. A permitted clue can still fail one of the principles below.
- **Scores:** a clue scores for each new card it gets, for a focus that is playable now and for each
  connecting card. Among violations, the score puts the least harmful first: a clue that gets nothing,
  then one that means nothing at the table's level, then discards and clues that lose or mislead about
  cards, and a play that may strike last.
- **Judgment call:** the receiver sees every card the viewer sees except their own hand. The viewer
  can't see their own hand either, so those cards count as anything the viewer thinks they could be.
  This is cautious: a clue that only works because the receiver sees one of the viewer's cards is
  called misread.
- **Judgment call:** a clue whose card may be a copy of one of the viewer's own clued cards scores
  lower. The viewer can't tell, and Good Touch would make the receiver's card look like a different one.

## `save-principle`

- **Source:** [beginner/save-principle](https://hanabi.github.io/beginner/save-principle).
- **Rule:** the team never lets a 5, a unique 2 (no other copy visible), a critical card or a unique
  playable card be discarded. It overrides every other rule, Good Touch included.
- **Ranking:** a clue that saves such a card from the next player's chop is mandated when they have
  nothing better to do: no clued card the table knows is playable, and no known trash. A save that
  breaks Good Touch is still permitted (or mandated), but scores lower for each trash card it touches.
  The site's example has both blue and 3 breaking Good Touch to save the last blue 3, and blue scores
  higher because one of the blue 4's it touches is useful.
- **Judgment call:** only the next player's chop is urgent. A card on a later player's chop can be
  saved by someone else before that player discards.

## `minimum-clue-value`

- **Source:** [beginner/minimum-clue-value-principle](https://hanabi.github.io/beginner/minimum-clue-value-principle).
- **Rule:** every clue must get at least one previously unclued card played or saved. A clue that only
  re-touches cards (a Tempo Clue) or only touches trash violates it.
- **Ranking:** such a clue is still the least harmful violation, so it ranks first among them when a
  player can't discard (clue tokens are full) and has nothing else to do.

## `early-game`

- **Source:** [level 1](https://hanabi.github.io/level-1#the-early-game).
- **Rule:** before anyone has discarded, every available play and save clue is given before a player
  discards their chop.
- **Ranking:** discarding the chop violates it while any clue is permitted. Discarding known trash
  does not end the Early Game, so it is not affected.
- **Judgment call:** the Early Game ends at the first discard of any card, read from the log.

## `2-save`: the Visible Rule

- **Source:** [level 1](https://hanabi.github.io/level-1#the-visible-rule).
- **Ranking:** a 2 Save on a 2 whose other copy is visible in another hand violates the conventions,
  unless that copy is on its holder's chop too (Double Chop 2's). The reading is unchanged: the receiver
  can't see their own 2, so they read the clue the same way.
