/**
 * Minimal structured logger with levels and optional ANSI colour.
 * Zero dependencies.
 *
 * @module utils/logger
 */

const C = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (c, s) => (useColor ? `${c}${s}${C.reset}` : s);

/** ISO timestamp without the milliseconds noise. */
function ts() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function emit(color, tag, msg) {
  process.stdout.write(`${paint(C.gray, ts())} ${paint(color, tag.padEnd(5))} ${msg}\n`);
}

export const log = {
  info: (m) => emit(C.cyan, "INFO", m),
  step: (m) => emit(C.blue, "STEP", m),
  ok: (m) => emit(C.green, "OK", m),
  warn: (m) => emit(C.yellow, "WARN", m),
  error: (m) => emit(C.red, "ERR", m),
  debug: (m) => (process.env.DEBUG ? emit(C.magenta, "DBG", m) : undefined),
  raw: (m = "") => process.stdout.write(`${m}\n`),
};

export const color = {
  dim: (s) => paint(C.gray, s),
  bold: (s) => paint(C.bold, s),
  green: (s) => paint(C.green, s),
  cyan: (s) => paint(C.cyan, s),
  yellow: (s) => paint(C.yellow, s),
  red: (s) => paint(C.red, s),
  blue: (s) => paint(C.blue, s),
  magenta: (s) => paint(C.magenta, s),
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
