# Workout view — Jay's layout / cards / list / compact / focus

The active workout screen (`frontend/src/views/Workout.jsx`) has five layouts, chosen by
`S.workoutView` (`'custom' | 'cards' | 'list' | 'compact' | 'focus'`, default `'custom'`). All five use the
same active session and completion pipeline.

| Value | What you see |
|---|---|
| `custom` | **Jay's layout**: every exercise stacked, with no current exercise, selection marker, or Set current control. Completed exercises always fold away; there is no collapse toggle. Shares List's rows, media behavior and per-exercise actions; no layout builder. |
| `cards` | One unit at a time, `Prev` / `Next` + swipe. The original flow. |
| `list` | Every unit stacked and scrollable. Each non-current unit has a **Set current** chip in its header; completion still auto-advances the current marker, starts rest and can open the top-weight sheet. Blocks render with the `compact` `ExerciseBlock` prop (smaller). |
| `compact` | `list`, with each `ExerciseBlock` also rendered `dense`: no media, no tag chips (Cardio / per-side / target / equipment / **Best:**), no note lines, no "Last time …" recap, no bar-and-plates chip, no progression-guidance line, no "Make superset with previous/next". Just the name, the ⋯ menu and the set rows. |
| `focus` | One set at a time with large load/reps controls, nullable RPE, Complete/Skip actions, and a set pager. Supersets show one member at a time in round order. Existing Prev/Next and horizontal swipe still move between exercise units. |

Focus keeps its visible-set pointer in component state only. It starts at the first incomplete
set, falls back to the final set when the exercise is complete, and is not persisted. Completing
a set still routes through `ActiveWorkout.toggle`, so sound, haptics, rest, timed work,
high-water protection, and superset progression remain shared with every other layout.

Everything `compact` hides is still on the ⋯ menu (note, details, history, bar weight,
progression settings) or is display-only.

Absent preferences read as `custom`; every explicitly saved existing layout is preserved.
Unknown nonempty values retain the legacy `cards` fallback. `lib/workout-layout.js` centralizes
this resolution for Settings, the active session, custom media and session creation.

Jay's layout keeps the persisted `custom` value, so existing selections and backups still work.
It ignores saved/session `collapseCompleted: false` without overwriting either preference.
The collapse toggle and its Settings search result are hidden when Jay's layout is selected. List
and Compact retain their existing opt-in behavior. Completed units can still be reopened for
review/editing. Unfinished sets and partial supersets remain expanded; only List and Compact
also keep their current unit expanded.

Jay's layout ignores a previously saved `active.cur`: it does not highlight, scroll to, or
advance that cursor. Exercise chips only reveal the chosen exercise. Hardware shortcuts that
target a current exercise are inactive; ordinary focused controls retain native keyboard
activation. Exercise headers omit the ordinal "Exercise 1 / 6" and "Superset 1 / 6" labels.
A subtle, labeled chevron button on the exercise-title line folds or reopens the whole
card, including unfinished sets,
without marking it complete. A collapsed card keeps its name, completion count and a compact
numbered summary of every set visible, with the completion-count tag at the left of the summary
instead of the exercise name. It uses the same weight/reps, timed, cardio and per-side
formatting as history. Superset members retain their own summaries.
These manual folds reset on reload; automatic folding still follows completion.
Expanded cards place the chevron to the right of the exercise menu; both use the same subtle
icon-only styling. Collapsed titles and set summaries remain clickable to reopen the card.
Jay's layout omits muscle/equipment tags, the plan line and the inline progression guidance.
Exercise settings remain available in each exercise's three-dot menu.
The sets container has no inset background or padding in Jay's layout; set headers, rows,
swipe actions and Add set keep their existing behavior. Swipe-row fronts match the surrounding
exercise surface rather than drawing dark tiles; they stay opaque to preserve swipe reveals.
Individual inputs, steppers and unchecked completion controls use a subtle contrasting fill;
completed checks and effort ratings retain their semantic colors.
Add exercise and Add note are visible tinted buttons side by side in Jay's layout.
The unfinished-workout footer button is hidden in Jay's layout; the header's Finish action
remains available. Completed-workout and saved-workout editing actions are unchanged.
Adding an exercise appends it, using the last entry's routine context. Move, swap
and remove remain in each exercise's menu rather than a footer aimed at a hidden selection.
Rest timers, superset round timing and workout completion still run normally. Switching back
to another layout retains its legacy cursor.

Collapsing preserves the visible tile's scroll position where possible. At the page start,
the list closes up naturally instead of adding a spacer below the collapsed exercise.

Orthogonal to all five: **Settings → During a workout → Workout controls** (`S.wc`) decides
whether Move / Swap / Remove, the pair buttons, the drop/burst shortcuts and the `+/-`
steppers show inline. The lean default keeps them in each exercise's ⋯ menu; turning
`exerciseButtons` on adds a footer Move / Swap / Remove row that acts on the current unit
(and, in `list` / `compact`, the "…act on the exercise marked Current" hint). Jay's layout
does not show that current-dependent footer.

## Where it is set

- **Saved default:** Settings → Workout → **Layout** (a 5-way `Segmented`), also available
  in the in-workout settings sheet, where choosing a saved layout clears the session override.
- **Per session:** the workout header's **⋮** button opens a `menuSheet` with the five
  layouts; picking one writes `s.active.workoutView`.

`beginWorkout` / `beginBackfill` (`frontend/src/sheets.jsx`) snapshot `S.workoutView` onto
`s.active.workoutView` when the session is created, and the render prefers
`A.workoutView || S.workoutView`. So the ⋮ menu re-lays-out the running session only, and
changing the saved default never disturbs a workout already in progress.

## Tests

Preference resolution and component coverage:

- `frontend/src/views/FocusView.jsx` and `frontend/src/views/FocusView.css` — Focus layout.
- `frontend/src/views/Workout.test.jsx` — `workout list view`, `workout compact view`,
  `workout focus view`, and `workout view header menu` describe blocks.
- `frontend/src/lib/workout-layout.test.js` — fallback and explicit/session preference precedence.
- `frontend/src/store/persistence.test.js` — backup/sync default and saved layout preservation.
- `frontend/src/views/Settings.workoutview.test.jsx` — the 5-way Segmented.
- `frontend/src/sheets.workoutview.test.jsx` — `beginWorkout` / backfill snapshot behaviour and
  Focus cases.
