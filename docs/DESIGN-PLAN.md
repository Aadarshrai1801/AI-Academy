# Design plan — a learning-first UI (Pass 1, for review)

> Status: **proposed, awaiting review**. No code has been changed.
> Scope of Pass 2: `/practice`, `/progress` (+ placement diagnostic),
> `/leaderboard`, `/watch/[jobId]`, `/groups` list + `/groups/[id]`.
> The marketing landing page is acknowledged but out of scope for this pass.

---

## 0. Who this is for and what the UI has to do

**The learner:** someone studying AI/ML in short daily sessions — a student or
early-career developer, often on a phone between other tasks. They are not
"users of a SaaS dashboard"; they are people building a habit around
material that is hard and where being wrong is the normal state.

Three jobs, in priority order:

1. **Answer one question without friction, dozens of times a day.**
   (Low noise beats delight. The question is the interface.)
2. **See that they are moving, over weeks.** (Progress must read as a
   trajectory, not a snapshot. This is the emotional payoff.)
3. **Get things wrong safely.** (A miss is information, not a penalty.
   The tutor and explanation should feel like help arriving.)

Every token, layout, and motion decision below is justified against one of
these three jobs. Anything that couldn't be was cut.

**Design principles (in decision order):**

- **Answer first, chrome last.** Any pixel not serving the current question
  or the current progress signal is noise.
- **Action is ink; progress is color.** Buttons and links are neutral ink.
  Color is reserved for outcomes (correct / mastery / needs review), so it
  never becomes decoration.
- **Mistakes get language, not alarm.** Wrong answers use a calm amber
  "needs review" family and wording like "Not quite yet — here's the idea."
- **One bold element per screen.** Each screen gets at most one loud visual
  moment, sized to its job. If everything is bold, momentum reads as noise.

---

## 1. Color — 6 named values, one reserved accent

### Light theme (default)

| Token | Hex | Used for | Why this product needs it |
|---|---|---|---|
| `paper` | `#F7F8FA` | App canvas, page background | Cool paper keeps code/math text crisp; warm cream would fight the subject and reads as a template default. |
| `ink` | `#16181D` | Body text, primary buttons, focus rings | Near-black reads as "the serious tool," and keeping **action** in ink leaves color free to mean **outcome**. |
| `slate` | `#5B6472` | Secondary text, metadata, borders text | A cool mid-grey keeps dense metadata readable without competing with the question. |
| `line` | `#E2E5EA` | Hairlines, dividers, card borders | Hairlines separate dense regions (question vs HUD) at lower visual cost than shadows. |
| `growth` | `#0E7C5A` | **Reserved accent**: correct answers, mastery fill, streak-continued | Deep green reads as "growing capability" (not a generic success-green); the single reserved hue keeps every appearance meaningful. |
| `review` | `#A16207` | Incorrect answers, needs-review topics, decay | Amber is a calm "worth another look" — informative, not a red alert; learning tools must not color-shame a miss. |

Support tints are derived, not new hues:

- `growth-soft` `#E7F2ED`, `growth-ink` `#0E7C5A` (text on soft)
- `review-soft` `#FBF3E1`, `review-ink` `#7C4A03`
- Surfaces step by lightness only: `paper` → `#FFFFFF` (raised work surfaces) → `#EFF1F4` (inputs/tracks).

### Dark theme (theme toggle stays)

| Token | Hex | Note |
|---|---|---|
| `paper` | `#101216` | Blue-black, not pure black — keeps hairlines visible. |
| `ink` (text) | `#ECEFF3` | Off-white to avoid halation on dark. |
| `slate` | `#98A2B3` | Secondary text. |
| `line` | `rgba(255,255,255,0.12)` | Hairlines. |
| `growth` | `#5EE6A8` | Raised lightness so it passes non-text contrast on dark. |
| `review` | `#F2C879` | Same. |

### Rules

1. **`growth` may only appear** on these five things, each a genuine outcome:
   correct-answer feedback, mastery/progress fill, streak-continued state, the
   placement result, and the leaderboard's daily movement delta (a small ▲ —
   it's genuinely an outcome: you did better today). If it appears on a
   decorative gradient, an icon, a rank number or username, a podium/group
   card, or a primary button, that's a bug. The leaderboard allowance is
   scoped to the movement delta only — never its rank numbers or names.
2. **`review` may only appear** on: incorrect feedback, "focus areas" on
   /progress, and decay indicators. Never as an alarm (no red, no shake).
3. **Never color-only.** Correct/incorrect always pair the hue with an icon
   and a word ("Correct" / "Not quite yet"), so colorblind users get the same
   signal.
4. Contrast targets: body text ≥ 4.5:1, large text ≥ 3:1, borders/indicators
   ≥ 3:1, verified for every pair above in both themes during implementation.

---

## 2. Type — two faces, each with one job

**Faces:** Geist Sans (prose/UI) + Geist Mono (code, math, numeric data).
Kept because they're already loaded and Geist Mono has real tabular figures —
switching faces would add cost without adding learning value.

**The functional split (this is the rule that matters):**

- **Sans** = everything the learner reads as language: prompts, explanations,
  buttons, headings.
- **Mono = only two jobs:** (a) code/math inside question content, (b)
  numeric comparison data (scores, ranks, timers, mastery %, streaks).
  Mono is never used for labels.

**Scale** (following Bringhurst-style spacing/weight logic: size carries
hierarchy, weight stays conservative):

| Role | Size/Leading | Weight | Use |
|---|---|---|---|
| Display | 28/34 | 600 | Page titles (`Progress`, `Leaderboard`) |
| Title | 20/26 | 600 | Section titles, question prompt |
| Body | 15/24 | 400 | Explanations, paragraphs |
| Small | 13/20 | 400/500 | Metadata, captions |
| Micro | 11/16 | 500 | Numeric chips, keyboard hints (never uppercase eyebrows) |
| Mono body | 14/24 | 400 | Code/math inside questions |
| Mono data | 13/18 | 500–600 | Tabular figures for points/ranks/timers |

Removed: the ALL-CAPS tracked-out mono eyebrow (`// LEARNING PATH`,
`GLOBAL RANKINGS // DAILY RANKINGS`, etc.). It's decoration that costs a line
of vertical space on every screen and adds no information.

---

## 3. Surfaces — hierarchy by what the element *is*

Today every card is the same: `rounded-card border-line bg-surface-2 shadow-card`.
Pass 2 replaces that with four named roles:

| Surface | Shape | Depth | Used for | Why |
|---|---|---|---|---|
| **Work surface** (question) | 10px radius, hairline `line`, white | none | The practice question block | It's the task itself; a flat sheet says "work here," a floating card says "content to browse." |
| **Content card** (dashboard panels) | 14px radius, hairline, `paper`/white | none | Progress, analytics, leaderboard tables | Grouping without pretending every panel is interactive. |
| **Media surface** (video) | 16px radius, `#0E0F13` frame | deep | Player frame, playlist | Video is the one true "object" in the app; a dark frame focuses the eye like a screen. |
| **Chat bubble** | 12px radius; sender-side corner tightened to 4px | none | Group/DM messages | The asymmetric corner encodes direction (who spoke) instead of color alone. |

**Shadows exist only on transient layers** (popovers, the pinned leaderboard
row, a drawer) where elevation communicates "this floats above the page."
Cards no longer lift on hover; hover is a hairline darkening, because 90% of
cards aren't clickable.

---

## 4. Layout — core screens (ASCII wireframes)

### 4.1 `/practice` — answer one question, repeat

```
┌──────────────────────────────────────────────────────────────────┐
│ Practice        [topic ▾] [all levels ▾]      ● 4-day  8/10 left │  ← 48px HUD, one row
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Question 7                                    easy · mcq       │
│                                                                  │
│   Why does dropout help a network generalize?                    │
│                                                                  │
│   ┌────────────────────────────────────────────────────────────┐ │
│   │ A   It adds noise so units can't co-adapt            ○     │ │  ← answer rows
│   ├────────────────────────────────────────────────────────────┤ │
│   │ B   It permanently zeroes weights                    ○     │ │
│   └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│   [ Submit answer ]                              ⏱ 00:42        │
└──────────────────────────────────────────────────────────────────┘
```

Answer state **replaces** the rows in place (no layout shift, question stays
put):

```
│   ✓ Correct · +15 pts · 42s                                      │  ← growth hairline, left
│     Dropout forces redundancy, so no unit can rely on another…   │
│                                                                  │
│   [ Next question ]     [ Ask why ]                              │
└──────────────────────────────────────────────────────────────────┘
```

Wrong answers use the same slot with `review` and helping language:

```
│   ⚑ Not quite yet — here's the idea                              │  ← review, flag not ✕
│     Your answer: "to train faster"                               │
│     Expected:    "a more robust estimate"                        │
│     …explanation…                                                │
│   [ Next question ]     [ Walk me through it ]                   │
```

- **Alignment:** question and answers left-aligned inside a **max-width 680px
  centered column**. Left alignment is faster to scan for dense technical
  text; the centered column keeps line length readable and the eye in one
  place across questions.
- **Why minimal chrome:** this screen is seen 10–50× a day; the HUD is one
  48px row and nothing else is persistent.

### 4.2 `/progress` — the momentum screen (one bold element lives here)

```
┌──────────────────────────────────────────────────────────────────┐
│ Progress                                     Placement ✓ done     │
│ Overall 54  ↑ 6 this week                     [Review focus areas]│
├──────────────────────────────────────────────────────────────────┤
│  THE PATH                                      ← the one bold zone│
│                                                                   │
│  Machine Learning Basics   ██████████████░░  72  ╭        ╮      │
│  Probability & Statistics  ███████████░░░░░  58  │  ↗     │      │
│  Neural Networks           ███████░░░░░░░░░  41  │        │      │
│  Model Evaluation          ██░░░░░░░░░░░░░░  18  ╰ needs  ╯      │
│  Deep Learning             ░░░░░░░░░░░░░░░░  —   locked          │
│                                                                   │
│  [ Continue where you left off → ]                                │
└──────────────────────────────────────────────────────────────────┘
```

- **The bold element:** a full-width, left-aligned "path" list where each
  topic is a horizontal mastery bar with (a) a faint "where you were last
  week" ghost segment behind the fill and (b) a 7-day sparkline. Trajectory
  is visible **in the bar itself** — no separate chart needed.
- **Focus areas, not failures:** topics below 40 use the `review` family and
  the words "worth a review," never a red score. Locked topics are slate +
  "locked — finish X first," which is a path statement, not a judgment.
- **Sequential numbering allowed here only** because the path genuinely has
  an order; it's rendered as indentation + lock icons, not `01/02/03` chrome.
- **Alignment:** left-aligned rows with right-aligned tabular numbers, so
  values compare vertically.

### 4.3 `/leaderboard` — a different job, a different shape

```
┌──────────────────────────────────────────────────────────────────┐
│ Leaderboard · Sat 19 Sep · resets in 5h 12m                      │
│ ───────────────────────────────────────────────────────────────  │
│                    #1  Mira          512 pts                     │  ← podium: data, not decoration
│           #2  Dev              #3  Ana         488   470         │
├──────────────────────────────────────────────────────────────────┤
│ Rank   Engineer                  Points     Δ today              │
│ #4     Kofi                       412        ↑2                  │
│ #5     Yuki                       388        ↓1                  │
│ …                                                                 │
├──────────────────────────────────────────────────────────────────┤
│ ▸ #1,204  YOU · Jordan             86 pts   ↑11   [Practice →]   │  ← pinned, always visible
└──────────────────────────────────────────────────────────────────┘
```

- **Pinned self row** docked at the bottom of the board (or directly below
  the fold on desktop), showing rank, points, and today's movement. Rank
  #4,000 never has to scroll to find themselves.
- **Visually differentiated from /progress:** this is a *table with a podium*,
  not a card grid. No mastery bars, no sparklines, no growth color except the
  daily movement delta — that ▲ is listed as an explicit `growth` exception
  in §1 Rule 1 (your own outcome: you did better today). The two screens must
  not share the same card pattern or users will confuse "vs others" with "my
  own growth."
- **Numbering justified:** ranks are real ordinal data (unlike `/progress`
  where numbering is structural).
- **Alignment:** numbers right-aligned and tabular; names left-aligned.

### 4.4 `/watch/[jobId]` — sequence and handoff

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Neural Networks playlist · video 2 of 3                        │  ← sequence is real info
├──────────────────────────────────┬───────────────────────────────┤
│ ┌──────────────────────────────┐ │  1 ✓  Why gradients vanish    │  ← numbered = ordered steps
│ │         video 16:9           │ │  2 ▸  Vanishing gradients     │
│ │                              │ │  3    Skip connections        │
│ └──────────────────────────────┘ │                               │
│  ✓ watched   [ Next video → ]    │  (steps clickable, 44px rows) │
├──────────────────────────────────┴───────────────────────────────┤
│ Check yourself — 2 quick questions from this topic               │
│  Q1  What keeps gradients alive in a deep stack?   [Answer →]    │
│  Q2  …                                             [Answer →]    │
└──────────────────────────────────────────────────────────────────┘
```

- **Numbered/stepped treatment is justified here specifically** because the
  playlist is genuinely ordered (this is one of the allowed places).
- **Watching → doing is one surface:** the check section sits in the same
  container as the player (hairline separator, no new page), so finishing a
  video flows into practice without an app-switch feeling.
- On mobile the step rail collapses to a horizontal stepper under the player.

### 4.5 `/groups` list + `/groups/[id]` — mode at a glance

```
Groups                                        [ New group ]
┌───────────────────────────────────────────────────────────────┐
│ ⚑ THE BACKPROP CLUB                       competitive · 12     │  ← amber=competitive? no:
│   Daily rankings · you're #4 today                            │     see rule below
├───────────────────────────────────────────────────────────────┤
│ 📖 QUIET STUDY HOURS                             study · 7     │
│   Rankings off · missed-question feed                         │
└───────────────────────────────────────────────────────────────┘
```

- **Mode must be readable from the list**: a small glyph + one line of what
  it means ("Daily rankings" vs "Rankings off, discuss misses"). Competitive
  gets a trophy glyph in ink; study gets a book glyph in slate. **Neither
  mode gets the growth or review colors** — mode isn't an outcome; using
  status hues here would dilute their meaning.
- Inside a study group, the board drawer is replaced by the discussion feed
  lead ("recent misses") with the existing chat below it — same transport,
  clearly labelled. Competitive keeps the existing table, with the pinned
  self row concept from /leaderboard for consistency of *function*, not of
  decoration.

### 4.6 Placement diagnostic (inside /progress) — calibrate, don't gate

```
┌──────────────────────────────────────────────────────────────────┐
│  Placement · 2 of 8                        [progress ●●●○○○○○]    │
│                                                                   │
│  We use these 8 questions to start you at the right level.        │
│  Wrong answers are useful — they show us where to begin.          │
│                                                                   │
│  Why does dropout help a network generalize?                      │
│  …answers…                                                        │
└──────────────────────────────────────────────────────────────────┘
```

- Framing copy on every step ("helps us start you at the right level"),
  visible progress through the quiz, **no score shown during the quiz**, and
  the result screen leads with "Here's where you're starting," not a grade.
- Skippable: "Start from the beginning instead" is a secondary action. The
  gate is pedagogical, never punitive.

---

## 5. Motion — one deliberate moment per interaction, nothing else

| Trigger | Motion (≤250ms unless noted) | Why |
|---|---|---|
| Answer submitted **correct** | The answer row's left edge wipes with `growth` and the points count up once. | Confirms "that landed" at a glance; occurs dozens of times a day so it must stay small. |
| Answer submitted **incorrect** | The explanation panel slides down 8px into the vacated answer slot, `review` hairline appears. **No shake, no red flash.** | Help arriving, not a penalty; the slide directs the eye to the explanation. |
| First qualifying attempt of the day (streak continues) | Streak chip pulses once and the count increments. | Rewards the daily habit at the exact moment it's earned. |
| Streak **breaks** | No motion at all; copy switches to "Start a new run today." | Punishing motion would work against the third job (safe mistakes). |
| Mastery value changes on /progress | Each bar animates from its ghost (previous) value to the new value **once on mount**, not on scroll. | Motion answers "what changed since I was last here?" — a real question. |
| Last video → check questions | The check section reveals with the same slide as the explanation panel. | Makes watching→doing one continuous moment. |
| Placement question advances | The progress dots fill; question crossfades 120ms. | Communicates calibration progress, not exam pace. |

**Banned:** blanket fade-in-on-scroll, hover-lift on every card, breathing/glow
loops on CTAs, and any animation that plays without a user action. `prefers-reduced-motion`
keeps every state change and drops the transitions (already wired globally).

---

## 6. AI-generated-UI tells: audit of the current app and the fix

| Tell | Present today? | Resolution in Pass 2 |
|---|---|---|
| Warm cream + terracotta / near-black + neon "premium" default | No cream, but the system is the generic **off-white + indigo SaaS** default (globals.css says "MODERN SAAS") | Replace the *rationale*: ink for action, `growth` reserved for outcomes, `review` for mistakes. Surfaces stay cool-paper (kept, now with a reason). |
| Same radius + soft shadow on every card | **Yes** — `Card`, `CardSpotlight`, video, chat all share `rounded-card` + `shadow-card` | Four surface roles (§3); shadows only on transient layers. |
| ALL-CAPS tracked-out eyebrows above every section | **Yes** — `// LEARNING PATH`, `GLOBAL RANKINGS // DAILY RANKINGS`, `GROUP DAILY RANKINGS //`, etc., mostly decorative mono | Removed from app screens; section titles are plain sentence case. |
| Numbered 01/02/03 markers without sequence | Mostly not, but the pattern is available via rank/podium styling | Numbers only where the data is ordinal: leaderboard ranks, playlist steps, path order. |
| `→` on every button/link | Partially (`Continue where you left off →`, CTA arrows) | Arrow only where the action moves you forward in a sequence: next question, next video. |
| Decorative gradients/washes | **Yes** — mesh drift, spotlight sweeps, glows on hover; indigo glows in shadows | Removed from the six app screens; landing page gets a separate pass. |
| Indigo reused for brand, links, badges, glows, focus | **Yes** | Accent reserved for outcomes; focus ring becomes ink; links become ink-underlined. |

---

## 7. Pass 2 build order (one commit per screen, each reviewable alone)

| # | Commit | Contents | "Why this looks this way" note lives in |
|---|---|---|---|
| A | `design: tokens v2 + surface roles` | Token remap + surface role classes; no layout changes; old token aliases kept so nothing breaks | `globals.css` header comment |
| B | `practice: quiet chrome, in-place feedback` | HUD compression, work surface, answer/feedback states, copy pass | top of `practice/page.tsx` |
| C | `progress: the path + placement calibration` | Mastery path with ghost/trend, focus-area language, diagnostic reframe | top of `progress/page.tsx` + `mastery-panel.tsx` |
| D | `leaderboard: pinned self + table form` | Podium/table restructure, pinned row, delta column | top of `leaderboard/page.tsx` |
| E | `watch: playlist stepper + check handoff` | Media surface, numbered steps, continuous check section | top of `watch/[jobId]/page.tsx` |
| F | `groups: mode at a glance` | List-level mode language/glyphs, in-room header + feed treatment | top of `groups/page.tsx` + `groups/[id]/page.tsx` |
| G | `copy + a11y sweep` | Button/error/empty-state audit, contrast verification, focus pass | summary in the PR description |

Each commit: existing tests stay green (API untouched), web typecheck + lint +
build pass, and a responsive check at 375 / 768 / 1280 widths.

---

## 8. Quality floor checklist (applied in every commit)

- [ ] Responsive 375→1280, touch targets ≥ 44px, no horizontal scroll
- [ ] Visible focus ring on every interactive element (ink, 2px, offset)
- [ ] `prefers-reduced-motion` honored (state changes remain, transitions drop)
- [ ] Correct/incorrect never communicated by color alone (icon + word + hue)
- [ ] Copy audit: buttons say the outcome ("Save changes", "Next question"),
      errors say what failed and what to do, empty states invite action
- [ ] Contrast pairs verified (body ≥ 4.5:1, UI ≥ 3:1) in light and dark

---

## 9. Open questions for review

1. **Accent direction:** replace indigo-as-accent with the reserved
   `growth` (#0E7C5A) + ink-primary-action system, or keep indigo as the
   reserved accent? (Recommend the former — indigo is the SaaS default the
   brief asks to move away from; ink buttons are the bigger visual shift and
   I want your explicit sign-off.)
2. **Streak-break behavior:** no motion + neutral copy ("Start a new run
   today") — confirm that's the tone you want rather than a subtle nudge.
3. **Placement quiz skippability:** allow "start from the beginning instead"
   (recommended) or make the 8-question calibration required once?
4. **Commit granularity:** seven commits as tabled, or squash tokens +
   practice together if you'd rather review fewer diffs.

Approve (or amend) and I'll start at commit A.
