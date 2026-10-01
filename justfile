# Cartograph interfaces. `just` lists recipes. Every recipe runs inside
# the toolchain flake.nix pins (scripts/toolchain enters `nix develop`
# unless the caller already did), so a laptop, CI and a release build
# the same way on either architecture.
set shell := ["scripts/toolchain", "bash", "-euo", "pipefail", "-c"]

toolchain := source_directory() / "scripts/toolchain"

default:
    #!/usr/bin/env bash
    just --list --unsorted

# Install dependencies exactly as locked (dev dependencies included: the build tools are among them)
deps:
    #!{{toolchain}} bash
    set -euo pipefail
    if [ ! -x node_modules/.bin/tsc ] || [ ! -x node_modules/.bin/vite ] || [ node_modules -ot package-lock.json ]; then npm ci --include=dev; fi

# The gate, after every edit: unit tests and the type check
test: deps
    npx vitest run
    npx tsc -b --force

# What CI runs, in this order
ci: deps generate drift lint test build words wire clean-tree

# Regenerate the client types from the contract copy
generate: deps
    npm run generate

drift:
    git diff --exit-code -- src/api/gen

lint: deps
    npx oxlint

build: deps
    npm run build

# Pull the contract and the example from a cartograph-engine release
sync-contract version:
    scripts/sync-contract.sh {{version}}

# The dev server with hot reload (no API behind it; see README)
dev: deps
    npm run dev

# Drive this build headless against an engine already serving it (README: The smoke test); Chromium is $CHROMIUM or chromium on PATH
smoke url="http://127.0.0.1:8080" *args="":
    node scripts/smoke.mjs {{url}} {{args}}

# No organisation's words in the interface, no em dashes in what a person reads
words:
    #!{{toolchain}} bash
    set -uo pipefail
    n=$(grep -rniE '\b(ministry|school|schools|pupil|cabinet|circular|vote|district|teacher|ecce)\b' --include='*.ts' --include='*.tsx' --include='*.json' src | wc -l)
    d=$(grep -rnE '—|\\u2014' src/copy.ts | grep -vE '^[^:]+:[0-9]+:\s*//' | wc -l)
    echo "domain words: $n, em dashes in what a person reads: $d"
    test "$n" -eq 0 && test "$d" -eq 0

# No component talks to a wire: an API path, a fetch or openapi-fetch only in the HTTP adapter (src/client/http.ts), and Automerge only behind the port (src/client)
wire:
    #!{{toolchain}} bash
    set -uo pipefail
    hits=$(grep -rnE '(^|[^@])/api/|openapi-fetch|\bfetch\(' src | grep -vE '^src/api/gen/|^src/client/http(\.test)?\.ts:')
    n=$(printf '%s' "$hits" | grep -c . || true)
    test "$n" -eq 0 || printf '%s\n' "$hits"
    echo "wire outside the adapter: $n"
    crdt=$(grep -rnE "(from|import|require)[[:space:](]*['\"]@automerge/" src | grep -vE '^src/client/')
    m=$(printf '%s' "$crdt" | grep -c . || true)
    test "$m" -eq 0 || printf '%s\n' "$crdt"
    echo "automerge outside the client: $m"
    test "$n" -eq 0 && test "$m" -eq 0

clean-tree:
    scripts/check-clean-tree

commit-check base="origin/main":
    scripts/check-commit-msg {{base}}

# Package the build the engine embeds (what a release attaches)
dist-tarball: build
    #!{{toolchain}} bash
    set -euo pipefail
    # Byte for byte the same wherever it is built: entries sorted, times,
    # owners and modes fixed, no timestamp in the gzip header. The engine
    # pins a release by the SHA-256 of this file (its UI_SHA256).
    tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner \
        --mode='a+rX,u+w,go-w' --format=gnu -C dist -cf - . | gzip -9n > dist.tar.gz
    echo dist.tar.gz

clean:
    rm -rf dist dist.tar.gz node_modules result .direnv
