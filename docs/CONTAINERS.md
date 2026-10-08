# Working in containers

Everything that builds, tests or serves the interface runs in the test
environment: a container with Nix and nothing else, where every tool
comes from this repository's flake. A person, CI and an agent work in
the same environment, the host keeps nothing but a container runtime,
and the engine need not be cloned beside it.

The environment is for testing. It never makes a change: changes are
made, described and pushed on the host, with `jj` from the flake.

## Run anything

You need Docker, or Podman with its compose (`CARTOGRAPH_RUNTIME=podman`
when both are installed).

    scripts/dev just test           # the gate
    scripts/dev just ci             # everything CI runs
    scripts/dev                     # a shell inside
    scripts/dev --down              # stop the environment

The first command builds the image, fetches the toolchain and installs
the packages, under half a minute when the Nix store already holds the
toolchain; later ones start in seconds.

## How it is built

| File | What it is |
|---|---|
| `deploy/dev/Containerfile` | The image: Nix, pinned by digest, and nothing else. |
| `compose.dev.yaml` | The one service, `dev`, and its volumes. |
| `scripts/dev` | Starts it, gives its volumes to your user once, syncs the repository in, and runs the command in the flake. |

| Inside | What it holds |
|---|---|
| `/src/cartograph-ui` | This repository, read-only. |
| `/workspace` (volume `cartograph-ui-workspace`) | The copy each command runs in, synced from `/src` before it. `node_modules` and `dist` stay here. |
| `/nix` (volume `cartograph-nix`) | The Nix store, the same volume the engine's environment uses: what either fetches, both use. `CARTOGRAPH_NIX_STORE` names a directory to use instead. |
| `/home/dev` (volume `cartograph-home`) | Caches the tools keep. |

Commands run as your user. To start again from nothing:
`scripts/dev --down`, then `docker volume rm cartograph-ui-workspace`.

## For agents

Run every build, test and server through `scripts/dev`. Never edit,
describe or push inside it: the copy is thrown away at the next sync.
