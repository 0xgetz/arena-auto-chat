/**
 * Chromium/Chrome process management.
 *
 * Launches a browser with a remote-debugging port and returns the DevTools
 * WebSocket URL. If a browser is already listening on the port it is reused.
 *
 * @module browser/chromium
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { access, constants } from "node:fs/promises";
import { log, sleep } from "../utils/logger.mjs";

const CANDIDATES = [
  "chromium",
  "chromium-browser",
  "google-chrome",
  "google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/snap/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
];

async function isExecutable(path) {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find a usable browser binary.
 * @param {string} [configured] explicit path (wins if valid)
 * @returns {Promise<string>}
 */
export async function findChromium(configured = "") {
  if (configured) {
    if (await isExecutable(configured)) return configured;
    throw new Error(`CHROME_PATH is not executable: ${configured}`);
  }
  for (const candidate of CANDIDATES) {
    if (candidate.startsWith("/") || candidate.includes(":\\")) {
      if (await isExecutable(candidate)) return candidate;
    } else {
      const found = await new Promise((resolve) => {
        const p = spawn("which", [candidate], { stdio: ["ignore", "pipe", "ignore"] });
        let out = "";
        p.stdout.on("data", (d) => (out += d));
        p.on("close", (code) => resolve(code === 0 ? out.trim() : null));
        p.on("error", () => resolve(null));
      });
      if (found) return found;
    }
  }
  throw new Error(
    "Chrome/Chromium not found. Install it or set CHROME_PATH to the executable.",
  );
}

export class ChromiumProcess {
  constructor({ executable, port = 9222, profileDir = "", headless = true, proxy = "" }) {
    this.executable = executable;
    this.port = port;
    this.headless = headless;
    this.proxy = proxy;
    this.proc = null;
    this.tempProfile = false;
    this.profileDir = profileDir;
  }

  get httpBase() {
    return `http://127.0.0.1:${this.port}`;
  }

  /** Ask the DevTools endpoint for its WebSocket URL. Null if not up yet. */
  async browserWsUrl() {
    try {
      const res = await fetch(`${this.httpBase}/json/version`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.webSocketDebuggerUrl || null;
    } catch {
      return null;
    }
  }

  /**
   * Start the browser (or attach to one already on the port).
   * @returns {Promise<string>} the browser-level WebSocket URL
   */
  async start() {
    if (await this.browserWsUrl()) {
      log.info(`attached to existing Chromium on port ${this.port}`);
      return this.browserWsUrl();
    }

    if (!this.profileDir) {
      this.profileDir = mkdtempSync(join(tmpdir(), "arena-cdp-"));
      this.tempProfile = true;
    }

    const args = [
      `--remote-debugging-port=${this.port}`,
      "--remote-allow-origins=*",
      `--user-data-dir=${this.profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-features=Translate,BackForwardCache",
      "--autoplay-policy=no-user-gesture-required",
      "--window-size=1440,2000",
      "about:blank",
    ];
    if (this.proxy) args.unshift(`--proxy-server=${this.proxy}`);
    if (this.headless) args.unshift("--headless=new", "--disable-gpu");
    if (process.getuid && process.getuid() === 0) args.unshift("--no-sandbox");

    log.info(`launching ${this.executable}${this.headless ? " (headless)" : ""}`);
    this.proc = spawn(this.executable, args, { stdio: "ignore", detached: false });
    this.proc.on("error", (err) => log.error(`chromium: ${err.message}`));

    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const url = await this.browserWsUrl();
      if (url) return url;
      if (this.proc.exitCode !== null) break;
      await sleep(300);
    }
    throw new Error("Chromium did not expose a DevTools endpoint");
  }

  /** Terminate the browser and clean up a throwaway profile. */
  async stop() {
    if (this.proc && this.proc.exitCode === null) {
      this.proc.kill("SIGTERM");
      const deadline = Date.now() + 8000;
      while (this.proc.exitCode === null && Date.now() < deadline) await sleep(150);
      if (this.proc.exitCode === null) this.proc.kill("SIGKILL");
    }
    this.proc = null;
    if (this.tempProfile && this.profileDir && existsSync(this.profileDir)) {
      try {
        rmSync(this.profileDir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    }
  }
}
