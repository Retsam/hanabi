# Level 1 conventions: clue reading

Specs for the level 1 conventions `@hanabi/hgroup` implements so far, by their ids in
[H-GROUP-LEVELS.md](../H-GROUP-LEVELS.md). Each one names its source on
[hanabi.github.io](https://hanabi.github.io/) (summarised here; the site's content is CC BY-SA 4.0), what
it needs, how it reads a clue, what it rules out, and the calls we made where the site leaves room.
The tests are in `packages/hgroup/src/knowledge.test.ts`, mostly built from the site's own examples.

Prompts and finesses (`prompt`, `finesse`, `finesse-position`, `finessed-cards-count-as-clued`,
`prompts-before-finesses`) arrive in Phase 2 step 3. The principles that rank moves rather than read
them (`save-principle`, `minimum-clue-value`, `early-game`, and Good Touch as a rule for the clue giver)
arrive with the ranked output in step 4.

## How a clue is read

`readClue` reads one clue from the table as it was just before the clue. Every reading has a focus and
a list of interpretations, each saying what the focus is, whether as a play or a save clue, and by which
conventions. `focusCards` collects the focus cards across them, and the focus's common knowledge becomes
that set. When there are no interpretations the clue is off-convention: it means nothing at the table's
level and only its rules-level information is kept.

The receiver reads a clue with every clued card they can identify: cards in other hands by sight, and
cards in their own hand only through common knowledge.

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
- "New" means unclued before this clue. From step 3, finessed cards will count as clued.

## `play-clue` and `delayed-play-clue`

- **Source:** [beginner/play-clues](https://hanabi.github.io/beginner/play-clues),
  [beginner/delayed-play-clues](https://hanabi.github.io/beginner/delayed-play-clues),
  [level 1](https://hanabi.github.io/level-1#the-definition-of-playable).
- **Reading:** a play clue says the focus is the next card its suit needs once every clued card the
  receiver can identify has played. Each suit offers at most one such card (more only in the case
  below). The focus is whichever of those the clue could touch.
- **Rules out:** everything else the clue could touch.
- **Tempo clues:** a clue that touches nothing new is a play clue on its focus (the leftmost re-touched
  card), as in the site's tempo clue example.
- **Judgment call (the viewer's own clued cards):** when someone else receives the clue, the viewer can't
  see their own clued cards, though the receiver can. If one of them is not identified in common
  knowledge, a chain through it is treated as possible, so the reading is a superset of the receiver's.
  For example, when Cathy holds clued 1's she can't identify, she reads Bob's 2 clue as possibly delayed
  through any of them.

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

## `trash`

- **Source:** [level 1](https://hanabi.github.io/level-1#the-definition-of-trash).
- **Definition:** a card that can never play (on its stack already, or a lower card of its suit has every
  copy discarded), or a card another clued card already is.

## Private knowledge

`privateKnowledge` narrows common knowledge with what the viewer sees: visible cards are known, copies
the viewer can see are counted out, and under Good Touch the viewer's clued cards are not any clued card
they can see in another hand.
