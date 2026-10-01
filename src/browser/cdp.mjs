/**
 * Minimal, dependency-free Chrome DevTools Protocol client.
 *
 * Uses Node's native global `WebSocket` (Node >= 22), so there is no
 * `ws`/`puppeteer`/`playwright` dependency anywhere in this project.
 *
 * A session multiplexes many commands over one socket, correlates responses
 * by `id`, and lets callers subscribe to protocol events by method name.
 *
 * @module browser/cdp
 */

const DEFAULT_TIMEOUT = 30000;

export class CDPError extends Error {
  constructor(message) {
    super(message);
    this.name = "CDPError";
  }
}

export class CDPSession {
  #ws;
  #nextId = 1;
  #pending = new Map();
  #listeners = new Map();
  #closed = false;

  constructor(ws) {
    this.#ws = ws;
    ws.addEventListener("message", (ev) => this.#onMessage(ev));
    ws.addEventListener("close", () => this.#onClose());
    ws.addEventListener("error", () => this.#onClose());
  }

  /** Connect to a `ws://…/devtools/…` endpoint. */
  static async connect(wsUrl, { timeout = 15000 } = {}) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new CDPError("CDP connect timed out")), timeout);
      ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      ws.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new CDPError(`CDP connect failed: ${wsUrl}`));
      });
    });
    return new CDPSession(ws);
  }

  get closed() {
    return this.#closed;
  }

  #onMessage(ev) {
    let msg;
    try {
      msg = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data));
    } catch {
      return;
    }
    if (msg.id !== undefined) {
      const entry = this.#pending.get(msg.id);
      if (!entry) return;
      this.#pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.error) entry.reject(new CDPError(msg.error.message || "cdp error"));
      else entry.resolve(msg.result || {});
      return;
    }
    if (msg.method) {
      for (const cb of this.#listeners.get(msg.method) || []) {
        try {
          cb(msg.params || {});
        } catch {
          /* a listener must never break the read loop */
        }
      }
    }
  }

  #onClose() {
    this.#closed = true;
    for (const [, entry] of this.#pending) {
      clearTimeout(entry.timer);
      entry.reject(new CDPError("CDP connection closed"));
    }
    this.#pending.clear();
  }

  /** Subscribe to a protocol event. Returns an unsubscribe function. */
  on(method, callback) {
    if (!this.#listeners.has(method)) this.#listeners.set(method, []);
    this.#listeners.get(method).push(callback);
    return () => {
      const list = this.#listeners.get(method) || [];
      const i = list.indexOf(callback);
      if (i !== -1) list.splice(i, 1);
    };
  }

  /** Send a command and await its result. */
  send(method, params = {}, timeout = DEFAULT_TIMEOUT) {
    if (this.#closed) return Promise.reject(new CDPError("CDP connection closed"));
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new CDPError(`CDP command timed out: ${method}`));
      }, timeout);
      this.#pending.set(id, { resolve, reject, timer });
      try {
        this.#ws.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        clearTimeout(timer);
        this.#pending.delete(id);
        reject(new CDPError(`CDP send failed: ${err.message}`));
      }
    });
  }

  /**
   * Evaluate JavaScript in the page and return the value.
   * Errors thrown in the page are re-thrown as `CDPError`.
   */
  async evaluate(expression, { awaitPromise = false, timeout = DEFAULT_TIMEOUT } = {}) {
    const res = await this.send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise, userGesture: true },
      timeout,
    );
    if (res.exceptionDetails) {
      const ex = res.exceptionDetails;
      const text =
        ex.exception?.description || ex.exception?.value || ex.text || "javascript error";
      throw new CDPError(text);
    }
    return res.result?.value;
  }

  /** Wait until `expression` evaluates truthy (polled), or throw on timeout. */
  async waitFor(expression, { timeout = DEFAULT_TIMEOUT, interval = 250, label = "" } = {}) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try {
        if (await this.evaluate(expression)) return true;
      } catch {
        /* page may be mid-navigation */
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    throw new CDPError(`waitFor timed out${label ? `: ${label}` : ""}`);
  }

  /** Page.navigate that resolves once the load event fires (or timeout). */
  async navigate(url, { timeout = DEFAULT_TIMEOUT } = {}) {
    const loaded = new Promise((resolve) => {
      const off = this.on("Page.loadEventFired", () => {
        off();
        resolve(true);
      });
      setTimeout(() => {
        off();
        resolve(false);
      }, timeout);
    });
    const result = await this.send("Page.navigate", { url }, timeout);
    await loaded;
    if (result.errorText) throw new CDPError(`navigation failed: ${result.errorText}`);
    return result;
  }

  close() {
    try {
      this.#ws.close();
    } catch {
      /* already closed */
    }
    this.#closed = true;
  }
}
