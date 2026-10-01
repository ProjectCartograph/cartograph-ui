# Style

Two guides, both Google's, adopted whole; this page is only what they
leave to the project and what the gate enforces.

## Code

**[Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)**,
and for the React parts the rules of hooks and `react/only-export-components`
as `oxlint` applies them. Where the guide and a tool disagree, the guide
wins; where the guide is silent, the surrounding code is the rule.

Enforced by `just ci`:

- `oxlint` (`just lint`), `tsc` with the project's strict options
  (`just test`).
- Generated files are not edited: `src/api/gen/schema.d.ts` from the
  contract, `src/routeTree.gen.ts` from the routes (`just drift`).
- No organisation's words, no em dash in what a person reads
  (`just words`).
- Nothing tracked that is not the product (`just clean-tree`).

What the guide leaves to us:

- No component talks to a wire. Code depends on the `Client` interface;
  the HTTP adapter behind it is the one place a path appears.
- Every control carries `data-cartograph-field` with the manifest's
  JSON pointer. A test finds a control by that, by step key, or by
  accessible name; never by visible text or placeholder.
- Every word a person reads lives in `src/copy.ts`, as standard nouns;
  marks for fixed choices in `src/components/vocab.tsx`. Text is the
  last resort: iconography and structure first.
- One UI library: Radix through shadcn/ui, plus cmdk.
- Flows render from the contract's flow document; a screen's own idea
  of the step order is a bug.
- Comments say why. A test fake returns what the real client returns.

## Commits

`CONTRIBUTING.md` ("Commit messages") is the full rule, with an
example; this is the summary.

**[Google's Angular commit message format](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md)**,
checked by `just commit-check` (`scripts/check-commit-msg`) in CI on
every pull request.

- **Header**: `<type>(<scope>): <summary>`, at most 72 characters. The
  type is Angular's (`build`, `ci`, `docs`, `feat`, `fix`, `perf`,
  `refactor`, `test`); the scope is one of this repository's areas, or
  none. The summary is imperative, lower-case, with no period.
- **A blank line.**
- **The body**, for every type but `docs`: what the change does and
  why, for the reader who was not there; what was considered; what to
  look at. What you ran and what it printed, when it matters.
- **The footer**: `BREAKING CHANGE:` or `DEPRECATED:` with what to do
  instead, when the change breaks or deprecates something. Then
  `Fixes #12` on its own line, where an issue exists.
- **`Signed-off-by`** (`git commit -s`): the Developer Certificate of
  Origin.

Install the hook once: `git config core.hooksPath .githooks`.

## Pull requests

One change per pull request, titled as its first commit's summary.
The description is the commit body. CI runs `just ci` on both
architectures and `just commit-check` on the commits.
