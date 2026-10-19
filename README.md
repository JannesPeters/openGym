# openGym - personal fork

This is my personal fork of [openGym](https://github.com/DuarteSantos8/openGym), originally
created by Duarte Santos and its contributors. I'm adapting the UI and UX to my own preferences
and how I work out: mostly simplifying the interface, with a few focused workout features.
It is not the official openGym project or a separate product.

**Personal version:** [`personal` branch](https://github.com/JannesPeters/openGym/tree/personal)
and [this fork's deployment](https://opengym-jay.vercel.app/).
The [`main` branch](https://github.com/JannesPeters/openGym/tree/main) keeps the upstream-oriented
version. The deployment linked here belongs to this fork, not upstream.

## What differs on the personal branch

The changes below are merged on the `personal` branch and describe this fork only; they are not
features of upstream openGym.

### Training and UI

- **Less friction in planning.** Simplified exercise browsing, exercise details and routine
  editing. Adding and configuring exercises in Plan uses full-screen pages with Back navigation;
  returning to the browser preserves search and filters and marks exercises already in the routine.
- **A Home screen that fits the workflow.** Independently show or hide the schedule/saved-workout
  widget and recent workouts rather than keeping everything on screen.
- **A focused workout layout.** Custom is the default when no workout layout preference has been
  saved; existing preferences are kept. Completed exercises always collapse in Custom.
- **Alternatives within a routine slot.** Keep multiple exercise options with their own
  prescriptions and progression, and explicitly choose which to perform each workout. Once work
  is logged, that exercise cannot be swapped out; another option can be added alongside it
  without losing the logged sets.
- **Clearer routine summaries.** Named choice groups appear by name, muscle-coverage guidance is
  shown only when expanded, and a saved setting controls routine and workout title icons.

### Local development tools

For contributors, the branch also includes a Storybook gallery for existing UI components and an
isolated, seeded local preview of the app. These are development tools, not features of the
deployed app.

The foundation is still openGym: routine planning, guided workouts, set and body-weight logging,
progression, history and statistics, with a self-hostable backend and an installable web app.
These changes are personal workflow choices, not a general redesign or an upstream roadmap.

## Run this version locally

You need [Docker with Compose](https://docs.docker.com/get-docker/).

```bash
git clone --branch personal --single-branch https://github.com/JannesPeters/openGym.git
cd openGym
cp .env.example .env
docker compose up -d --build
```

Open <http://localhost:8080>. The default configuration supports localhost; for access from a
phone using passkeys, configure HTTPS and set `RP_ID` and `ORIGIN` for your hostname in `.env`.
See the [self-hosting guide](docs/SELF_HOSTING.md) before exposing an instance.

**Build from this checkout to get the personal changes.** The Compose file still names upstream
prebuilt images; pulling those images instead of building does not include this branch's UI.
The source build packages the exercise media with the web image.

Profile and workout data for the self-hosted stack live in `./data`; back up that folder and do
not commit it. Guest mode keeps data locally in the browser rather than syncing it to the server.
The public deployment is separate from running your own backend; its link is not a promise of
hosted accounts or cross-device sync.

## How openGym is built

This fork keeps the upstream architecture:

| Directory | Purpose |
| --- | --- |
| `frontend/` | React + Vite UI, shared components, state and tested training helpers |
| `api/` | Node HTTP API for profiles, authentication and per-user data |
| `web/` | Docker build and nginx serving the frontend and proxying `/api` |
| `catalogue/` | Exercise catalogue, translations and separately licensed media |
| `mcp/` | Optional read-only bridge for LLM clients |
| `docs/` | User guides, hosting instructions and development notes |

For frontend development, use Node 22 and run the stack above first:

```bash
cd frontend
npm ci
API_TARGET=http://localhost:8080 npm run dev
```

Open the URL Vite prints. `API_TARGET` sends the dev server's API requests through the running
local stack; exercise media are served from `catalogue/media/`.

The existing checks can be run from the repository root:

```bash
(cd frontend && npm test && npm run build)
(cd api && npm ci && npm test)
(cd mcp && npm ci && npm test)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for code conventions. Its community, release and support
information describes upstream; fork-specific changes belong in this repository.
The [upstream README](https://github.com/DuarteSantos8/openGym#readme) describes the original
project and its development process.

## Documentation

- [Documentation index](docs/README.md) and [FAQ](docs/FAQ.md)
- [Self-hosting](docs/SELF_HOSTING.md) and [HTTPS on a LAN](docs/SELF_HOSTING_HTTPS.md)
- [Mobile build instructions](docs/MOBILE.md) for building from this checkout
- [Data imports](docs/DATA_IMPORTS.md) and [API](docs/API.md)
- Optional [AI coach](docs/AI_COACH.md) and [MCP bridge](mcp/README.md)

These guides are inherited from openGym and may describe upstream defaults, services or
releases. Upstream downloads and container images are not builds of this personal branch.

## Attribution and license

openGym is the work of [Duarte Santos and the upstream contributors](https://github.com/DuarteSantos8/openGym).
This repository builds on their work; the original attribution and third-party notices remain
in [NOTICE.md](NOTICE.md).

The code remains licensed under **GNU AGPL-3.0-or-later**; see [LICENSE](LICENSE). If you run a
modified version as a network service, you must offer its corresponding source under the same
license.

> [!IMPORTANT]
> **Exercise media are not covered by the AGPL.** Stills and animations are
> © Aliaksandr Makatserchyk, [Gym visual](https://gymvisual.com/), licensed for use in openGym only.
> Repository and self-hosted media are limited to 180 px; larger versions are restricted to app
> packages. A non-commercial openGym fork may retain the unmodified 180 px media with the notice.
> Commercial forks and other uses require their own license from Gym visual. Do not extract,
> hotlink or repurpose these assets, or use them as input to AI systems.

See [NOTICE.md](NOTICE.md) for the full media terms, body-diagram attribution and exercise-text
licenses, including the inherited ExerciseDB text.
