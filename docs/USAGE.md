# Usage

## Requirements

- **Node.js ≥ 22** — the project uses the native global `WebSocket` for CDP.
- **Google Chrome or Chromium** — auto-detected, or point at it with
  `CHROME_PATH`.
- Network access to `arena.ai`, `zenvex.dev`, and `arena.ai`'s mail sender.

No `npm install` is needed: there are no dependencies.

## Commands

```bash
node src/index.mjs run      # create an account, then chat   (default)
node src/index.mjs create   # create an account only
node src/index.mjs chat     # chat on the existing login
```

### `run`

```bash
node src/index.mjs run -m deepseek-v4.1-flash-max -p "test"
```

1. opens zenvex.dev and generates a fresh disposable address
2. submits it to arena.ai's sign-up modal
3. reads the magic link from the inbox and follows it
4. sets a strong password and confirms the session
5. opens a direct chat with the chosen model and sends the prompt

### `create`

```bash
node src/index.mjs create -n 3 -o outputs/batch.json
```

Creates N accounts, writing the JSON file after each one so a crash never loses
finished work.

### `chat`

```bash
node src/index.mjs chat -m deepseek-v4.1-flash-max -p "write a haiku"
```

Uses the browser profile's existing arena.ai login. No account is created.

## Options

| Flag | Default | Description |
| --- | --- | --- |
| `-n, --count N` | `1` | Number of accounts to create. |
| `-d, --domain D` | random | Pin a zenvex receiving domain. |
| `-m, --model M` | `deepseek-v4.1-flash-max` | Model slug for the direct chat. |
| `-p, --prompt TEXT` | `test` | Message to send. |
| `-o, --out FILE` | `outputs/arena-accounts-<ts>.json` | Account JSON output. |
| `--cdp URL` | — | Attach to a running browser (`ws://` or `http://` DevTools URL). |
| `-t, --timeout MS` | `180000` | How long to wait for the verification email. |
| `--headful` | off | Show the browser window. |
| `-q, --quiet` | off | Print only the final summary. |
| `-h, --help` | — | Show help. |
| `-v, --version` | — | Print the version. |

## Configuration

Copy `.env.example` to `.env`. Flags win over environment variables, which win
over the `.env` file.

| Variable | Default | Description |
| --- | --- | --- |
| `CHROME_PATH` | auto | Chrome/Chromium executable. |
| `HEADLESS` | `1` | Run without a visible window. |
| `CDP_PORT` | `9222` | Debug port for the launched browser. |
| `CDP_URL` | — | Attach to a running browser instead of launching. |
| `BROWSER_PROXY` | — | Proxy for the browser only, e.g. `socks5://127.0.0.1:10808`. |
| `PROFILE_DIR` | temp | Persistent profile; keeps logins between runs. |
| `EMAIL_TIMEOUT` | `180000` | ms to wait for the verification email. |
| `REPLY_TIMEOUT` | `180000` | ms to wait for a chat reply. |
| `PAGE_TIMEOUT` | `60000` | Per-step navigation timeout. |
| `ZENVEX_DOMAIN` | random | Pin the zenvex receiving domain. |
| `ARENA_MODEL` | `deepseek-v4.1-flash-max` | Default chat model. |
| `ARENA_PROMPT` | `test` | Default chat prompt. |
| `OUT_DIR` | `outputs` | Where account records are written. |

## Attaching to an existing browser

```bash
# A desktop Chrome started with --remote-debugging-port=9222
node src/index.mjs run --cdp http://127.0.0.1:9222

# A hosted browser, given its WebSocket URL
node src/index.mjs run --cdp wss://host/devtools/browser/<id>
```

A bare hostname is assumed to be `https://`.

## Output format

`outputs/arena-accounts-<timestamp>.json`:

```json
[
  {
    "ok": true,
    "provider": "arena.ai",
    "email": "swiftfox482913@souss.dev",
    "password": "K7!mQ2pXz9wRt4vB",
    "full_name": "Putri Maharani",
    "email_provider": "zenvex.dev (souss.dev)",
    "login_url": "https://arena.ai/",
    "elapsed_ms": 41230,
    "created_at": "2026-10-01T16:12:48.031Z"
  }
]
```

Failed records keep `ok: false` and an `error` field.

## End-to-end test

```bash
node src/test_e2e.mjs --cdp http://127.0.0.1:9222
```

Runs every stage against the live services and writes
`outputs/e2e-report-<ts>.json`. Exit code 0 means all stages passed.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Chrome/Chromium not found` | No browser installed | Install one or set `CHROME_PATH`. |
| `arena.ai did not advance past the email step` | Rate-limited from this IP | Wait, lower the rate, or use `--cdp` with another browser. |
| `security verification that was not solved` | Anti-bot gate | Cloud browsers solve it automatically; locally use `--headful` and complete it. |
| `timed out waiting for the verification email` | Mail delayed or filtered | Raise `EMAIL_TIMEOUT`; check the zenvex inbox manually. |
| `arena.ai reported a generation error` | Upstream model failure | Retry, or pick another `-m` model. |
| `waitFor timed out: chat input` | Page still loading | Raise `PAGE_TIMEOUT`; check the network. |

## Operational notes

- **Rate limits.** arena.ai throttles repeated sign-ups from one IP. Space out
  batches and prefer a fresh browser (new IP) when doing many accounts.
- **Disposable mail is disposable.** A zenvex address cannot receive password
  resets later; keep the generated password.
- **Never commit `outputs/`.** It contains credentials. It is gitignored.
