#!/usr/bin/env bash
# Pull the contract (openapi.yaml, schemas, flows) and the example vault
# from cartograph-engine into ./contract and ./examples, and record which.
# The ref is a release tag (vX.Y.Z) or a commit, for an interface built
# against a contract before the engine release that embeds it. The
# contract is the engine's; this is a copy at a pinned ref, never edited
# here.
set -euo pipefail
version="${1:?usage: scripts/sync-contract.sh <vX.Y.Z or commit>}"
org="${CARTOGRAPH_ORG:-ProjectCartograph}"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -sSfL "https://github.com/$org/cartograph-engine/archive/$version.tar.gz" | tar -xz -C "$tmp"
rm -rf contract examples
cp -r "$tmp"/cartograph-engine-*/contract contract
cp -r "$tmp"/cartograph-engine-*/examples examples
echo "$version" > ENGINE_VERSION
echo "contract synced from cartograph-engine $version; run npm run generate"
