# Workout view — custom / cards / list / compact / focus

The active workout screen (`frontend/src/views/Workout.jsx`) has five layouts, chosen by
`S.workoutView` (`'custom' | 'cards' | 'list' | 'compact' | 'focus'`, default `'custom'`). All five use the
same active session and completion pipeline.

| Value | What you see |
|---|---|
| `custom` | Based on List, with a separate saved value and `.workout-custom` / `data-layout="custom"` presentation hooks for iterative design. Completed exercises always fold away; there is no collapse toggle. Shares List's rows, media behavior and actions; no layout builder. |
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

Custom ignores saved/session `collapseCompleted: false` without overwriting either preference.
The collapse toggle and its Settings search result are hidden when Custom is selected. List
and Compact retain their existing opt-in behavior. Completed units can still be reopened for
review/editing, and the current unit, unfinished sets and partial supersets remain expanded
under the existing completion rules.

Orthogonal to all five: **Settings → During a workout → Workout controls** (`S.wc`) decides
whether Move / Swap / Remove, the pair buttons, the drop/burst shortcuts and the `+/-`
steppers show inline. The lean default keeps them in each exercise's ⋯ menu; turning
`exerciseButtons` on adds a footer Move / Swap / Remove row that acts on the current unit
(and, in `custom` / `list` / `compact`, the "…act on the exercise marked Current" hint).

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
