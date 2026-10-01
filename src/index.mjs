#!/usr/bin/env node
/**
 * arena-auto-chat — CLI entry point.
 *
 * Commands:
 *   create   provision one arena.ai account end-to-end
 *   chat     open a direct chat with a model and send a message (needs a login)
 *   run      create an account, then send a test message to a model
 *
 * @module index
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { BrowserManager } from "./browser/manager.mjs";
import { RemoteBrowser } from "./browser/remote.mjs";
import { loadConfig } from "./config.mjs";
import { provisionOne } from "./core/provision.mjs";
import * as arena from "./arena/client.mjs";
import { log, color } from "./utils/logger.mjs";

const VERSION = "1.0.0";

/* ---------------------------------- args --------------------------------- */

function parseArgs(argv) {
  const a = {
    command: "run",
    count: 1,
    domain: "",
    model: undefined,
    prompt: undefined,
    out: "",
    cdp: undefined,
    headful: false,
    quiet: false,
    help: false,
    version: false,
    timeout: undefined,
  };
  const need = (i, name) => {
    if (i + 1 >= argv.length) throw new Error(`${name} requires a value`);
    return argv[i + 1];
  };

  const first = argv[2];
  if (first && !first.startsWith("-")) a.command = first;

  for (let i = first && !first.startsWith("-") ? 3 : 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === "-n" || k === "--count") a.count = parseInt(need(i, k), 10), i++;
    else if (k === "-d" || k === "--domain") a.domain = need(i, k), i++;
    else if (k === "-m" || k === "--model") a.model = need(i, k), i++;
    else if (k === "-p" || k === "--prompt") a.prompt = need(i, k), i++;
    else if (k === "-o" || k === "--out") a.out = need(i, k), i++;
    else if (k === "--cdp") a.cdp = need(i, k), i++;
    else if (k === "-t" || k === "--timeout") a.timeout = parseInt(need(i, k), 10), i++;
    else if (k === "--headful") a.headful = true;
    else if (k === "-q" || k === "--quiet") a.quiet = true;
    else if (k === "-h" || k === "--help") a.help = true;
    else if (k === "-v" || k === "--version") a.version = true;
    else throw new Error(`unknown option: ${k}`);
  }
  if (a.count < 1) a.count = 1;
  if (!["create", "chat", "run"].includes(a.command)) {
    throw new Error(`unknown command: ${a.command} (expected create | chat | run)`);
  }
  return a;
}

function help() {
  console.log(`
  ${color.bold("arena-auto-chat")} v${VERSION}

  ${color.dim("arena.ai account creator + direct chat automation, end-to-end.")}

  Usage:
    node src/index.mjs <command> [options]

  Commands:
    run      ${color.dim("create an account, then send a message to a model (default)")}
    create   ${color.dim("provision one arena.ai account and stop")}
    chat     ${color.dim("send a message to a model on the existing login")}

  Options:
    -n, --count N       number of accounts to create         (default 1)
    -d, --domain D      zenvex receiving domain              (default random)
    -m, --model M       model slug for chat                  (default deepseek-v4.1-flash-max)
    -p, --prompt TEXT   message to send                      (default "test")
    -o, --out FILE      account JSON output                  (default outputs/arena-accounts-<ts>.json)
        --cdp URL       attach to a running browser          (ws:// or http:// DevTools URL)
    -t, --timeout MS    verification email timeout           (default 180000)
        --headful       show the browser (debugging)
    -q, --quiet         print only the final summary
    -h, --help          show this help
    -v, --version       print the version

  Examples:
    node src/index.mjs run
    node src/index.mjs run -m deepseek-v4.1-flash-max -p "hello"
    node src/index.mjs create -n 3 -o outputs/batch.json
    node src/index.mjs chat -m gpt-4o -p "write a haiku"
    node src/index.mjs run --cdp http://127.0.0.1:9222
`);
}

/* ---------------------------------- main --------------------------------- */

async function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (e) {
    log.error(e.message);
    process.exit(2);
  }
  if (args.version) {
    console.log(VERSION);
    return;
  }
  if (args.help) {
    help();
    return;
  }

  const config = loadConfig({
    HEADLESS: args.headful ? false : undefined,
    EMAIL_TIMEOUT: args.timeout,
    ZENVEX_DOMAIN: args.domain || undefined,
    ARENA_MODEL: args.model,
    ARENA_PROMPT: args.prompt,
    CDP_URL: args.cdp,
  });
  const model = args.model || config.model;
  const prompt = args.prompt || config.prompt;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = resolve(config.outDir);
  mkdirSync(outDir, { recursive: true });
  const outFile = args.out || resolve(outDir, `arena-accounts-${stamp}.json`);

  log.raw(`${color.cyan("arena-auto-chat")} ${color.dim(`v${VERSION}`)}`);
  log.info(`command=${args.command}  headless=${config.headless}  out=${outFile}`);

  const browser = config.cdp
    ? new RemoteBrowser(config, config.cdp)
    : new BrowserManager(config);
  const results = [];
  let chatResult = null;

  try {
    await browser.start();

    if (args.command === "chat") {
      chatResult = await arena.sendChat(browser, model, prompt, config);
    } else {
      for (let i = 0; i < args.count; i++) {
        if (!args.quiet && args.count > 1) {
          log.raw(color.dim(`\n── account ${i + 1}/${args.count} ──`));
        }
        const record = await provisionOne(browser, config, { domain: args.domain });
        results.push(record);
        writeFileSync(outFile, JSON.stringify(results, null, 2));

        if (args.command === "run" && record.ok) {
          chatResult = await arena.sendChat(browser, model, prompt, config);
        }
      }
    }
  } finally {
    await browser.stop();
  }

  log.raw("");
  const ok = results.filter((r) => r?.ok).length;

  if (results.length) {
    log.info(`accounts: ${ok}/${results.length} succeeded -> ${outFile}`);
    for (const r of results) {
      if (r.ok) {
        log.raw(`  ${color.green("✔")} ${r.email}  ${color.dim("pass=" + r.password)}`);
      } else {
        log.raw(`  ${color.red("✘")} ${r.email || "?"}  ${color.dim(r.error)}`);
      }
    }
  }

  if (chatResult) {
    log.raw("");
    log.info(`model ${model} replied:`);
    log.raw(color.dim("  ┌" + "─".repeat(66)));
    for (const line of String(chatResult.reply).split("\n")) log.raw(`  │ ${line}`);
    log.raw(color.dim("  └" + "─".repeat(66)));
    log.raw(color.dim(`  ${chatResult.url}`));
  }

  const failedAccounts = results.length > 0 && ok !== results.length;
  process.exit(failedAccounts ? 1 : 0);
}

main().catch((e) => {
  log.error(e.stack || e.message);
  process.exit(1);
});
