# Component preview with Storybook

Storybook previews openGym's existing React controls and CSS primitives without starting
the app, signing in or running the API. It is development tooling, not another app UI kit.

## Run it

Use Node 22.12 or newer in the Node 22 line (CI uses Node 22), or another Node version
supported by the frontend's Vite 8 installation.

```bash
cd frontend
npm ci
npm run storybook
```

Open **http://127.0.0.1:6006**. The server binds to loopback, does not open a browser
automatically, and fails rather than silently choosing another port if 6006 is occupied.
An alternate port can be passed with `npm run storybook -- --port 6007`.

If your development environment asks for permission to install dependencies or run the
`storybook` package script, approve that operation once; there is no Storybook account,
backend, environment file or seed-data step. npm may run the existing frontend dependencies'
build/install scripts. Storybook telemetry is disabled in both scripts and configuration.

The toolbar changes **dark/light theme**, all **eight accents**, and **LTR/RTL direction**.
Direction is a layout preview; sample copy remains English. The app's CSS media queries and
reduced-motion behavior are unchanged, so resizing the browser also previews narrow layouts.

## What is included

| Area | Examples |
|---|---|
| Design system / Foundations | Overview gallery, live color tokens, typography in use, radii and motion |
| Components / Buttons | Editable Button args, variants, sizes, icons and disabled state |
| Components / Controls | Text fields, textarea, search/clear, numbers, switches, segmented control, steppers, sliders and checkbox |
| Components / Surfaces | Cards, grouped Section/Row lists and tags |

The Button **Docs** page includes its component description and controls. Other stories
include explanatory copy beside their examples.

The source of truth is `frontend/src/index.css` and `frontend/src/components/ui.jsx`.
Cards, icon-only buttons and tags are plain `.card`, `.iconbtn` and `.tag` elements in the
app, so their stories use those classes directly instead of introducing wrapper components.
The stylesheet has no canonical heading scale; the typography story shows actual contextual
styles such as `.hdr h1`, `.card .big`, `.sect-t`, `.small` and `.muted`.
Swatches reference CSS custom properties, not duplicated color values.

Controls keep their state inside each story. Typing, clearing, toggling, selecting, stepping,
holding and keyboard slider adjustment work without saving anything. Story state resets when
switching stories. These are UI previews, not a simulated workout or a test account.

## Isolation and limitations

`frontend/.storybook/main.js` explicitly bypasses `frontend/vite.config.js` and disables
the app's public directory. The gallery therefore does not inherit API/media proxies,
analytics injection, mobile flavor tags, service-worker stamping, the app manifest or
the app's service worker. The React/Vite framework supplies JSX handling; these stories
need no app aliases, `__APP_VERSION__` define, media assets or additional providers.

Only the shared controls, Icon and stylesheet are imported. The controls' transitive
imports are keyboard helpers and the English-default i18n module; those do not initialize
the Zustand store, persistence, server sync or native services. The i18n module registers
lazy locale loaders, but these stories do not request exercise details or change language.
Theme and direction attributes live on the Storybook preview document, not the app.
Keep Storybook on its own port/origin so it cannot share the app's browser storage.

`SelectRow`, `SelectButton` and `MultiSelectRow` need a store registered through `bindUI`
and the app modal host. They are deliberately omitted rather than binding a fake global
store or loading the real persisted app state. Full screens, authentication, rest timers,
server sync and exercise-media widgets are also outside the initial gallery.

## Add or validate stories

Add JavaScript CSF stories under `frontend/stories/*.stories.jsx`, import the real shared
component, and use local React state for controlled props. Keep gallery-only spacing in
`.storybook/preview.css`; never restyle a control there to make a story look right.
Story files are outside `src`, and nothing in the app imports them.

```bash
cd frontend
npm run build-storybook
npm test -- src/components/ui.test.jsx
npm run build
```

The static gallery is written to ignored `frontend/storybook-static/`, separate from the
app's `dist/`. Serve that directory over HTTP to share a static build; no API is needed.
The existing frontend CI job also builds Storybook to catch bad imports and JSX.
