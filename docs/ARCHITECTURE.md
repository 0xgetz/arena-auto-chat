# Architecture

`arena-auto-chat` is a small, dependency-free pipeline. Every layer has one
responsibility and talks only to the layer below it.

```
┌──────────────────────────────────────────────────────────────────┐
│ src/index.mjs            CLI: create | chat | run                 │
│ src/test_e2e.mjs         end-to-end smoke test                    │
├──────────────────────────────────────────────────────────────────┤
│ src/core/provision.mjs   orchestrates one account, start to finish │
├───────────────────────────────┬──────────────────────────────────┤
│ src/arena/client.mjs          │ src/inbox/zenvex.mjs             │
│ signup · magic link · chat    │ disposable address · inbox · link │
│ src/arena/dom.mjs             │                                   │
│ selectors + in-page scripts   │                                   │
├───────────────────────────────┴──────────────────────────────────┤
│ src/browser/manager.mjs   BrowserManager  (launch + page session) │
│ src/browser/remote.mjs    RemoteBrowser   (attach over CDP)       │
├──────────────────────────────────────────────────────────────────┤
│ src/browser/cdp.mjs       CDP client over the native WebSocket    │
│ src/browser/chromium.mjs  Chrome/Chromium process lifecycle       │
├──────────────────────────────────────────────────────────────────┤
│ src/config.mjs · src/utils/{logger,random}.mjs                    │
└──────────────────────────────────────────────────────────────────┘
```

## Data flow: `run`

```
CLI parses flags
  └─ loadConfig()            flags > env > .env > defaults
      └─ browser.start()     launch Chromium or attach over CDP
          ├─ createAddress()            zenvex.dev → random address
          ├─ signOutIfLoggedIn()        clear any previous arena.ai session
          ├─ submitEmail()              arena.ai modal → email → Create Account
          ├─ waitForMessage()           zenvex inbox → magic link
          ├─ completeVerification()     follow link → set password → logged in
          └─ sendChat()                 direct chat → type → send → read reply
```

Each stage is a plain async function that throws on failure; `provisionOne`
wraps them so one bad account never aborts a batch.

## The CDP client

`src/browser/cdp.mjs` is a ~180-line Chrome DevTools Protocol client built on
Node's global `WebSocket` (Node ≥ 22). It multiplexes commands over one socket,
correlates responses by `id`, and lets callers subscribe to protocol events:

```js
const session = await CDPSession.connect(wsUrl);
await session.send("Page.enable");
await session.navigate("https://example.com");
const title = await session.evaluate("document.title");
await session.waitFor("document.readyState === 'complete'");
```

`evaluate` throws when the page throws, and `waitFor` polls an expression until
it is truthy — both are used heavily by the arena.ai layer.

## Two ways to get a browser

| Class | When | How |
|---|---|---|
| `BrowserManager` | No browser on the machine | Finds Chrome/Chromium, launches it with `--remote-debugging-port`, opens a page target |
| `RemoteBrowser` | A browser already exists | Attaches to a `ws://…/devtools/browser/…` URL, or discovers one from an `http(s)://host:port` DevTools base |

Both expose the same surface — `page`, `goto`, `type`, `press`, `clickAt`,
`stop` — so nothing above cares which one is in use.

## arena.ai DOM knowledge

Every selector and in-page script lives in `src/arena/dom.mjs`. When arena.ai
changes its UI, that is normally the only file to touch. Two patterns are worth
knowing:

- **Filling React inputs.** Setting `.value` directly does not notify React, so
  `fillInput`/`fillEmail` go through the native value setter and dispatch
  `input` and `change` events.
- **Reading the answer.** Each assistant turn renders as
  `<p class="leading-[normal]">Thought for N seconds</p>` followed by unstyled
  `<p>` blocks: first the reasoning, then the visible answer, then an echo of
  the user's message. `CHAT_STATE` walks those blocks and returns the answer.

## Failure handling

- `waitForSecurityCheck` detects arena.ai's anti-bot gate and waits it out
  (cloud browsers solve it automatically; a local browser needs a human).
- `MODAL_ERROR` surfaces rate-limit text instead of hanging on the signup step.
- `CHAT_STATE.error` turns an upstream generation failure into a clear message
  rather than a timeout.
- `signOutIfLoggedIn` makes runs idempotent on a reused browser profile.

## Why zero dependencies

Node 22 ships `fetch` and `WebSocket`, which is everything a CDP client needs.
Avoiding Puppeteer/Playwright keeps install time at zero, removes a large
transitive tree, and makes the browser connection explicit rather than hidden
behind a framework.
