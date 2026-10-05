# Hanabi

An implementation of the cooperative card game Hanabi: a rules engine, AI players, and (later) a web UI
for playing and replaying games.

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [H-Group convention levels](docs/H-GROUP-LEVELS.md)

## Development

Requires Node 24 (see `.nvmrc`) and pnpm.

```sh
pnpm install
pnpm check        # typecheck, lint, format check, tests
pnpm test:watch
pnpm format       # format in place
```
