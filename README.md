<p align="center"><img src="public/logo.svg" width="96" alt="Cartograph"></p>

# cartograph-ui

[![ci](https://github.com/ProjectCartograph/cartograph-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/ProjectCartograph/cartograph-ui/actions/workflows/ci.yml) [![Licence](https://img.shields.io/badge/licence-Apache--2.0-blue.svg)](LICENSE) [![Release](https://img.shields.io/github/v/release/ProjectCartograph/cartograph-ui?include_prereleases)](https://github.com/ProjectCartograph/cartograph-ui/releases)

The interfaces to [Cartograph](https://github.com/ProjectCartograph/cartograph-engine). Apache License 2.0. `CONTRIBUTING.md` for the loop, `AGENTS.md` for the brief, `SECURITY.md` to report a vulnerability.

## The web interface

The single-page app for Cartograph: a definition editor and register browser for
projects, programmes, goals, KPIs, operations, and the other manifest kinds.
Built with Vite, React 19, TypeScript, TanStack Router and Query, shadcn/ui
on Radix, and Tailwind 4. The Go server embeds its build output and serves
it alongside the API, so what ships is one binary.

## Running it

`npm run dev` starts the Vite dev server with hot reload, but it doesn't
proxy to a backend (`vite.config.ts` sets no `server.proxy`), so a request
to `/api/v1/...` gets Vite's HTML fallback, not JSON. Fine for layout and
component work; useless for real manifests, since the HTTP adapter
(`src/client/http.ts`) calls `createClient` with a same-origin
`baseUrl: "/api/v1"`.

To work against a live API, build the SPA, embed it in an engine
checkout beside this one, and let the Go server serve both from one
port:

```
just build                                  # here: ./dist
cd ../cartograph-engine
just ui ../cartograph-ui/dist               # embed this build instead of the pinned release
just serve                                  # a copy of the example on 127.0.0.1:8080
```

Re-run `just build` and `just ui ../cartograph-ui/dist` after a frontend
change; there's no watch mode here. `just ui` with no argument puts the
engine's pinned release back.

## Layout

One line per top-level directory under `src/`:

- `api/`: the generated OpenAPI types, plus `names.ts`.
- `client/`: the `Client` port, its HTTP adapter (the one place a path appears), the provider and a fake for tests.
- `charter/`, `definition/`, `framework/`: the rendered charter, the save
  bar and check panel every editor shares, and the goal-alignment table.
- `gaps/`, `kpis/`, `operations/`, `programmes/`, `projects/`: one register
  each, with its screens and its own `api.ts`.
- `components/`: shared UI, including `vocab.tsx` (below) and the shadcn
  primitives under `components/ui/`.
- `routes/`: file-based routes; `routeTree.gen.ts` is generated from this
  tree on every build.
- `copy.ts`: every user-facing string (see below), sitting beside these
  directories rather than inside one.
- `surfaces/`: cross-cutting screens, the goals tree and editor, the
  working-copy sheet.
- `hooks/`, `lib/`: small shared hooks and generic utilities.
- `__tests__/`: tests with no single source file to sit beside; most tests
  sit next to their source as `*.test.tsx`.

## Tests

`just test` (vitest, then the strict type check), via vitest and
`@testing-library/react` with a jsdom environment. `just test` runs
this alongside the Go tests under a combined 10-second budget; that's the
gate, run after every edit. `npx tsc -b --force` type-checks the project
(plain `tsc --noEmit` checks nothing here, given the layout). `npx oxlint`
lints; it reports warnings only, so it isn't a gate by itself.

## The smoke test

`scripts/smoke.mjs` drives the built interface in headless Chromium over
the DevTools protocol, against a real engine: every route with zero
console errors, a Sheet create and edit, Arrange and the goal editor, a
project from its first screen to a saved version and a handoff, the goal
tree's renames, moves, deletes and drags, and the collapsed-rail,
1024-wide and keyboard-only passes. It changes the vault it runs against,
so point it at a copy of the example, which is what `just serve` gives
you:

```
just build                                  # here: ./dist
cd ../cartograph-engine
just ui ../cartograph-ui/dist               # embed this build
just serve                                  # a copy of the example on 127.0.0.1:8080
cd ../cartograph-ui                         # in another terminal
just smoke http://127.0.0.1:8080            # prints "smoke ok" and exits 0, or what failed
```

Chromium comes from `$CHROMIUM` (the engine's devShell, and this one on
Linux, set it) or from `chromium` on your PATH. `just smoke <url> shots`
also saves screenshots under `scripts/shots/`; `just smoke <url>
bootstrap` runs only the first-run flow (a Team, then a pillar, an
objective and an outcome) and expects a vault with nothing in it, such as
`just serve-vault <empty dir>` in the engine. `CARTOGRAPH_SMOKE_SEED`
replays the randomised navigation pass with the seed a failure printed.
Run `just ui` in the engine afterwards to put its pinned release back.

## Generated files: don't hand-edit

`src/api/gen/schema.d.ts` comes from `npm run generate`
(openapi-typescript, reading `./contract/openapi.yaml`). `src/routeTree.gen.ts`
comes from the TanStack Router plugin, reading `src/routes/`. Both are
committed; change the contract or the routes, regenerate, and commit the
result. `just drift` fails on any drift between a generated file and its
source.

## The words table

Every string a person reads lives in `src/copy.ts`, as plain nouns with no
em dashes and no emoji. `src/components/vocab.tsx` is the companion for
fixed-choice fields: the icon, label, and short label for each enum value,
keyed by field. Add a new label or icon there, not inline in a component.

## Design and decisions

The design of record lives in cartograph-engine: `docs/UI_CONTRACT.md`
says what an interface is built from, and `docs/DESIGN_RULES.md` how it
behaves. Structural decisions are recorded in `docs/adr/` there,
including the one that put this interface behind the `Client` port
(ADR 0006).
