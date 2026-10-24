# Reusable exercise groups

## State version 2

`stateVersion: 2` is the capability boundary for reusable exercise groups. Exercise identity
continues to mean a catalogue, custom, or variant exercise, never a group.

- `exerciseGroups`: user-owned definitions `{ id, name, options: [{ id, exerciseId }], archived? }`.
  Options are equal; order is presentation only. Empty drafts and one-option groups are groups.
- Routine placement: `{ kind: 'group', slotId, groupId, optionConfigs, sg?, sgName?, sgRest? }`.
  `optionConfigs[optionId]` holds that placement's prescription, including its actual exercise
  `id` as an identity guard. It never supplies membership or order. Reusing or copying a routine
  shares the definition, not the prescription objects.
- Workout entries remain flat. Each group entry owns a frozen `groupInstance` snapshot
  `{ id, groupId, slotId, rid, name, options, routine }`. Its options are equal records with
  stable `id`, `exerciseId`, and resolved `config`. Entries from that instance carry the same
  snapshot identity, their own `entryId`, and an explicit `optionId` when selected.
  A pending entry has no exercise identity or planned sets. Multiple selections do not imply
  a superset. The existing superset relationship remains on the appropriate flat entries.

Membership/name edits affect all referencing routine placements, never running or saved
sessions. The editor names the affected routines and offers an independent copy before a
local divergence. Adding an option initializes every live placement with that exercise's own
defaults, not another option's numbers. Removed option configurations are retained under their
original keys (and are not performed); reordering cannot reassign them. A newly added option
gets a fresh identity even if its exercise was previously removed. A concurrent definition
edit may arrive without the associated configuration: start then explicitly requires setup,
rather than silently inventing a prescription.

Archive hides a definition from reuse, without removing its referenced placements or history.
Existing placements can still train and configure it. Definition deletion is not exposed.
Custom exercise deletion removes that exercise's memberships but keeps group/placement
identity, including an empty draft requiring attention before starting.

## Migration

The runtime-neutral migration lives with the existing shared API/frontend core. It is pure,
versioned and idempotent; no on-disk migration is run at server startup. Frontend load, restore,
sync and import boundaries normalize copies before use.

Every legacy inline choice slot produces its own definition, never a name/membership-based
deduplication. IDs derive deterministically from routine ID, existing slot ID (or original
position when absent), and option occurrence. All configurations, actual exercise/variant IDs,
order, slot identity and superset metadata survive. Independent upgrades of the same legacy
document consequently agree on identities. New routine/plan copies explicitly mint placement
identities. Plan imports mint definition IDs once per imported definition, preserving reuse
within the imported plan without linking it to a recipient's unrelated group.

Already-active legacy groups migrate from their session-owned option snapshots, retaining
sets, selection, routine attribution and group linkage. Their snapshots never resolve against
a newly edited live definition. Historical records that predate instance provenance keep
their original exercise IDs, group names and sets: missing provenance cannot safely be
reconstructed from current routines and is not fabricated.

## Rollout and exchange

For an API-connected profile, upgrade API and frontend together, then reload all clients.
`GET /api/health` advertises `stateVersion: 2` without requiring account credentials.
The new client requests state
capability 2 with `X-OpenGym-State-Version: 2` and checks the server's advertised capability
before pushing reusable definitions.
After a version-2 document is stored, the API refuses legacy reads/writes (including revision
polls) with an update-required error. It also refuses version downgrades and unknown future
versions. A stale old device is not silently merged into a new-schema document; its old local
copy remains available for export/import using an updated client. Back up the data directory
before rollout; rollback requires restoring the matching pre-upgrade data, not stripping
definitions or flattening their placements.

Full backups retain the version and definitions. Shared plans use `opengym_plan: 3` when they
contain reusable groups and carry only referenced definitions and custom/variant dependencies.
Versions 1 and 2 remain importable via migration. Unsupported versions fail explicitly.
All referenced options must resolve for a group plan import; silently dropping an unknown
member would change the reusable object. Ordinary legacy unknown exercises retain the
existing reported-drop behavior.

Definitions participate in entry-level sync stamps, union/field merges, deletion records,
resets, backup replacement, unsent-change counts and sign-in adoption. Configuration edits
continue to belong to their routine. Membership conflicts use the existing field-last-edit
policy; missing configurations fail validation rather than being assigned by array position.

## Deployment topology and the merge gate

Merging code, deploying it and converting a profile are different operations.

The public fork at `https://opengym-jay.vercel.app/` is a static frontend deployment:
`frontend/vercel.json` builds `frontend/dist`, with no API function or API rewrite.
On 2026-10-24, anonymous requests to its `/api/health` and `/api/config` both returned
Vercel `404 NOT_FOUND`. GitHub's deployment record links the latest `personal` commit,
`be3e66b8`, to a successful Vercel Production deployment. The checked-in Docker publishing
workflow runs for `main`/releases, not `personal`; merging this PR does not deploy a
self-hosted account API.

These facts do not identify where an individual user's backed-up profile lives. Before
recommending merge for migration, confirm whether it is guest/local data on that public
origin or a signed-in profile on a self-hosted instance. Do not infer an updated API from
a successful Vercel frontend build, and do not infer a recoverable server deployment
from a JSON export alone.

### Guest/local profile on the public frontend

1. Keep the exported JSON backup. Close older tabs/devices using this profile, without
   clearing site storage or uninstalling the home-screen app.
2. Merging into `personal` may auto-deploy the Vercel frontend. Verify that deployment's
   source commit and production alias before opening the updated app. No account API
   capability is needed for a genuinely local/guest profile: it never syncs account state.
3. The first updated load validates and converts a copy of the browser document, keeping
   its original in the owner-scoped browser recovery key. The first normal profile save
   persists `stateVersion: 2`; subsequent loads do not convert it again.
4. Check the group memberships, every option's configuration, existing history and any
   retained active workout before continuing. Keep using the same origin; a different
   preview/deployment URL has different browser storage. Keep the export until accepted.
5. Importing the JSON export is recovery, not a routine migration step: the updated app
   reads the profile already in this browser. If no normal save has happened yet, make
   one ordinary settings or plan save after checking the converted view. Do not clear
   site storage, switch browser/profile or open an individual preview URL to migrate
   the existing copy. For an installed web app, use Check for updates / Reload openGym
   or a fresh app load on the same production origin.

### Signed-in or paired profile using an account API

1. Finish or export any offline edits on other devices. Download a JSON backup from the
   current app and retain a filesystem backup of the server's data directory.
2. Deploy the API from the same reviewed commit before opening the updated account-connected
   frontend. This is a separate operator action, not a consequence of the Vercel frontend
   deploy. Check the instance's public `/api/health`: it must return HTTP 200 with
   `writable: true` and `stateVersion: 2`. A 404, an HTML page, a missing capability or a
   different version is not readiness. Do not read/export account state just to test this.
3. Deploy the matching frontend, then open it on one device and inspect the converted plan
   before starting a session. Do not point a development preview at the real account.
   First load converts a validated local copy; the first successful save/sync upgrades the
   persisted account document. Conversion failure leaves the original intact. If the actual
   account-connected frontend is auto-deployed by merge, arrange the API update first or
   hold that deployment; do not merge into an uncontrolled mismatch.
4. The first successful version-2 PUT keeps the exact original account file as
   `state-<uid>.json.pre-groups-v1.json` using the existing durable atomic-write helper, then
   stores the converted account and version. It never overwrites that recovery copy.
   A local legacy profile is also preserved in an owner-scoped browser backup before its first
   converted save. On mobile, that recovery copy is written to an owner-scoped private file
   and read back before the native state mirror can be replaced. Backup failure leaves the
   original mirror unchanged and reports an error. Signing out clears the app-owned recovery
   copies with that account's data; the server's rollout backup is retained.
   A native recovery file contains `{ owner, raw }`; `raw` is the full original JSON document.
   Saving that string's contents as a `.json` file makes it importable through Data & backup.
5. Reload the remaining devices. Old app requests are refused after the account upgrade.
   Repeated loads or independently converted copies converge on the same deterministic
   identities; importing an old backup uses the same converter, not a legacy writable model.
6. Confirm routine membership/configuration and a disposable new session. Keep the original
   backup until the rollout has been accepted. Rollback means restoring the old app/API and
   its matching pre-upgrade account backup, not downgrading a version-2 blob.

Planned muscle coverage averages the equal options instead of using the first one. Actual
workout statistics still use only performed exercises. The Coach reads equal option records
and can adjust an unambiguous option's routine-local prescription. Its current contract cannot
identify repeated placements or authorize shared membership edits: those suggestions fail
explicitly and must be made in the routine editor rather than guessing a target.
