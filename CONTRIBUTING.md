# Contributing to cartograph-ui

`AGENTS.md` is the short brief; `STYLE.md` is the code and commit
style; this page is the loop.

## Getting set up

Nix, through the Determinate installer: `docs/SETUP.md` has the steps
for Linux, macOS and Windows (WSL2). Then every `just` recipe enters the
flake itself
(`nix develop` or direnv with the `.envrc` saves the start-up per
recipe). The flake pins Node and Chromium for x86_64 and aarch64. There
is no other supported way to build.

## The loop

1. `just test` after every edit (vitest and the strict type check).
2. `just ci` before a pull request: lint, drift, tests, build, words,
   clean tree, exactly what CI runs on both architectures.
3. If the contract changed in cartograph-engine: `just sync-contract
   vX.Y.Z`, then `just generate`, and commit both.
4. `git config core.hooksPath .githooks` once, so every commit message
   is checked against `STYLE.md` as you write it.

## What a change looks like

- A screen renders from the kind's flow and schema; it does not know
  the fields itself.
- Every control carries `data-cartograph-field`. A test finds it by
  that.
- Words go in `src/copy.ts`; marks in `src/components/vocab.tsx`.
- A behaviour change is a conformance scenario change in
  cartograph-engine first, then the interface.

## Pull requests

One change per pull request, titled as its first commit's summary
line; the description is the commit body: what it does for the person,
why, what you ran and what it printed. Commits follow `STYLE.md` and
are signed off (`git commit -s`, the Developer Certificate of Origin).
Nothing but the product is committed.

## Licence

Apache License 2.0 (`LICENSE`). By contributing you agree your
contribution is licensed under it.
