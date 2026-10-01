# Working in cartograph-ui

Read this before touching anything. It is the whole brief.

## What this is

The interfaces to Cartograph: the web interface (Vite, React 19,
TypeScript, TanStack Router and Query, shadcn/ui on Radix, Tailwind 4)
and, as it is built, the terminal interface (Bubble Tea). The engine,
the contract and the rules are in
[cartograph-engine](https://github.com/ProjectCartograph/cartograph-engine); this
repository renders what the engine serves and sends back what the
person did. Every behaviour here is held to the engine's conformance
suite.

## Commands

Every command is a `just` recipe, and every recipe runs inside the
flake (`nix develop`), so what you run is what CI runs on x86_64 and
aarch64. Nix is required (`docs/SETUP.md`); there is no Makefile.

| Do | Run |
|---|---|
| The gate, after every edit | `just test` (vitest and the type check) |
| Everything CI runs | `just ci` |
| Lint, build | `just lint`, `just build` |
| Regenerate the client types | `just generate` |
| Pull the contract and the example from an engine release | `just sync-contract vX.Y.Z` |
| Run against an engine | `just build`, then `cartograph serve <vault>` from cartograph-engine serves this build |

## Rules that are not negotiable

- **The contract is the engine's.** `contract/` and `examples/` here are synced copies at a pinned engine version (`ENGINE_VERSION`). Never edit them; change them in cartograph-engine and sync.
- **No component talks to a wire.** Code depends on the `Client` interface; the HTTP adapter behind it is the one place a path appears, generated from the contract. A terminal interface runs in-process with no server at all.
- **Fields are named by path.** Every control carries `data-cartograph-field` with the manifest's JSON pointer. Tests find controls by that, by step key, or by accessible name; never by visible text or placeholder.
- **Flows come from the contract.** Steps, fields and controls are rendered from the kind's flow document.
- **Text is the last resort.** Every word a person reads lives in `src/copy.ts`, standard nouns, no em dashes, no placeholders inside controls. `just words` checks.
- **One UI library.** Radix through shadcn/ui, plus cmdk. Nothing else.
- **A check never blocks a save; a refused version lands its problems on the fields.** The server's message, nowhere else.
- **Style is Google's, enforced.** `STYLE.md`: the TypeScript style guide, oxlint, strict tsc; commit messages as Google CL descriptions, checked by `just commit-check`. No Conventional Commits prefixes.
- **Upstream is the product and nothing else.** No notes, logs, plans, transcripts, screenshots, scratch files or editor and agent state are committed (`just clean-tree`). What you did goes in the pull request description.
- **Generated files are not edited**: `src/api/gen/schema.d.ts`, `src/routeTree.gen.ts`.
- **Never run `git` or `jj` write commands** unless the person asks for that in so many words.

## Conformance

`pkg/uiconformance` in cartograph-engine is the suite; its scenarios are
JSON. This repository's driver runs them in CI against the engine
serving a copy of the example. A change that fails a scenario is a
behaviour change and needs the scenario changed in cartograph-engine
first.

## Where things are

`src/copy.ts` (words), `src/components/vocab.tsx` (marks for fixed
choices), `src/routes` (file-based routes), `src/surfaces` (screens),
`src/definition` (the shared save bar and check panel), `src/client`
(the `Client` port and its HTTP adapter), `scripts/`
(the harness and the checks). The engine's `docs/UI_CONTRACT.md` and
`docs/DESIGN_RULES.md` are the design of record.

## How to write

Short sentences, plain words, standard terms. Say what you ran and what
it printed; never claim a check you did not run.
