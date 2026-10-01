/**
 * High-level browser manager.
 *
 * Owns one Chromium process, one browser-level CDP connection, and one page
 * session. Handles target discovery, page creation and clean shutdown, so the
 * rest of the code only deals with a `CDPSession` bound to a real page.
 *
 * @module browser/manager
 */

import { CDPSession } from "./cdp.mjs";
import { ChromiumProcess, findChromium } from "./chromium.mjs";
import { log, sleep } from "../utils/logger.mjs";

export class BrowserManager {
  #chromium;
  #browser;
  #page;
  #targetId;

  constructor(config) {
    this.config = config;
  }

  get page() {
    if (!this.#page || this.#page.closed) throw new Error("page session is not available");
    return this.#page;
  }

  /** Launch the browser and attach to a fresh page target. */
  async start() {
    const executable = await findChromium(this.config.chromePath);
    this.#chromium = new ChromiumProcess({
      executable,
      port: this.config.cdpPort,
      profileDir: this.config.profileDir,
      headless: this.config.headless,
      proxy: this.config.browserProxy,
    });
    const wsUrl = await this.#chromium.start();
    this.#browser = await CDPSession.connect(wsUrl);
    await this.#attachPage();
    return this;
  }

  /** Create a new tab, attach, and enable the domains we rely on. */
  async #attachPage() {
    const { targetId } = await this.#browser.send("Target.createTarget", {
      url: "about:blank",
    });
    this.#targetId = targetId;

    // The page-level WebSocket endpoint is the most reliable way to get a
    // session that owns Page/Runtime/Network without dealing with sessions.
    const pageWs = `ws://127.0.0.1:${this.#chromium.port}/devtools/page/${targetId}`;
    this.#page = await CDPSession.connect(pageWs);
    for (const domain of ["Page", "Runtime", "Network", "DOM"]) {
      await this.#page.send(`${domain}.enable`);
    }
    await this.#page.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }

  /** Navigate the active page and wait for the load event. */
  async goto(url) {
    log.debug(`goto ${url}`);
    return this.page.navigate(url, { timeout: this.config.pageTimeout });
  }

  /**
   * Set a cookie on the current page's origin.
   * @param {{name:string,value:string,domain?:string,path?:string,secure?:boolean,httpOnly?:boolean}} cookie
   */
  async setCookie(cookie) {
    return this.page.send("Network.setCookie", {
      path: "/",
      secure: true,
      ...cookie,
    });
  }

  /** Read all cookies visible to the page (including HttpOnly). */
  async getCookies() {
    const { cookies } = await this.page.send("Network.getAllCookies");
    return cookies || [];
  }

  /** Type text into whatever is focused, character events included. */
  async type(text) {
    for (const ch of text) {
      await this.page.send("Input.dispatchKeyEvent", { type: "keyDown", text: ch });
      await this.page.send("Input.dispatchKeyEvent", { type: "keyUp" });
    }
  }

  /** Press a named key such as "Enter" or "Tab". */
  async press(key) {
    const codes = {
      Enter: { code: "Enter", windowsVirtualKeyCode: 13, text: "\r" },
      Tab: { code: "Tab", windowsVirtualKeyCode: 9 },
      Escape: { code: "Escape", windowsVirtualKeyCode: 27 },
    };
    const info = codes[key] || { code: key, windowsVirtualKeyCode: 0 };
    await this.page.send("Input.dispatchKeyEvent", { type: "keyDown", key, ...info });
    await this.page.send("Input.dispatchKeyEvent", { type: "keyUp", key });
  }

  /** Move the mouse and click at viewport coordinates. */
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
    await sleep(120);
  }

  /** Screenshot as a base64 PNG string (useful for debugging). */
  async screenshot() {
    const { data } = await this.page.send("Page.captureScreenshot", { format: "png" });
    return data;
  }

  async stop() {
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
    await this.#chromium?.stop();
  }
}
