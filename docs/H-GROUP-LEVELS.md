# H-Group convention levels

The AI is meant to work as a decision engine that follows [H-Group conventions](https://hanabi.github.io/).
H-Group sorts its conventions into 25 cumulative levels, plus a page of rarely-used extras. A group playing
at level N uses every convention from levels 1 to N and nothing above. This document lists what each level
introduces, so the engine can be told which conventions it may assume its teammates know.

The source is the [H-Group learning path](https://hanabi.github.io/learning-path) and the 25 level pages
behind it, read on 2026-10-04. Each entry is a one-line summary for orientation. The linked section on
hanabi.github.io is authoritative. When the engine implements a convention, read that section in full,
because most of them have edge cases and worked examples that a summary can't carry.

## How to read this document

Every convention has a stable `id` in kebab-case. Code that gates conventions by level should use these
ids, so a convention keeps its id even if H-Group renames it.

The `kind` column says how the entry matters to a decision engine:

| Kind        | Meaning                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------- |
| `term`      | A definition other conventions depend on (chop, finesse position, trash).                     |
| `clue`      | Gives a clue a meaning. It affects both how a clue is read and which clues may be suggested.  |
| `play`      | Says which card to play or blind-play, or when.                                               |
| `discard`   | Gives a discard (or a deliberate misplay) a meaning.                                          |
| `principle` | Strategy guidance. It changes how moves are ranked, not what they mean.                       |
| `illegal`   | A move H-Group explicitly forbids. The engine should never suggest it or read a move as it.   |
| `mistake`   | A named error and how the team recovers from it. Useful for review, not for suggesting moves. |

Three points about levels matter for the engine:

- **Levels are cumulative.** A level 5 player uses everything from levels 1 to 5.
- **Later levels change earlier meanings.** Some conventions reinterpret a clue that meant something
  simpler at a lower level. For example, from level 19 a number 5 clue in the _Low Score Phase_ is never a
  play clue. These are listed under [Overrides](#overrides-later-levels-changing-earlier-meanings), and
  the engine has to apply them according to the level in force.
- **Below a convention's level, the move is not a convention.** At level 10, a move that would be a level
  11 _Bluff_ just looks like a bad clue. The engine should not suggest it, and when reading a teammate's
  move it should look for a lower-level explanation first.

## Level summary

| Level | Name                   | Main conventions (as H-Group lists them)                                      |
| ----- | ---------------------- | ----------------------------------------------------------------------------- |
| 1     | Fundamentals           | Early Game, Prompts, Finesses (plus the whole beginner's guide)               |
| 2     | Basic Finesses         | 5 Stalls, Double Finesses, Reverse Finesses, Self-Finesses                    |
| 3     | Basic Strategy         | Playing Multiple 1's, Fix Clues, Sarcastic Discards                           |
| 4     | Chop Moves             | Trash Chop Move, 5's Chop Move, Order Chop Move                               |
| 5     | Intermediate Finesses  | Hidden, Layered, Clandestine, Queued and Ambiguous Finesses                   |
| 6     | Tempo Clues            | Tempo Clue Chop Move                                                          |
| 7     | Last Resorts           | Scream Discard Chop Move, Shout Discard Chop Move, Generation Discard         |
| 8     | End-Game               | Positional Discards, Positional Misplays                                      |
| 9     | Stalling               | Double Discard Avoidance, Locked Hand Saves, 8 Clue Saves                     |
| 10    | Special Discards       | Gentleman's Discard, Baton Discard, Sarcastic Finesse, Certain Finesse        |
| 11    | Bluffs                 | Bluffs                                                                        |
| 12    | Context                | Stale 1's Clues, Focus Inversion                                              |
| 13    | Intermediate Bluffs    | 3 Bluffs, Critical Color Bluffs, Good Touch Bluff                             |
| 14    | Trash Moves            | Trash Order Chop Move, Trash Finesse, Trash Bluff, Trash Push                 |
| 15    | Double Bluffs          | Double Bluffs, Pestilent Double Bluffs                                        |
| 16    | Ejections & Discharges | 5 Color Ejection, Unknown Trash Discharge, Unknown Dupe Discharge             |
| 17    | Dupe Tech              | Duplicitous Clues, Assisted Trash Chop Move, Time Travel Chop Move            |
| 18    | Elimination            | Elimination                                                                   |
| 19    | 5 Tech                 | Early 5's Chop Move, 5 Pulls, 5 Number Ejection, 5 Number Discharge           |
| 20    | Advanced Moves         | Occupied Play Clue, Out-of-Order Finesse, Suboptimal and No-Information moves |
| 21    | Ignition               | Trash, Replay and Poke Double Ignition, Chop Move Ignition                    |
| 22    | Emergency Discards     | Echo Scream Discard Chop Move                                                 |
| 23    | Charms & Miscellaneous | 4 Charm, Blaze Discard, Hesitation Blind-Play                                 |
| 24    | Unnecessary Moves      | Unnecessary Moves                                                             |
| 25    | Priority               | Priority                                                                      |
| Extra | n/a                    | Rarely-used conventions and edge cases; not part of any level                 |

The detailed lists below include every convention on each level page, not only the headline ones. Section
headings that are only examples, website features or challenge questions are left out.

## Level 1: Fundamentals

Source: [beginner's guide](https://hanabi.github.io/beginner) and [level 1](https://hanabi.github.io/level-1).
Level 1 is everything in the beginner's guide; the level 1 page restates it with more precise definitions.

Implemented so far: `chop`, `trash`, `clue-focus`, `good-touch`, `play-clue`, `delayed-play-clue`,
`save-clue`, `5-save`, `2-save`, `critical-save`, `prompt`, `finesse`, `finesse-position`,
`finessed-cards-count-as-clued` and `prompts-before-finesses` (reading clues), and `save-principle`,
`minimum-clue-value` and `early-game` (ranking moves). From level 2: `5-stall`, `multi-prompt`, `multi-finesse` and `prompt-plus-finesse`. Specs:
[conventions/level-1.md](./conventions/level-1.md), [conventions/level-2.md](./conventions/level-2.md).

| ID                              | Convention                                                                                     | Kind        | Summary                                                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `chop`                          | [The Chop](https://hanabi.github.io/level-1#the-chop)                                          | `term`      | A player's chop is the card they would discard next: their oldest (rightmost) unclued card. Known trash is discarded before chop.                            |
| `playable`                      | [Definition of Playable](https://hanabi.github.io/level-1#the-definition-of-playable)          | `term`      | An unclued card is "playable" if a play clue or a delayed play clue could legally be given to it.                                                            |
| `trash`                         | [Definition of Trash](https://hanabi.github.io/level-1#the-definition-of-trash)                | `term`      | A card is trash if it can never play, or if another copy of it is already clued.                                                                             |
| `play-clue`                     | [Play Clues](https://hanabi.github.io/beginner/play-clues)                                     | `clue`      | A clue whose focus is not a save promises that the focused card is playable now.                                                                             |
| `delayed-play-clue`             | [Delayed Play Clues](https://hanabi.github.io/beginner/delayed-play-clues)                     | `clue`      | A play clue may target a card that becomes playable once already-clued (or finessed) cards play.                                                             |
| `save-clue`                     | [Save Clues](https://hanabi.github.io/level-1#save-clues)                                      | `clue`      | Only a card on chop may be saved, and only a 5 (number 5), a 2 (number 2) or a critical card. Off-chop focus means a play clue.                              |
| `5-save`                        | [The 5 Save](https://hanabi.github.io/level-1#the-5-save)                                      | `clue`      | A number 5 clue on a chop 5 is a save, not a play clue. A color clue on the 5 is a play clue.                                                                |
| `2-save`                        | [The 2 Save](https://hanabi.github.io/level-1#the-2-save)                                      | `clue`      | A number 2 clue on a chop 2 is a save. Not allowed when the other copy is visible in another hand (the Visible Rule), with an exception for double chop 2's. |
| `critical-save`                 | [Critical Saves](https://hanabi.github.io/beginner/critical-save)                              | `clue`      | A critical card on chop may be saved with either a color or a number clue.                                                                                   |
| `clue-focus`                    | [Clue Focus](https://hanabi.github.io/level-1#clue-focus)                                      | `term`      | Every clue has one focus: the chop if it was newly touched, else the leftmost newly touched card, else the leftmost re-touched card.                         |
| `good-touch`                    | [Good Touch Principle](https://hanabi.github.io/beginner/good-touch-principle)                 | `principle` | Only touch cards that will eventually play. So clued cards are assumed not to be trash.                                                                      |
| `save-principle`                | [Save Principle](https://hanabi.github.io/beginner/save-principle)                             | `principle` | Never let a critical card, a unique playable card or a 2 be discarded.                                                                                       |
| `minimum-clue-value`            | [Minimum Clue Value Principle](https://hanabi.github.io/beginner/minimum-clue-value-principle) | `principle` | Every clue must get at least one new card (play or save). A clue that gets nothing is illegal outside stalling situations.                                   |
| `early-game`                    | [The Early Game](https://hanabi.github.io/level-1#the-early-game)                              | `term`      | The period before anyone discards. Players must give every available play and save clue before discarding to end it.                                         |
| `prompt`                        | [The Prompt](https://hanabi.github.io/level-1#the-prompt)                                      | `clue`      | A play clue on a card that needs a connecting card makes the holder of a matching clued card play it (leftmost if several).                                  |
| `finesse`                       | [The Finesse](https://hanabi.github.io/level-1#the-finesse)                                    | `clue`      | A play clue on a card that needs a connecting card nobody has clued makes the right player blind-play their finesse position.                                |
| `finesse-position`              | [Finesse Position](https://hanabi.github.io/level-1#finesse-position)                          | `term`      | A player's leftmost unclued card. Finessed cards count as clued for this.                                                                                    |
| `finessed-cards-count-as-clued` | [Finessed Cards](https://hanabi.github.io/level-1#finessed-cards)                              | `term`      | A finessed card carries an invisible clue, so it is never the "new" card when a clue's focus is worked out.                                                  |
| `prompts-before-finesses`       | [Prompts > Finesses](https://hanabi.github.io/level-1#prompts--finesses)                       | `play`      | When a clue could be either, a player always assumes a prompt on their clued card before blind-playing.                                                      |

## Level 2: Basic Finesses

Source: [level 2](https://hanabi.github.io/level-2).

| ID                       | Convention                                                                                                        | Kind        | Summary                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `5-stall`                | [The 5 Stall](https://hanabi.github.io/level-2#the-5-stall-cluing-off-chop-5s)                                    | `clue`      | In the Early Game (or another stalling situation), a number 5 clue to an off-chop 5 is a stall, not a play clue.                         |
| `multi-prompt`           | [Double / Triple Prompt](https://hanabi.github.io/level-2#the-double-prompt--triple-prompt--quadruple-prompt)     | `clue`      | One clue can prompt two or more clued cards in a row.                                                                                    |
| `multi-finesse`          | [Double / Triple Finesse](https://hanabi.github.io/level-2#the-double-finesse--triple-finesse--quadruple-finesse) | `clue`      | A clue to a card two or more away from playable makes several finesse positions blind-play, across players or within one hand.           |
| `prompt-plus-finesse`    | [The Prompt + Finesse](https://hanabi.github.io/level-2#the-prompt--finesse)                                      | `clue`      | One player can be prompted for one connecting card and then finessed for the next.                                                       |
| `reverse-finesse`        | [The Reverse Finesse](https://hanabi.github.io/level-2#the-reverse-finesse)                                       | `clue`      | A finesse where the clued player acts before the blind-player. Players must check others' finesse positions before playing a clued card. |
| `self-finesse`           | [The Self-Finesse](https://hanabi.github.io/level-2#the-self-finesse)                                             | `clue`      | A finesse on the clue receiver's own finesse position, recognised when nobody else blind-plays.                                          |
| `one-away-from-playable` | [One-Away-From-Playable Cards](https://hanabi.github.io/level-2#one-away-from-playable-cards)                     | `term`      | A card that would become playable after one more card is play-clued. Such cards can't be play-clued directly without a finesse.          |
| `stomping`               | [Stomping on a Finesse](https://hanabi.github.io/level-2#stomping-on-a-finesse)                                   | `mistake`   | Directly cluing a card that was already going to blind-play wastes the clue.                                                             |
| `after-a-strike`         | [What to Do After a Strike](https://hanabi.github.io/level-2#what-to-do-after-a-strike)                           | `principle` | After a misplay, make no further assumptions from the clue that caused it; two strikes in a row are very bad.                            |
| `wrong-prompt`           | [The Wrong Prompt](https://hanabi.github.io/level-2#the-wrong-prompt)                                             | `mistake`   | If a prompted card misplays, the cluer probably meant a finesse; the prompted player should blind-play next.                             |

## Level 3: Basic Strategy

Source: [level 3](https://hanabi.github.io/level-3).

| ID                  | Convention                                                                                                             | Kind        | Summary                                                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `play-order-1s`     | [Playing Multiple 1's](https://hanabi.github.io/level-3#playing-multiple-1s)                                           | `play`      | Clued 1's are all playable. Starting-hand 1's play oldest first, other 1's newest first. Freshly drawn 1's play before starting-hand ones (Fresh 1's Rule), unless chop focus says otherwise. |
| `fix-clue`          | [The Fix Clue](https://hanabi.github.io/level-3#the-fix-clue)                                                          | `clue`      | A clue that reveals a touched card is a duplicate or unplayable. Fix clues should be given as soon as possible.                                                                               |
| `fix-clue-multiple` | [Fix Clue touching multiple cards](https://hanabi.github.io/level-3#the-fix-clue-that-touches-multiple-cards)          | `clue`      | A clue cannot be a fix and a play clue at once; other cards a fix clue touches are not promised playable.                                                                                     |
| `fix-clue-no-info`  | [Fix Clue with no new information](https://hanabi.github.io/level-3#the-fix-clue-that-gives-no-additional-information) | `clue`      | Re-cluing a card that was already going to play marks it as bad (fixes exactly one card).                                                                                                     |
| `sarcastic-discard` | [The Sarcastic Discard](https://hanabi.github.io/level-3#the-sarcastic-discard-sd)                                     | `discard`   | The first player to realise a clued card is duplicated in another hand discards it, telling the other holder exactly what theirs is.                                                          |
| `misplay-cost`      | [Misplay Cost Principle](https://hanabi.github.io/level-3#misplay-cost-principle)                                      | `principle` | Spending one clue to stop one misplay is worth it; spending two usually is not, unless the strike would lose the game.                                                                        |
| `efficiency`        | [Efficiency](https://hanabi.github.io/level-3#efficiency)                                                              | `principle` | Prefer clues that get more cards (2-for-1 beats 1-for-1).                                                                                                                                     |
| `tempo`             | [Tempo](https://hanabi.github.io/level-3#tempo)                                                                        | `principle` | Balance efficiency against how fast cards are played; tempo matters more later in the game.                                                                                                   |
| `information-lock`  | [Information Lock Principle](https://hanabi.github.io/level-3#information-lock-principle)                              | `principle` | Once a clue fixes a card's identity (or set of identities), later clues can't change that assumed identity.                                                                                   |

## Level 4: Chop Moves

Source: [level 4](https://hanabi.github.io/level-4).

| ID                          | Convention                                                                                                          | Kind      | Summary                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| `chop-move`                 | [Chop Moves](https://hanabi.github.io/level-4#chop-moves)                                                           | `term`    | Marks a chop card as important without cluing it. The card is treated as invisibly clued, permanently, and chop moves left. |
| `trash-chop-move`           | [Trash Chop Move (TCM)](https://hanabi.github.io/level-4#the-trash-chop-move-tcm)                                   | `clue`    | Cluing known trash off chop chop-moves every unclued card to the right of it.                                               |
| `5s-chop-move`              | [5's Chop Move (5CM)](https://hanabi.github.io/level-4#the-5s-chop-move-5cm)                                        | `clue`    | A number 5 clue to a 5 one away from chop (outside stalling) chop-moves the chop card.                                      |
| `order-chop-move`           | [Order Chop Move (OCM)](https://hanabi.github.io/level-4#the-order-chop-move-ocm)                                   | `play`    | Playing unknown 1's out of order chop-moves the player as many seats away as 1's were skipped.                              |
| `chop-moves-are-not-saves`  | [Chop Moves as a Category](https://hanabi.github.io/level-4#chop-moves-as-a-category)                               | `term`    | Chop moves are their own category, not save clues: they talk about a different card than the one touched.                   |
| `chop-moves-and-new-clues`  | [Chop Moves & New Clues](https://hanabi.github.io/level-4#chop-moves--new-clues)                                    | `term`    | Chop-moved cards count as already clued when working out a new clue's focus.                                                |
| `chop-moves-and-prompts`    | [Chop Moves & Prompts](https://hanabi.github.io/level-4#chop-moves--prompts)                                        | `play`    | Chop-moved cards are never played into prompts.                                                                             |
| `critical-discard-after-cm` | [Critical Discards after a Chop Move](https://hanabi.github.io/level-4#critical-discards-after-a-chop-move-mistake) | `mistake` | If the next discard after a chop move is critical, the chop move was unintended and is undone.                              |
| `accidental-chop-move`      | [Accidental Chop Moves](https://hanabi.github.io/level-4#accidental-chop-moves-mistake)                             | `mistake` | Otherwise, never undo a chop move, even one made by mistake.                                                                |

## Level 5: Intermediate Finesses

Source: [level 5](https://hanabi.github.io/level-5).

| ID                     | Convention                                                                                                        | Kind        | Summary                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| `multi-color-prompts`  | [Prompts in Multi-Color Variants](https://hanabi.github.io/level-5#prompts-in-multi-color-variants)               | `play`      | Variants only: prompt the card with the most positive information. Negative information is ignored.                        |
| `hidden-finesse`       | [The Hidden Finesse](https://hanabi.github.io/level-5#the-hidden-finesse)                                         | `clue`      | A finesse hidden behind a prompted clued card that is itself playable; the player blind-plays after the prompt.            |
| `layered-finesse`      | [The Layered Finesse](https://hanabi.github.io/level-5#the-layered-finesse)                                       | `clue`      | A finesse whose target sits behind other playable cards; the player keeps blind-playing until the promised card comes out. |
| `clandestine-finesse`  | [The Clandestine Finesse](https://hanabi.github.io/level-5#the-clandestine-finesse)                               | `clue`      | A layered finesse where the cards played first also connect to the clue, so the receiver must not stop early.              |
| `queued-finesse`       | [The Queued Finesse](https://hanabi.github.io/level-5#the-queued-finesse)                                         | `clue`      | A second finesse on an already-finessed player targets their next finesse position; blind-plays resolve in order.          |
| `ambiguous-finesse`    | [The Ambiguous Finesse](https://hanabi.github.io/level-5#the-ambiguous-finesse)                                   | `play`      | When several players could hold the finessed card, the first one to pass shows the later one has it.                       |
| `layered-finesse-dupe` | [The Layered Finesse Dupe Clue](https://hanabi.github.io/level-5#the-layered-finesse-dupe-clue)                   | `discard`   | A player inside a layered finesse may accidentally clue a card they already hold; the clued player discards it back.       |
| `urgency`              | [Urgency Principle](https://hanabi.github.io/level-5#urgency-principle-playing-into-finesses-as-soon-as-possible) | `play`      | Blind-play into a finesse as soon as possible. Deferring is allowed only to give a finesse-type clue or an urgent save.    |
| `schrodingers-cat`     | [Schrödinger's Cat Principle](https://hanabi.github.io/level-5#schrödingers-cat-principle)                        | `principle` | A clued card is every possibility at once until teammates' actions resolve it.                                             |

## Level 6: Tempo Clues

Source: [level 6](https://hanabi.github.io/level-6).

| ID                           | Convention                                                                                              | Kind        | Summary                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `tempo-clue`                 | [The Tempo Clue](https://hanabi.github.io/level-6#the-tempo-clue)                                       | `clue`      | A clue that touches no new cards and gets an already-clued card to play. Focus is the leftmost re-touched card.         |
| `valuable-tempo-clue`        | [The Valuable Tempo Clue](https://hanabi.github.io/level-6#the-valuable-tempo-clue)                     | `clue`      | A tempo clue is allowed if it gets two or more cards played, unblocks a prompt, or unlocks a locked hand.               |
| `tempo-clue-stall`           | [The Tempo Clue Stall](https://hanabi.github.io/level-6#the-tempo-clue-stall-a-non-valuable-tempo-clue) | `clue`      | A non-valuable tempo clue given in a stalling situation is just a stall.                                                |
| `tempo-clue-chop-move`       | [Tempo Clue Chop Move (TCCM)](https://hanabi.github.io/level-6#the-tempo-clue-chop-move-tccm)           | `clue`      | A non-valuable tempo clue outside a stalling situation also chop-moves the receiver.                                    |
| `chop-moves-and-tempo-clues` | [Chop Moves & Tempo Clues](https://hanabi.github.io/level-6#chop-moves--tempo-clues)                    | `term`      | A play clue that first touches a chop-moved card is a normal play clue, not a tempo clue.                               |
| `focus-shifting`             | [Focus Shifting](https://hanabi.github.io/level-6#focus-shifting)                                       | `clue`      | If a play clue's normal focus is already known playable, the focus shifts to the next leftmost touched card that isn't. |
| `discard-modulation`         | [Discard Modulation](https://hanabi.github.io/level-6#discard-modulation)                               | `principle` | If you and the next player could give the same clue, discard if their chop is valuable, otherwise clue.                 |
| `value-of-one-away`          | [Value of One-Away Cards](https://hanabi.github.io/level-6#the-value-of-one-away-from-playable-cards)   | `principle` | One-away-from-playable cards are high value and are good targets for chop moves.                                        |
| `clarity`                    | [Clarity Principle](https://hanabi.github.io/level-6#clarity-principle-part-1)                          | `principle` | Between lines with the same (or nearly the same) outcome, prefer the least complicated one.                             |

## Level 7: Last Resorts

Source: [level 7](https://hanabi.github.io/level-7).

| ID                           | Convention                                                                                                        | Kind        | Summary                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `scream-discard-chop-move`   | [Scream Discard Chop Move (SDCM)](https://hanabi.github.io/level-7#the-scream-discard-chop-move-sdcm)             | `discard`   | Discarding chop while holding a known playable card makes the next player chop-move once and forbids them from discarding this turn. |
| `scream-discard-known-trash` | [Scream Discard with Known Trash](https://hanabi.github.io/level-7#the-scream-discard-chop-move-with-known-trash) | `discard`   | Discarding chop instead of a known-trash card is also a scream discard.                                                              |
| `shout-discard-chop-move`    | [The Shout Discard Chop Move](https://hanabi.github.io/level-7#the-shout-discard-chop-move)                       | `discard`   | Discarding known trash instead of playing a known playable card has the same effect as a scream discard.                             |
| `generation-discard`         | [The Generation Discard](https://hanabi.github.io/level-7#the-generation-discard)                                 | `discard`   | A discard instead of a play, only so the next player has a clue to save the player after them. No chop move.                         |
| `lines`                      | [Lines](https://hanabi.github.io/level-7#lines)                                                                   | `principle` | Pick moves by predicting the sequence of moves that follows them.                                                                    |
| `all-4s-test`                | [The All 4's Test](https://hanabi.github.io/level-7#the-all-4s-test)                                              | `principle` | A line is unsafe if it loses a critical card when your own hand is all useless 4's.                                                  |
| `riding`                     | [Riding](https://hanabi.github.io/level-7#the-definition-of-riding)                                               | `term`      | An important chop card is "riding" when the team can't afford to save it and hopes its owner clues instead of discarding.            |
| `blind-playing-chop-moved`   | [Blind-Playing Chop Moved Cards](https://hanabi.github.io/level-7#blind-playing-chop-moved-cards)                 | `play`      | A player may blind-play a chop-moved card once accumulated information makes it very likely playable.                                |

## Level 8: End-Game

Source: [level 8](https://hanabi.github.io/level-8).

| ID                          | Convention                                                                                                                          | Kind        | Summary                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `end-game`                  | [The End-Game](https://hanabi.github.io/level-8#the-end-game)                                                                       | `term`      | The End-Game starts when pace is below the number of players. Tempo matters more than efficiency.                   |
| `no-chop-moves-in-end-game` | [No Chop Moves in the End-Game](https://hanabi.github.io/level-8#no-chop-moves-in-the-end-game)                                     | `clue`      | Chop moves are off in the End-Game; a clue that looks like one is read as the next simplest thing, usually a stall. |
| `positional-discard`        | [The Positional Discard](https://hanabi.github.io/level-8#the-positional-discard-indicating-a-play-with-a-discard)                  | `discard`   | At the very end, discarding an unexpected slot tells another player to blind-play the same slot.                    |
| `positional-misplay`        | [The Positional Misplay](https://hanabi.github.io/level-8#the-positional-misplay-indicating-a-play-with-a-misplay)                  | `discard`   | A deliberate misplay from a slot, used when a positional discard from that slot would look normal.                  |
| `double-positional-misplay` | [The Double Positional Misplay](https://hanabi.github.io/level-8#the-double-positional-misplay-indicating-two-plays-with-a-misplay) | `discard`   | A positional misplay where a positional discard would have worked promises two blind-plays.                         |
| `distribution-clue`         | [The Distribution Clue](https://hanabi.github.io/level-8#the-distribution-clue)                                                     | `clue`      | In the End-Game, duplicating a loaded player's playable card in another hand so plays are spread out.               |
| `team-distribution`         | [Team Distribution Principle](https://hanabi.github.io/level-8#team-distribution-principle)                                         | `principle` | Useful cards should be spread evenly across the team.                                                               |
| `pace-plus-one`             | [The Pace +1 Rule](https://hanabi.github.io/level-8#the-pace-1-rule)                                                                | `principle` | At pace +1, a player with no playable cards should make the final discard rather than you.                          |
| `burning`                   | [Burning (End-Game Stalling)](https://hanabi.github.io/level-8#burning-end-game-stalling)                                           | `clue`      | In the End-Game, a deliberately useless clue (usually re-cluing known playables) to avoid drawing.                  |
| `end-game-strategy`         | [End-Game Strategy](https://hanabi.github.io/level-8#end-game-strategy)                                                             | `principle` | Plan end-games by working out which cards remain, who should draw, and whether stalling beats playing.              |

## Level 9: Stalling

Source: [level 9](https://hanabi.github.io/level-9).

| ID                         | Convention                                                                                                                                            | Kind   | Summary                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stalling-situations`      | [Stalling Situations](https://hanabi.github.io/level-9#stalling-situations)                                                                           | `term` | Situations where discarding is unsafe, so otherwise-illegal low-value clues are allowed. Each has a severity (below).                                   |
| `stall-table`              | [Allowable Stall Clues](https://hanabi.github.io/level-9#allowable-stall-clues-stall-table)                                                           | `clue` | Which stall clues are allowed at each severity, in precedence order. See the [stall table](#stall-table).                                               |
| `early-game-rules`         | [The Early Game (Severity 1)](https://hanabi.github.io/level-9#the-early-game-severity-1-stalling)                                                    | `term` | Extra Early Game rules: when exactly it ends, extinguishing every clue, and Permission to Discard.                                                      |
| `double-discard-avoidance` | [Double Discard Avoidance (Severity 2)](https://hanabi.github.io/level-9#double-discard-situations--double-discard-avoidance-dda-severity-2-stalling) | `term` | After a player discards an unknown card, the next player should not discard if it could lose the other copy.                                            |
| `locked-hand`              | [Locked Hands (Severity 3)](https://hanabi.github.io/level-9#locked-hands-severity-3-stalling)                                                        | `term` | A fully clued (or chop-moved) hand can't discard and may stall. With no clues left, someone must discard to give them one.                              |
| `eight-clue-stall`         | [Clues at 8 Clues (Severity 4)](https://hanabi.github.io/level-9#clues-given-while-at-8-clues-severity-4-stalling)                                    | `term` | At 8 clues mid-game a player cannot discard, so low-value clues are allowed.                                                                            |
| `5-stall-advanced`         | [The 5 Stall (Intermediate)](https://hanabi.github.io/level-9#the-5-stall-intermediate-section)                                                       | `clue` | Extra 5 Stall rules: the team owes one in the Early Game, stall on the 5 closest to chop, stalls are a last resort, and the Finesse Position Exception. |
| `fill-in-clue`             | [The Fill-In Clue](https://hanabi.github.io/level-9#the-fill-in-clue)                                                                                 | `clue` | A stall clue that only adds information to already-clued or chop-moved cards.                                                                           |
| `locked-hand-save`         | [The Locked Hand Save (LHS)](https://hanabi.github.io/level-9#the-locked-hand-save-lhs)                                                               | `clue` | A locked player may save any chop card, as long as it doesn't lock the receiver.                                                                        |
| `anxiety-play`             | [The Anxiety Play](https://hanabi.github.io/level-9#the-anxiety-play-forcing-a-locked-player-to-play)                                                 | `play` | Leaving a locked player at 0 clues tells them a card is playable; they play the most likely (leftmost if tied).                                         |
| `8-clue-save`              | [The 8 Clue Save (8CS)](https://hanabi.github.io/level-9#the-8-clue-save-8cs)                                                                         | `clue` | At 8 clues, a player may save any card not in slot 1, on or off chop.                                                                                   |

## Level 10: Special Discards

Source: [level 10](https://hanabi.github.io/level-10).

| ID                           | Convention                                                                                                          | Kind      | Summary                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| `gentlemans-discard`         | [The Gentleman's Discard (GD)](https://hanabi.github.io/level-10#the-gentlemans-discard-gd)                         | `discard` | Discarding a known playable card that sits on a teammate's finesse position, so they blind-play it.                         |
| `layered-gentlemans-discard` | [The Layered Gentleman's Discard](https://hanabi.github.io/level-10#the-layered-gentlemans-discard)                 | `discard` | A gentleman's discard where the matching card sits behind other playable cards, like a layered finesse.                     |
| `baton-discard`              | [The Baton Discard (BD)](https://hanabi.github.io/level-10#the-baton-discard-bd)                                    | `discard` | Discarding a fully known but unplayable card to show the other copy is on a teammate's finesse position.                    |
| `sarcastic-finesse`          | [The Sarcastic Finesse](https://hanabi.github.io/level-10#the-sarcastic-finesse)                                    | `clue`    | A finesse whose clued card duplicates the cluer's own unknown clued card; the receiver sarcastic-discards.                  |
| `certain-finesse`            | [The Certain Finesse & Certain Discard](https://hanabi.github.io/level-10#the-certain-finesse--the-certain-discard) | `clue`    | A finesse whose blind card may duplicate the cluer's clued card; the blind-player discards it (certain discard) to resolve. |
| `composition-finesse`        | [The Composition Finesse](https://hanabi.github.io/level-10#the-composition-finesse)                                | `clue`    | A finesse that is both sarcastic and certain at once.                                                                       |
| `double-gentlemans-discard`  | [The Double Gentleman's Discard](https://hanabi.github.io/level-10#the-double-gentlemans-discard-illegal)           | `illegal` | A gentleman's discard only gets the one specific matching card, never two possibilities.                                    |

## Level 11: Bluffs

Source: [level 11](https://hanabi.github.io/level-11).

| ID                         | Convention                                                                                                           | Kind        | Summary                                                                                                                                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bluff`                    | [The Bluff](https://hanabi.github.io/level-11#the-bluff)                                                             | `clue`      | A play clue on a one-away card makes the next player blind-play an unrelated card; the clued card is then known to be one-away. Only from bluff seat (the player immediately before), and must resolve immediately (Lie Principle). |
| `self-bluff`               | [The Self-Bluff](https://hanabi.github.io/level-11#the-self-bluff)                                                   | `clue`      | A rank clue that makes the receiver blind-play their own finesse position as a bluff.                                                                                                                                               |
| `bluff-through-clued`      | [Bluffs Through Already-Clued Cards](https://hanabi.github.io/level-11#bluffs-through-already-clued-cards)           | `clue`      | A bluff may connect through cards already clued in other hands.                                                                                                                                                                     |
| `bobs-truth`               | [Bob's Truth Principle](https://hanabi.github.io/level-11#bobs-truth-principle-part-1)                               | `play`      | The player right after the cluer always assumes a finesse over a bluff.                                                                                                                                                             |
| `cathys-connecting`        | [Cathy's Connecting Principle](https://hanabi.github.io/level-11#cathys-connecting-principle-part-2)                 | `clue`      | After a blind-play, it was a finesse if the played card connects to the clue, otherwise a bluff.                                                                                                                                    |
| `guide-principle`          | [Guide Principle](https://hanabi.github.io/level-11#guide-principle)                                                 | `play`      | A player blind-playing into a finesse or bluff need not worry about the next player's chop; the cluer would have handled it.                                                                                                        |
| `occams-razor`             | [Clue Interpretation & Occam's Razor](https://hanabi.github.io/level-11#clue-interpretation--occams-razor)           | `principle` | When the reacting player can't wait for more information, they pick the interpretation with the fewest blind-plays and prompts.                                                                                                     |
| `pang-of-guilt`            | [The Pang of Guilt](https://hanabi.github.io/level-11#the-pang-of-guilt)                                             | `principle` | Before cluing a card on finesse position directly, consider leaving it for the player in bluff seat.                                                                                                                                |
| `layered-finesse-vs-bluff` | [Mistaking a Layered Finesse for a Bluff](https://hanabi.github.io/level-11#mistaking-a-layered-finesse-for-a-bluff) | `clue`      | From bluff seat a bluff beats a layered finesse; from anyone else it is always a layered finesse.                                                                                                                                   |
| `bluff-prompt`             | [Bluff Prompts](https://hanabi.github.io/level-11#bluff-prompts--prompt-bluffs-illegal)                              | `illegal`   | Prompts must be true; tricking a player into a prompt is forbidden.                                                                                                                                                                 |
| `queued-bluff`             | [Queued Bluffs](https://hanabi.github.io/level-11#queued-bluffs-illegal)                                             | `illegal`   | Never bluff a player who is already finessed.                                                                                                                                                                                       |

## Level 12: Context

Source: [level 12](https://hanabi.github.io/level-12).

| ID                           | Convention                                                                                                   | Kind        | Summary                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `asymmetric-information`     | [Assuming Asymmetric Information](https://hanabi.github.io/level-12#assuming-asymmetric-information)         | `play`      | Players may act on what they deduce from teammates' choices (for example, which 2 they hold because a visible copy wasn't saved). |
| `duplication-responsibility` | [Duplication Responsibility](https://hanabi.github.io/level-12#duplication-responsibility)                   | `principle` | When every possible saver risks duplicating, the player with fewest matching clued cards gives the save.                          |
| `selfish-clue`               | [The Selfish Clue](https://hanabi.github.io/level-12#the-selfish-clue)                                       | `clue`      | Play-cluing the card that connects from your own playable card. Rarely right.                                                     |
| `selfish-finesse`            | [The Selfish Finesse](https://hanabi.github.io/level-12#the-selfish-finesse-a-finesse-through-your-own-hand) | `clue`      | A finesse that connects through the cluer's own hand, used to lock in a finesse before cards move.                                |
| `ego-clue`                   | [The Ego Clue](https://hanabi.github.io/level-12#the-ego-clue-mistake)                                       | `mistake`   | Holding a playable card back to steal a clue and force someone else to discard.                                                   |
| `stale-1s-clue`              | [The Stale 1's Clue](https://hanabi.github.io/level-12#the-stale-1s-clue)                                    | `clue`      | A 1's clue that could have been given long ago carries a context meaning beyond the textbook one.                                 |
| `focus-inversion`            | [Focus Inversion](https://hanabi.github.io/level-12#focus-inversion)                                         | `clue`      | If a play clue touches chop but chop is known unplayable, the focus is the leftmost touched card instead.                         |
| `context`                    | [Context](https://hanabi.github.io/level-12#context)                                                         | `principle` | Conventions are defaults; the meaning of a move depends on the whole game state.                                                  |
| `choosing-between-playables` | [Choosing Between Playable Cards](https://hanabi.github.io/level-12#choosing-between-playable-cards)         | `play`      | With several playable cards, prefer one that leads into a teammate's hand. Order carries no message (until level 25).             |
| `cluing-1s-early`            | [Cluing 1's in the Early Game](https://hanabi.github.io/level-12#cluing-1s-in-the-early-game)                | `principle` | Sometimes color clues on 1's beat a single number 1 clue, to lock in one-away cards.                                              |

## Level 13: Intermediate Bluffs

Source: [level 13](https://hanabi.github.io/level-13).

| ID                     | Convention                                                                                   | Kind   | Summary                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `3-bluff`              | [The 3 Bluff](https://hanabi.github.io/level-13#the-3-bluff)                                 | `clue` | Any useful 3 is also a legal bluff target, clued or unclued, subject to connect/disconnect rules.                             |
| `critical-color-bluff` | [Critical Color Bluff (CCB)](https://hanabi.github.io/level-13#the-critical-color-bluff-ccb) | `clue` | Any unclued critical non-5 is a legal bluff target, with a color clue only.                                                   |
| `hard-bluff`           | [The Hard Bluff](https://hanabi.github.io/level-13#the-hard-bluff)                           | `clue` | When a blind-play could be a bluff or a finesse plus prompt, assume the bluff (Occam's Razor).                                |
| `hard-3-bluff`         | [The Hard 3 Bluff](https://hanabi.github.io/level-13#the-hard-3-bluff)                       | `clue` | A 3 may 3-bluff the 1 of its own suit.                                                                                        |
| `known-bluff`          | [The Known Bluff](https://hanabi.github.io/level-13#the-known-bluff)                         | `play` | If the next player knows they can't hold the connecting card and nothing else explains the clue, they blind-play anyway.      |
| `good-touch-bluff`     | [The Good Touch Bluff](https://hanabi.github.io/level-13#the-good-touch-bluff)               | `clue` | A bluff that would look like a finesse is fine when the connecting card is already clued elsewhere.                           |
| `legal-bluff-targets`  | [Legal Bluff-Targets](https://hanabi.github.io/level-13#legal-bluff-targets)                 | `term` | One-away cards (any clue), two-away 3's (any clue), critical non-5's (color only). See [bluff targets](#legal-bluff-targets). |

## Level 14: Trash Moves

Source: [level 14](https://hanabi.github.io/level-14).

| ID                              | Convention                                                                                                        | Kind      | Summary                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `known-trash-discard-order`     | [Known-Trash Discard Order](https://hanabi.github.io/level-14#known-trash-discard-order)                          | `discard` | With several known-trash cards, discard the leftmost first.                                                                              |
| `trash-order-chop-move`         | [Trash Order Chop Move (TOCM)](https://hanabi.github.io/level-14#the-trash-order-chop-move-tocm)                  | `discard` | Discarding a trash card other than the leftmost chop-moves the next player.                                                              |
| `shout-discard-order-chop-move` | [Shout Discard Order Chop Move](https://hanabi.github.io/level-14#the-shout-discard-order-chop-move)              | `discard` | A shout discard of a non-leftmost trash card skips players, like a trash order chop move.                                                |
| `trash-push`                    | [The Trash Push](https://hanabi.github.io/level-14#the-trash-push)                                                | `clue`    | Cluing a known-trash card on chop tells the player their new chop card is playable.                                                      |
| `trash-push-finesse`            | [Trash Push Prompt & Finesse](https://hanabi.github.io/level-14#the-trash-push-prompt--the-trash-push-finesse)    | `clue`    | A trash push onto a one-away card prompts or finesses the connecting card. Cannot be reversed.                                           |
| `trash-finesse`                 | [The Trash Finesse](https://hanabi.github.io/level-14#the-trash-finesse)                                          | `clue`    | Play-cluing trash the receiver thinks is playable finesses the card it pretends to be; the receiver chop-moves cards right of the trash. |
| `reverse-trash-finesse`         | [The Reverse Trash Finesse](https://hanabi.github.io/level-14#the-reverse-trash-finesse)                          | `clue`    | A trash finesse in reverse; the receiver must discard the clued card immediately.                                                        |
| `forced-gd-chop-move`           | [Forced Gentleman's Discard Chop Move](https://hanabi.github.io/level-14#the-forced-gentlemans-discard-chop-move) | `discard` | A gentleman's discard forced by a possible reverse trash finesse chop-moves in the same way.                                             |
| `trash-bluff`                   | [The Trash Bluff](https://hanabi.github.io/level-14#the-trash-bluff)                                              | `clue`    | A bluff via a trash card; touched cards are trash and cards right of them are chop-moved.                                                |

## Level 15: Double Bluffs

Source: [level 15](https://hanabi.github.io/level-15).

| ID                         | Convention                                                                                                                  | Kind      | Summary                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| `double-bluff`             | [The Double Bluff](https://hanabi.github.io/level-15#the-double-bluff)                                                      | `clue`    | A play clue on a non-trash card that isn't a legal bluff target makes the next two players blind-play. |
| `triple-bluff`             | [The Triple Bluff](https://hanabi.github.io/level-15#the-triple-bluff-illegal)                                              | `illegal` | Bluff-style clues resolve after at most two blind-plays.                                               |
| `hard-double-bluff`        | [The Hard Double Bluff](https://hanabi.github.io/level-15#the-hard-double-bluff)                                            | `clue`    | A double bluff whose blind-plays happen to be in the clued card's suit; nothing is promised.           |
| `pestilent-double-bluff`   | [Pestilent Double Bluff (PDB)](https://hanabi.github.io/level-15#the-pestilent-double-bluff-pdb)                            | `clue`    | A bluff on a legal target that forces a second blind-play to resynchronise the clued card's identity.  |
| `deferring-a-bluff`        | [Deferring a Bluff](https://hanabi.github.io/level-15#deferring-a-bluff)                                                    | `play`    | Deferring a known finesse is fine; deferring a possible bluff is dangerous.                            |
| `deferring-a-double-bluff` | [Deferring a Double Bluff](https://hanabi.github.io/level-15#deferring-a-double-bluff)                                      | `play`    | Never defer when a double bluff is possible.                                                           |
| `bobs-truth-vs-occam`      | [Bob's Truth vs Occam's Razor](https://hanabi.github.io/level-15#interaction-between-bobs-truth-principle-and-occams-razor) | `play`    | Bob assumes a finesse over a double bluff even when the finesse needs more blind-plays.                |

## Level 16: Ejections & Discharges

Source: [level 16](https://hanabi.github.io/level-16).

| ID                        | Convention                                                                                                      | Kind   | Summary                                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ejection`                | [Ejections](https://hanabi.github.io/level-16#ejections)                                                        | `term` | Like a bluff, but the next player blind-plays their second finesse position.                                                                           |
| `discharge`               | [Discharges](https://hanabi.github.io/level-16#discharges)                                                      | `term` | Like a bluff, but the next player blind-plays their third finesse position.                                                                            |
| `5-color-ejection`        | [5 Color Ejection (5CE)](https://hanabi.github.io/level-16#the-5-color-ejection-5ce)                            | `clue` | A color clue to an untouched 5 that would need two or more blind-plays from the next player is an ejection instead.                                    |
| `unknown-trash-discharge` | [Unknown Trash Discharge (UTD)](https://hanabi.github.io/level-16#the-unknown-trash-discharge-1-for-1-form-utd) | `clue` | A play clue on trash that would look like a bluff makes the next player play their third finesse position. In multi-card form only the focus is trash. |
| `unknown-dupe-discharge`  | [Unknown Dupe Discharge (UDD)](https://hanabi.github.io/level-16#the-unknown-dupe-discharge-udd)                | `clue` | The same discharge triggered by a clue that duplicates a card.                                                                                         |

## Level 17: Dupe Tech

Source: [level 17](https://hanabi.github.io/level-17).

| ID                         | Convention                                                                                       | Kind   | Summary                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `duplicitous-value-clue`   | [Duplicitous Value Clue](https://hanabi.github.io/level-17#the-duplicitous-value-clue)           | `clue` | A play clue that duplicates a card but also saves valuable cards; nothing further is promised.                                 |
| `duplicitous-blind-play`   | [Duplicitous Blind-Play](https://hanabi.github.io/level-17#the-duplicitous-blind-play)           | `clue` | The same idea, but the duplicated card is blind-played rather than clued.                                                      |
| `duplicitous-tempo-clue`   | [Duplicitous Tempo Clue](https://hanabi.github.io/level-17#the-duplicitous-tempo-clue)           | `clue` | A duplicitous clue that only fills in a playable card is treated as a tempo clue (and may chop-move).                          |
| `assisted-trash-chop-move` | [Assisted Trash Chop Move](https://hanabi.github.io/level-17#the-assisted-trash-chop-move)       | `clue` | Using a trash bluff or unknown trash discharge to get a trash chop move when the trash can't be clued cleanly.                 |
| `time-travel-chop-move`    | [Time Travel Chop Move](https://hanabi.github.io/level-17#the-time-travel-chop-move-direct-form) | `clue` | A duplicitous clue that achieves nothing else is read as a trash chop move on the duplicated card. Also has a blind-play form. |

## Level 18: Elimination

Source: [level 18](https://hanabi.github.io/level-18).

| ID                             | Convention                                                                                                | Kind   | Summary                                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `elimination`                  | [Elimination & Elimination Notes](https://hanabi.github.io/level-18#elimination--elimination-notes)       | `term` | If the team lets you discard an important card that nobody else holds, you hold the other copy; note it on every unclued card. |
| `double-discard-elimination`   | [Double Discard Elimination](https://hanabi.github.io/level-18#double-discard-elimination)                | `term` | A player in a double discard situation who discards anyway shows they see the other copy.                                      |
| `2-elimination`                | [2 Elimination](https://hanabi.github.io/level-18#2-elimination)                                          | `term` | A 2 left unsaved and discarded means someone holds the other copy.                                                             |
| `elimination-blind-play`       | [Elimination Blind-Play](https://hanabi.github.io/level-18#the-elimination-blind-play)                    | `play` | Once elimination narrows to one card, blind-play it.                                                                           |
| `elimination-play-clue`        | [Elimination Play Clue](https://hanabi.github.io/level-18#the-elimination-play-clue)                      | `clue` | A clue that singles out the elimination card focuses only it; other touched cards aren't promised playable.                    |
| `elimination-chop-focus`       | [Elimination & Chop-Focus](https://hanabi.github.io/level-18#interaction-between-elimination--chop-focus) | `clue` | Elimination cards can be singled out by positive or negative information; chop focus is decided before the clue.               |
| `elimination-riding-deduction` | [Elimination Riding Deduction](https://hanabi.github.io/level-18#the-elimination-riding-deduction)        | `play` | With two elimination candidates and chop left riding, the card isn't on chop; play the newest.                                 |
| `riding-deduction-bluff`       | [Riding Deduction Bluff](https://hanabi.github.io/level-18#the-riding-deduction-bluff)                    | `play` | Deliberately letting a riding deduction play an unrelated playable card first.                                                 |
| `elimination-self-chop-move`   | [Elimination Self-Chop Move](https://hanabi.github.io/level-18#the-elimination-self-chop-move)            | `play` | A card known by elimination is chop-moved by its owner without a clue.                                                         |
| `elimination-finesse`          | [Elimination Finesse](https://hanabi.github.io/level-18#the-elimination-finesse)                          | `play` | When finessed for a card you hold elimination notes for, play the oldest elimination card, not finesse position.               |
| `trash-touch-elimination`      | [Trash Touch Elimination (TTE)](https://hanabi.github.io/level-18#trash-touch-elimination-tte)            | `clue` | When every clue would touch trash, the touched trash is identified by eliminating what the cluer could have avoided.           |

## Level 19: 5 Tech

Source: [level 19](https://hanabi.github.io/level-19).

| ID                           | Convention                                                                                                                                   | Kind   | Summary                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `low-score-phase`            | [Low Score Phase](https://hanabi.github.io/level-19#the-low-score-phase-and-the-normal-score-phase)                                          | `term` | The game is in the Low Score Phase while score is below 2 × number of suits (10 in a 5-suit game).                       |
| `no-5-play-clues-low-score`  | [No number 5 Play Clues in the Low Score Phase](https://hanabi.github.io/level-19#no-play-clues-with-a-number-5-clue-in-the-low-score-phase) | `clue` | In the Low Score Phase a number 5 clue is never a direct play clue.                                                      |
| `early-5s-chop-move`         | [Early 5's Chop Move](https://hanabi.github.io/level-19#the-early-5s-chop-move)                                                              | `clue` | In the Early Game, a 5 clue one away from chop while other clues exist is a 5's chop move.                               |
| `5-pull`                     | [The 5 Pull](https://hanabi.github.io/level-19#the-5-pull)                                                                                   | `clue` | An illegal 5 stall in the Low Score Phase makes the receiver blind-play the card right of the 5.                         |
| `5-pull-finesse`             | [5 Pull Prompt & Finesse](https://hanabi.github.io/level-19#the-5-pull-prompt--the-5-pull-finesse)                                           | `clue` | A 5 pull onto a one-away card prompts or finesses the connecting card (also double and clandestine forms; forward only). |
| `5-pull-promise`             | [5 Pull Promise](https://hanabi.github.io/level-19#the-5-pull-promise-a-play-clue-after-a-5-pull)                                            | `clue` | A later play clue to an unplayable card promises the pulled card connects to it.                                         |
| `5-pulled-finesses-certain`  | [Finesses While 5 Pulled are Certain](https://hanabi.github.io/level-19#finesses-while-5-pulled-are-certain-finesses)                        | `clue` | Any finesse a 5-pulled player gives is treated as a certain finesse.                                                     |
| `5-pull-skip`                | [The 5 Pull Skip](https://hanabi.github.io/level-19#the-5-pull-skip)                                                                         | `clue` | If the card right of the 5 is already gotten, the pull skips to the next card.                                           |
| `5-number-ejection`          | [5 Number Ejection (5NE)](https://hanabi.github.io/level-19#the-5-number-ejection-5ne)                                                       | `clue` | A 5 pull onto a card two or more away from playable ejects the next player's second finesse position.                    |
| `5-number-discharge`         | [5 Number Discharge (5ND)](https://hanabi.github.io/level-19#the-5-number-discharge-5nd)                                                     | `clue` | A 5 pull onto trash discharges the next player's third finesse position.                                                 |
| `5ne-finesse-position-skips` | [5NE Finesse Position Skips](https://hanabi.github.io/level-19#the-5-number-ejection-finesse-position-skips)                                 | `play` | How a chop-moved card left by a 5 number ejection interacts with later finesses.                                         |
| `2-saves-and-5-stalls`       | [2 Saves & 5 Stalls](https://hanabi.github.io/level-19#interaction-between-2-saves--5-stalls)                                                | `clue` | A 5 stall when only a visible-rule-blocked 2 save remains is a stall, and implies elimination on the receiver.           |

## Level 20: Advanced Moves

Source: [level 20](https://hanabi.github.io/level-20).

| ID                            | Convention                                                                                                                                   | Kind   | Summary                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| `occupied-play-clue`          | [Occupied Play Clue & Finesse (OPC)](https://hanabi.github.io/level-20#the-occupied-play-clue--the-occupied-finesse-opc)                     | `clue` | Rules for a player with a playable card who gives a clue instead because only they can give it.                       |
| `out-of-order-play-clue`      | [Out-of-Order Play Clue (OOO)](https://hanabi.github.io/level-20#the-out-of-order-play-clue-triple-o--ooo)                                   | `clue` | Cluing blocked same-suit playables with the wrong focus; the next player fixes it and the original focus still plays. |
| `out-of-order-finesse`        | [The Out-of-Order Finesse](https://hanabi.github.io/level-20#the-out-of-order-finesse)                                                       | `clue` | The same idea for a finesse; after the fix clue, the original focus still plays.                                      |
| `out-of-order-corollary`      | [The Out-of-Order Corollary](https://hanabi.github.io/level-20#the-out-of-order-corollary)                                                   | `clue` | If the next player blind-plays instead of fixing, the touched cards are not the next playable card.                   |
| `suboptimal-moves`            | [Suboptimal Prompt / Finesse / Bluff](https://hanabi.github.io/level-20#the-suboptimal-prompt--the-suboptimal-finesse--the-suboptimal-bluff) | `clue` | Choosing the clearly worse clue type for a critical save turns it into a play clue that prompts, finesses or bluffs.  |
| `no-information-finesse`      | [The No-Information Finesse](https://hanabi.github.io/level-20#the-no-information-finesse)                                                   | `clue` | A re-clue that adds no information may finesse one card but may never bluff just one.                                 |
| `no-information-double-bluff` | [No-Information Double Bluff (NIDB)](https://hanabi.github.io/level-20#the-no-information-double-bluff-nidb)                                 | `clue` | A no-information re-clue can instead be a double bluff.                                                               |

## Level 21: Ignition

Source: [level 21](https://hanabi.github.io/level-21).

| ID                       | Convention                                                                                                      | Kind      | Summary                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ignition`               | [Ignition](https://hanabi.github.io/level-21#ignition)                                                          | `term`    | A blind-play from finesse position that is unrelated to the clue and to the clued card's playability.                   |
| `double-ignition`        | [Double Ignition (DI)](https://hanabi.github.io/level-21#double-ignition-di)                                    | `term`    | Two players blind-play any playable card. The first is Bob unless he already has a known play.                          |
| `replay-double-ignition` | [Replay Double Ignition (RDI)](https://hanabi.github.io/level-21#the-replay-double-ignition-rdi)                | `clue`    | Re-cluing a known playable card outside a stalling situation triggers a double ignition.                                |
| `trash-double-ignition`  | [Trash Double Ignition (TDI)](https://hanabi.github.io/level-21#the-trash-double-ignition-tdi)                  | `clue`    | Cluing known trash when neither a trash chop move nor a trash push is possible triggers a double ignition.              |
| `poke-double-ignition`   | [Poke Double Ignition (PDI)](https://hanabi.github.io/level-21#the-poke-double-ignition-pdi)                    | `clue`    | Re-cluing known trash outside a stalling situation triggers a double ignition.                                          |
| `chop-move-ignition`     | [Chop Move Ignition (CMI)](https://hanabi.github.io/level-21#the-chop-move-ignition-cmi-with-1-card-chop-moved) | `clue`    | Chop-moving a playable chop card instead of play-cluing it ignites the next player (2+ card form has extra conditions). |
| `bomb-double-ignition`   | [Bomb Double Ignition](https://hanabi.github.io/level-21#bomb-double-ignition)                                  | `discard` | Deliberately misplaying known trash before the last rounds triggers a double ignition.                                  |
| `bomb-triple-ignition`   | [Bomb Triple Ignition](https://hanabi.github.io/level-21#bomb-triple-ignition)                                  | `discard` | A bomb ignition when a clue-based ignition was obviously available triggers three blind-plays.                          |

## Level 22: Emergency Discards

Source: [level 22](https://hanabi.github.io/level-22).

| ID                    | Convention                                                                                                                | Kind      | Summary                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| `phantom-playable`    | [Phantom Playable Cards](https://hanabi.github.io/level-22#phantom-playable-cards)                                        | `term`    | A card playable through unclued, non-finesse-position cards in other hands. It can't be play-clued yet.     |
| `scream-for-phantom`  | [Scream Discard for a Phantom Playable](https://hanabi.github.io/level-22#the-scream-discard-for-a-phantom-playable-card) | `discard` | A scream discard is usually also warranted for a phantom playable card on chop.                             |
| `sacrifice-discard`   | [The Sacrifice Discard](https://hanabi.github.io/level-22#the-sacrifice-discard)                                          | `discard` | A locked player discarding a non-critical clued card; it does not imply a sarcastic or gentleman's discard. |
| `echo-scream-discard` | [Echo Scream Discard Chop Move (ESDCM)](https://hanabi.github.io/level-22#the-echo-scream-discard-chop-move-esdcm)        | `discard` | A scream discard when the next player has a known play or safe discard chop-moves the next two players.     |
| `echo-shout-discard`  | [The Echo Shout Discard](https://hanabi.github.io/level-22#the-echo-shout-discard-illegal)                                | `illegal` | Shout discards never echo.                                                                                  |
| `composition-discard` | [The Composition Discard](https://hanabi.github.io/level-22#the-composition-discard)                                      | `discard` | One discard that is a scream discard and a generation discard for different players.                        |
| `rebellious-discard`  | [The Rebellious Discard](https://hanabi.github.io/level-22#the-rebellious-discard)                                        | `discard` | A screamed-at player who would leave the next player at 0 clues chop-moves and discards again instead.      |

## Level 23: Charms & Miscellaneous

Source: [level 23](https://hanabi.github.io/level-23).

| ID                      | Convention                                                                               | Kind      | Summary                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `charm`                 | [Charms](https://hanabi.github.io/level-23#charms)                                       | `term`    | Like a bluff, but the next player blind-plays their fourth finesse position.                                                      |
| `4-charm`               | [The 4 Charm](https://hanabi.github.io/level-23#the-4-charm)                             | `clue`    | A play clue on an untouched unplayable 4 that would need three blind-plays from the next player is a charm.                       |
| `blaze-discard`         | [The Blaze Discard](https://hanabi.github.io/level-23#the-blaze-discard)                 | `discard` | A gentleman's or baton discard whose match isn't on finesse position, outside an emergency, carries an extra message.             |
| `hesitation-blind-play` | [The Hesitation Blind-Play](https://hanabi.github.io/level-23#the-hesitation-blind-play) | `play`    | A player who discards instead of playing a play-clued card is allowing for a connecting card elsewhere; others may blind-play it. |

## Level 24: Unnecessary Moves

Source: [level 24](https://hanabi.github.io/level-24).

| ID                                   | Convention                                                                                                                                   | Kind   | Summary                                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| `unnecessary-moves`                  | [Unnecessary Moves](https://hanabi.github.io/level-24#unnecessary-moves)                                                                     | `term` | A tricky move used where a plain play clue would have got the same card carries an extra message.                         |
| `trash-finesses-unnecessary`         | [Trash Finesses and Bluffs Are Always Unnecessary](https://hanabi.github.io/level-24#trash-finesses-and-trash-bluffs-are-always-unnecessary) | `term` | Trash finesses and trash bluffs are always treated as unnecessary.                                                        |
| `unnecessary-known-trash`            | [With Known Trash → Ignition](https://hanabi.github.io/level-24#unnecessary-moves-with-known-trash----ignition)                              | `clue` | An unnecessary move with known trash as the target also ignites (usually Bob). An unnecessary trash chop move is illegal. |
| `unnecessary-unknown-trash-off-chop` | [With Unknown Trash Off Chop → Chop Move](https://hanabi.github.io/level-24#unnecessary-moves-with-unknown-trash-off-chop----chop-move)      | `clue` | An unnecessary move on unknown trash off chop also acts as a trash chop move.                                             |
| `unnecessary-unknown-trash-on-chop`  | [With Unknown Trash On Chop → Trash Push](https://hanabi.github.io/level-24#unnecessary-moves-with-unknown-trash-on-chop----trash-push)      | `clue` | An unnecessary move on unknown trash on chop also acts as a trash push.                                                   |

## Level 25: Priority

Source: [level 25](https://hanabi.github.io/level-25).

| ID                         | Convention                                                                                                               | Kind   | Summary                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| `priority-finesse`         | [Priority Prompt & Finesse](https://hanabi.github.io/level-25#the-priority-prompt--the-priority-finesse)                 | `play` | With two fully known playable cards, playing the lower-priority one promises the card that connects to it.                |
| `priority-bluff`           | [The Priority Bluff](https://hanabi.github.io/level-25#the-priority-bluff)                                               | `play` | A priority play can also bluff the next player.                                                                           |
| `layered-priority-finesse` | [Layered Priority Finesse](https://hanabi.github.io/level-25#the-layered-priority-finesse)                               | `play` | A priority finesse can be layered if the blind-player is not the next player.                                             |
| `load-clue`                | [The Load Clue](https://hanabi.github.io/level-25#the-load-clue)                                                         | `clue` | Rules for playing into cards visible off finesse position, which priority would otherwise forbid.                         |
| `paused-priority-finesse`  | [Paused Priority Finesse](https://hanabi.github.io/level-25#the-paused-priority-finesse)                                 | `play` | A player partway through a layered finesse may pause it to give a priority finesse.                                       |
| `trust-finesse`            | [The Trust Finesse](https://hanabi.github.io/level-25#the-trust-finesse-a-priority-finesse-from-playing-an-unknown-card) | `play` | Playing an unknown card over a known one can still finesse if the alternative was extremely suboptimal.                   |
| `priority-order`           | [Priority Flowchart](https://hanabi.github.io/level-25#a-priority-flowchart-for-choosing-between-2-playable-cards)       | `play` | The fixed order for choosing between playable cards: blind-plays first, then cards leading into others' hands, and so on. |
| `priority-exceptions`      | [Where Priority Does Not Apply](https://hanabi.github.io/level-25#situations-where-priority-does-not-apply)              | `play` | Priority is off in the End-Game, for the 4's exception, for globally known blind-plays and for "important" cards.         |
| `playing-into-hands`       | [Playing Into Someone Else's Hand](https://hanabi.github.io/level-25#playing-into-someone-elses-hand)                    | `play` | Only the very next card counts when deciding whether a play leads into a teammate's hand.                                 |

## Reference tables

### Stall table

From [level 9](https://hanabi.github.io/level-9#allowable-stall-clues-stall-table). In a stalling situation a
player gives the highest-precedence clue available. Severity 0 is a normal situation (no stalling).

| Precedence | Clue                                               | 0 Normal | 1 Early Game | 2 Double Discard / Scream | 3 Locked Hand | 4 At 8 Clues | End-Game    |
| ---------- | -------------------------------------------------- | -------- | ------------ | ------------------------- | ------------- | ------------ | ----------- |
| 1          | Normal play or save clue                           | yes      | yes          | yes                       | yes           | yes          | yes         |
| 2          | 5 Stall                                            | no       | yes          | yes                       | yes           | yes          | use context |
| 3          | Tempo Clue Stall                                   | no       | no           | yes                       | yes           | yes          | use context |
| 4 (tied)   | Fill-In Clue                                       | no       | no           | yes                       | yes           | yes          | use context |
| 4 (tied)   | Locked Hand Save                                   | no       | no           | no                        | yes           | no           | use context |
| 4 (tied)   | 8 Clue Save                                        | no       | no           | no                        | no            | yes          | use context |
| 5          | Hard Burn (re-clue that adds nothing, usually a 5) | no       | no           | yes                       | yes           | yes          | use context |

### Legal bluff targets

From [level 13](https://hanabi.github.io/level-13#legal-bluff-targets). Before level 13 only the first row applies.

| Card                         | Color clue | Number clue | Convention           | Level |
| ---------------------------- | ---------- | ----------- | -------------------- | ----- |
| Any one-away-from-playable   | yes        | yes         | Bluff                | 11    |
| Any two-away-from-playable 3 | yes        | yes         | 3 Bluff              | 13    |
| Any critical non-5           | yes        | no          | Critical Color Bluff | 13    |

## Overrides: later levels changing earlier meanings

These are the places where turning a level on changes how a move from a lower level is read. The engine
needs these to interpret clues correctly at a given level.

| From level | Changes                                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 4          | A 5 clue one away from chop is a 5's chop move, not a play clue. Clued trash off chop is a trash chop move. Out-of-order 1 plays chop-move.     |
| 5          | A finesse may be layered or queued, so a blind-player keeps playing until the promised card appears.                                            |
| 6          | A tempo clue outside a stalling situation also chop-moves.                                                                                      |
| 7          | Discarding while holding a known play is a scream (or shout, or generation) discard.                                                            |
| 8          | Chop moves are off in the End-Game.                                                                                                             |
| 9          | Stall clues are graded by severity (the stall table); some 5 stalls become illegal and so mean something else.                                  |
| 10         | Discarding a known card (playable or not) is a gentleman's or baton discard and promises the copy on someone's finesse position.                |
| 11         | A clue from bluff seat that makes the next player blind-play an unrelated card is a bluff, and a bluff beats a layered finesse from bluff seat. |
| 12         | Focus inversion: a play clue touching a chop known to be unplayable focuses the leftmost card.                                                  |
| 13         | Useful 3's and critical non-5's (by color) become legal bluff targets.                                                                          |
| 14         | Clued trash on chop is a trash push; misrepresented trash is a trash finesse or bluff; discarding a non-leftmost trash card chop-moves.         |
| 15         | A play clue on a non-bluff-target can mean two blind-plays.                                                                                     |
| 16         | A color clue on an untouched 5 may be an ejection rather than a finesse; some trash or dupe clues discharge.                                    |
| 18         | Letting an important card be discarded implies its owner holds the other copy (elimination).                                                    |
| 19         | In the Low Score Phase, a number 5 clue is never a play clue; illegal 5 stalls become 5 pulls, ejections or discharges.                         |
| 21         | "Useless" clues outside stalling situations (re-clued playables or trash) trigger double ignitions.                                             |
| 22         | A scream discard when the next player is busy echoes to the player after.                                                                       |
| 23         | A play clue on an untouched 4 needing three blind-plays is a 4 charm.                                                                           |
| 24         | A tricky move used where a plain clue would do carries an extra ignition, chop move or trash push.                                              |
| 25         | The order of playing known playable cards becomes meaningful (priority).                                                                        |

## Variants and levels

This project plays the base game only for now. For reference, H-Group's rough mapping of variants to the
level at which players start using them is: No Variant at 1, 3/4/6 suits at 2, Rainbow and White at 4,
Black at 5, Pink, Brown and Omni at 16, and Null at max level. A few level entries only matter in variants
(for example `multi-color-prompts`).

## Extras

The [extras page](https://hanabi.github.io/extras) holds rarely-used conventions that are not part of any
level, such as special bluffs. They are out of scope until the engine supports max-level play.
