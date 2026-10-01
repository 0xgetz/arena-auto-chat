/**
 * Configuration resolution.
 *
 * Precedence: CLI flags > environment variables > .env file > built-in defaults.
 * The .env parser is tiny and dependency-free (KEY=VALUE lines, `#` comments).
 *
 * @module config
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** Parse a .env file into a plain object. Missing file = empty object. */
export function loadDotEnv(path = ".env") {
  const out = {};
  const abs = resolve(path);
  if (!existsSync(abs)) return out;
  for (const rawLine of readFileSync(abs, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function asBool(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(String(value).toLowerCase());
}

function asInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Build the effective settings object.
 *
 * @param {object} [flags] parsed CLI flags (may be empty)
 * @returns {object}
 */
export function loadConfig(flags = {}) {
  const env = { ...loadDotEnv(), ...process.env };
  const get = (key) => (flags[key] !== undefined && flags[key] !== null ? flags[key] : env[key]);

  return {
    chromePath: get("CHROME_PATH") || "",
    headless: asBool(get("HEADLESS"), true),
    cdpPort: asInt(get("CDP_PORT"), 9222),
    browserProxy: get("BROWSER_PROXY") || "",
    profileDir: get("PROFILE_DIR") || "",
    cdp: get("CDP_URL") || "",

    emailTimeout: asInt(get("EMAIL_TIMEOUT"), 180000),
    replyTimeout: asInt(get("REPLY_TIMEOUT"), 180000),
    pageTimeout: asInt(get("PAGE_TIMEOUT"), 60000),

    zenvexDomain: get("ZENVEX_DOMAIN") || "",

    model: get("ARENA_MODEL") || "deepseek-v4.1-flash-max",
    prompt: get("ARENA_PROMPT") || "test",

    outDir: get("OUT_DIR") || "outputs",
  };
}
