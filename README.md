# Hanabi

An implementation of the cooperative card game Hanabi: a rules engine, AI players, and a web UI for playing
with AI teammates (replaying games comes later).

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [H-Group convention levels](docs/H-GROUP-LEVELS.md)

## Development

Requires Node 24 (see `.nvmrc`) and pnpm.

```sh
pnpm install
pnpm dev          # the web UI at http://localhost:5173
pnpm check        # typecheck, lint, format check, tests
pnpm test:watch
pnpm format       # format in place
pnpm simulate     # H-Group self-play scores (--help for options)
```
