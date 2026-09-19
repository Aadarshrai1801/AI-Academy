# Design notes — why each screen looks the way it does

Companion to [`DESIGN-PLAN.md`](DESIGN-PLAN.md) (Pass 1) and the Pass 2
commits. One paragraph per screen, tied to that screen's actual job in the
learning flow. The same notes live as header comments in each file so they
travel with the code.

## Tokens (commit A — `globals.css`, `ui/card.tsx`, `ui/button-styles.ts`)

**Why this looks this way:** the product's core loop is "try → be wrong
safely → see progress," so color was reorganized around that: actions are ink
(near-black), which leaves exactly one accent (`growth #0E7C5A`) meaning
correct/mastery/streak, and one calm amber (`review #A16207`) meaning
needs-review. A miss can therefore never look like an alarm, and a success
can never be mistaken for decoration. Cards became flat surfaces with roles
(work / content / media) because a question, a dashboard panel, and a video
frame are different kinds of objects and shouldn't share one shell.

## Practice (`/practice`, commit B)

**Why this looks this way:** this screen is used 10–50 times a day, so the
question is the only element at Title weight and the HUD is a single row.
Feedback replaces the answer slot in place — the question never moves, and the
explanation arrives exactly where the answer was. Wrong answers use the review
family with a LifeBuoy and the words "Not quite yet — here's the idea" plus
your-answer/expected side by side; there is no shake, no modal, and no red.
Correct answers get exactly one motion moment (a growth left edge and a
points count-up) because it happens dozens of times and must stay small.
Mono is reserved for code answers; prose is prose.

## Progress (`/progress`, commit C)

**Why this looks this way:** this is the emotional payoff screen, so it holds
the app's one bold element: a full-width mastery path where each topic shows a
bar, a ghost marker where the stored window started, a 7-day sparkline, and a
signed week change — trajectory, not a snapshot. Low scores are labeled
"Focus area" in calm amber with "short low-stakes sets work best here," never
a red list of failures. The placement quiz is framed as calibration ("we use
these to start you at the right level; wrong answers just show us where to
begin"), is skippable, and its result screen says "Here's where you're
starting," not a grade.

## Leaderboard (`/leaderboard`, commit D)

**Why this looks this way:** this screen answers "how do I compare today?" —
a different question from "am I growing?" — so it deliberately does not reuse
the progress card language. It is a table with ordinal ranks and a flat
podium; ranks are real data, so numbering is honest here. The learner's own
row pins to the viewport bottom, because hunting for yourself at rank #4,000
is the moment the feature stops motivating. The reserved outcome colors stay
out of the podium — other people's ranks aren't your progress — so champion
emphasis is ink and border weight instead.

## Watch (`/watch/[jobId]`, commit E)

**Why this looks this way:** video is the one real "object" in the app, so it
gets the media surface (dark frame, its own radius) rather than the card
shell. The playlist is genuinely ordered, so numbered steps are justified and
carry "video 2 of 3" plus a "Next video" affordance. The end-of-playlist check
sits on the same page in the growth family with "Answer this" links, so
finishing a video flows into doing without an app-switch feeling.

## Groups (`/groups` + `/groups/[id]`, commit F)

**Why this looks this way:** competitive and study groups do different jobs
(ranking vs. mutual help), so the mode is readable from the list itself: a
trophy with "Competitive — daily rankings" or a book with "Study — rankings
off, missed questions shared." Neither mode borrows the reserved outcome
colors because mode is a choice, not an outcome. Inside a study room, a
member's missed question appears as a calm amber "Missed question — worth
discussing" card in the existing chat; chat bubbles encode direction in shape
(the sender-side corner tightens) so color is never the only cue.

## Cross-cutting quality floor (commit G)

- **Responsive 375→1280:** single-column practice and progress; the
  leaderboard table uses a fixed 3.5rem rank column + fluid learner column;
  playlists wrap; touch targets ≥ 44px on primary actions.
- **Focus:** one ink focus ring (`:focus-visible`, 2px offset) on every
  interactive element; option cards and chat affordances inherit it.
- **Reduced motion:** all new motion is framer-driven behind
  `useReducedMotion`, and the global media query neutralizes the rest.
- **Never color-only:** correct/incorrect, trend direction, chat direction and
  group mode all pair hue with an icon and/or a word; sparklines carry an
  `aria-label`.
- **Copy audit:** buttons state outcomes ("Next question", "Try again",
  "Answer this", "Create group", "Open"), errors say what happened and what
  to do next, and empty states invite action ("Answer a question and you'll
  be today's first name on it").

## Contrast pairs (verified at token definition)

| Pair | Light | Dark |
|---|---|---|
| Body text (`fg` on `surface-0`) | ~16.5:1 | ~13:1 |
| Muted text (`fg-muted`) | ~5.7:1 | ~7:1 |
| Growth ink on paper | ~4.9:1 | ~11:1 |
| Review ink on paper | ~5.1:1 | ~10:1 |

All exceed WCAG AA for their size; non-text indicators (bars, borders) exceed
3:1.
