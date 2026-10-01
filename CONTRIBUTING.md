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

## Commit messages

Every commit follows Google's Angular commit message format
([Angular: commit message guidelines](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md)),
strictly. `just commit-check` checks the parts a script can check, in
CI on every pull request and in the commit-msg hook.

**One change per commit.** A commit does one thing, and the tree builds
and passes its tests after it. If the summary needs "and" to say what the
commit does, it is two commits. A bug found while doing something else
is its own commit, before or after, never folded in.

**The header** is `<type>(<scope>): <summary>`, 72 characters at most.

The type is one of Angular's:

- `build`: the build, the release, or an external dependency
- `ci`: the CI configuration and its scripts
- `docs`: documentation only
- `feat`: a new feature
- `fix`: a bug fix
- `perf`: a change that makes something faster
- `refactor`: a change that neither fixes a bug nor adds a feature
- `test`: a missing test added, or a test corrected

The scope names the area the change is in; a change across several
has none. In this repository:

- `charter`: src/charter
- `client`: src/client, the Client port
- `collab`: src/collab, shared editing and presence
- `commits`: the commit message check
- `components`: src/components
- `contract`: contract/ and ENGINE_VERSION
- `contributing`: CONTRIBUTING.md, STYLE.md, AGENTS.md
- `definition`: src/definition
- `deps`: package.json and the lockfile
- `goals`: src/goals
- `projects`: src/projects
- `release`: the release tarball
- `smoke`: scripts/smoke.mjs

The summary says what the commit does, in the imperative, present
tense ("drop the stale index", not "dropped" or "drops"), starting
lower-case and with no period at the end. It stands on its own:
someone skimming the history learns what changed without reading the
body.

**A blank line**, then **the body**, required for every type but
`docs`, for the reader who was not there:

- what the problem was, and why it mattered;
- why this approach, and what was considered and rejected;
- any shortcoming the change leaves, and what would remove it;
- what you ran and what it printed, where that is the evidence.

Write prose. Wrap at 72 characters. Name files, functions and
settings exactly. A link is fine, with enough said that the commit
still makes sense if the link stops working.

**The footer** says what a change breaks or deprecates, each in its own
paragraph after the body:

```
BREAKING CHANGE: <what breaks>

<what to do instead>
```

```
DEPRECATED: <what is deprecated>

<what to use instead>
```

A revert's header is `revert: ` and the reverted header, and its body
says `This reverts commit <SHA>.` and why.

**Trailers** go last, one per line: `Fixes #12` or `Refs #12` where an
issue exists, then `Signed-off-by:` (required: `git commit -s`, the
Developer Certificate of Origin), then any `Co-authored-by:`.

A good message:

```
fix(syncserver): close sync peers concurrently on shutdown

Shutdown closed each peer's WebSocket in turn, and each close waited up
to five seconds for the peer's reply, so a replica with a few hundred
peers spent its whole grace period closing them. The closes now run
together, and Shutdown waits at most one second; a peer that has not
answered by then is cut off and reconnects all the same.

TestShutdownTellsPeersToGoElsewhere: 5.01 s before, 0.01 s after.

Signed-off-by: A Contributor <contributor@example.org>
```

Not: "fix: bug", "fix: build", "chore: update files", "WIP", "Phase 1",
"Address review comments", or a summary that only names the files.

## Pull requests

One change per pull request, titled as its first commit's summary
line; the description is the commit body: what it does for the person,
why, what you ran and what it printed. Commits follow `STYLE.md` and
are signed off (`git commit -s`, the Developer Certificate of Origin).
Nothing but the product is committed.

## Licence

Apache License 2.0 (`LICENSE`). By contributing you agree your
contribution is licensed under it.
