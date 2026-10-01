/**
 * Connect to an already-running browser over CDP instead of launching one.
 *
 * Useful when Chrome/Chromium is managed elsewhere — a cloud browser, a
 * container sidecar, or a desktop Chrome started with
 * `--remote-debugging-port=9222`. Provide the browser WebSocket URL directly,
 * or an HTTP DevTools base URL from which it is discovered.
 *
 * @module browser/remote
 */

import { CDPSession } from "./cdp.mjs";
import { log } from "../utils/logger.mjs";

/**
 * Normalise a `--cdp` argument into a browser WebSocket URL.
 * Accepts:
 *   - ws://…  or  wss://…                       (used as-is)
 *   - http://host:port  or  https://host:port   (…/json/version is fetched)
 *
 * @param {string} target
 * @returns {Promise<string>}
 */
export async function resolveWsUrl(target) {
  if (/^wss?:\/\//i.test(target)) return target;

  let base = target.replace(/\/+$/, "");
  // A bare host defaults to https, which is what hosted DevTools endpoints use.
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;

  const res = await fetch(`${base}/json/version`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`DevTools endpoint returned HTTP ${res.status}: ${base}`);
  const json = await res.json();
  if (!json.webSocketDebuggerUrl) {
    throw new Error(`no webSocketDebuggerUrl at ${base}/json/version`);
  }
  return json.webSocketDebuggerUrl;
}

/**
 * Attach to a remote browser and open a fresh page session, mirroring
 * `BrowserManager` so the rest of the code is unchanged.
 */
export class RemoteBrowser {
  #browser;
  #page;
  #targetId;

  constructor(config, cdpTarget) {
    this.config = config;
    this.cdpTarget = cdpTarget;
  }

  get page() {
    if (!this.#page || this.#page.closed) throw new Error("page session is not available");
    return this.#page;
  }

  async start() {
    const wsUrl = await resolveWsUrl(this.cdpTarget);
    log.info(`attaching to remote browser over CDP`);
    this.#browser = await CDPSession.connect(wsUrl);
    const { targetId } = await this.#browser.send("Target.createTarget", {
      url: "about:blank",
    });
    this.#targetId = targetId;

    // Derive the page endpoint from the browser endpoint when possible; fall
    // back to a flat session for hosts that expose only the browser socket.
    const pageWs = pageUrlFromBrowserWs(wsUrl, targetId);
    this.#page = pageWs ? await CDPSession.connect(pageWs) : this.#browser;

    for (const domain of ["Page", "Runtime", "Network", "DOM"]) {
      try {
        await this.#page.send(`${domain}.enable`);
      } catch (err) {
        log.debug(`enable ${domain} failed: ${err.message}`);
      }
    }
    return this;
  }

  async goto(url) {
    return this.page.navigate(url, { timeout: this.config.pageTimeout });
  }

  async type(text) {
    for (const ch of text) {
      await this.page.send("Input.dispatchKeyEvent", { type: "keyDown", text: ch });
      await this.page.send("Input.dispatchKeyEvent", { type: "keyUp" });
    }
  }

  async press(key) {
    const info =
      key === "Enter"
        ? { code: "Enter", windowsVirtualKeyCode: 13, text: "\r" }
        : { code: key, windowsVirtualKeyCode: 0 };
    await this.page.send("Input.dispatchKeyEvent", { type: "keyDown", key, ...info });
    await this.page.send("Input.dispatchKeyEvent", { type: "keyUp", key });
  }

  async clickAt(x, y) {
    await this.page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await this.page.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: "left",
      clickCount: 1,
    });
    await this.page.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y,
      button: "left",
      clickCount: 1,
    });
  }

  async stop() {
    try {
      await this.#browser?.send("Target.closeTarget", { targetId: this.#targetId });
    } catch {
      /* ignore */
    }
    try {
      this.#page?.close();
    } catch {
      /* ignore */
    }
    try {
      this.#browser?.close();
    } catch {
      /* ignore */
    }
  }
}

/** Turn a browser WebSocket URL into the page WebSocket URL for a target. */
function pageUrlFromBrowserWs(browserWs, targetId) {
  const match = browserWs.match(/^(wss?:\/\/[^/]+)\/devtools\/browser\/.+$/);
  if (!match) return null;
  return `${match[1]}/devtools/page/${targetId}`;
}
