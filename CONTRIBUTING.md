# Contributing

Thanks for taking a look. This is a small, dependency-free project; the goal is
to keep it that way.

## Setup

```bash
git clone https://github.com/0xgetz/arena-auto-chat.git
cd arena-auto-chat
node --version   # must be >= 22
```

There is nothing to install — the project has no dependencies.

## Running

```bash
node src/index.mjs run --headful            # watch it work
node src/index.mjs create -n 1
node src/test_e2e.mjs --cdp http://127.0.0.1:9222
```

Use `--cdp` to drive an existing Chrome (`--remote-debugging-port=9222`) instead
of launching a new one, which is faster while iterating.

## Conventions

- **ES modules, Node 22.** No build step, no transpiler, no `node_modules`.
- **Zero dependencies.** If a change needs a package, it needs a very good
  reason; `fetch` and `WebSocket` are built in.
- **One responsibility per file.** See `docs/ARCHITECTURE.md` for the layering.
- **All arena.ai selectors live in `src/arena/dom.mjs`.** A UI change should be
  a one-file fix.
- **Never throw from an in-page script.** Return `{ ok: false, err }` and let
  the caller decide.
- **No secrets in the repo.** `outputs/`, `.env`, and browser profiles are
  gitignored; keep it that way.

## Adding a model or a command

- **Model**: nothing to add — pass any slug with `-m`. If a slug needs special
  handling, document it in `docs/USAGE.md`.
- **Command**: add it to the `parseArgs` allow-list and the `main` switch in
  `src/index.mjs`, then document it in the READMEs and `docs/USAGE.md`.

## Before opening a PR

- `node src/index.mjs --help` still renders.
- `node --check` passes on every file you touched:
  ```bash
  for f in $(git diff --name-only '*.mjs'); do node --check "$f"; done
  ```
- If you changed the flow, run `node src/test_e2e.mjs` once and confirm the
  stages you touched still pass.
- Update the READMEs (`README.md` and `docs/readme/*`) when user-facing
  behaviour changes.

## Reporting issues

Include the command you ran, the full log, and whether you used `--cdp` or a
locally launched browser. Never paste account passwords or cookies.
