#!/usr/bin/env node
/**
 * End-to-end smoke test.
 *
 * Exercises the real pipeline against live services:
 *   1. launch/attach to a browser
 *   2. generate a zenvex.dev disposable address
 *   3. provision one arena.ai account (signup → magic link → password)
 *   4. send a message to a model in direct chat and read the reply
 *
 * Usage:
 *   node src/test_e2e.mjs [--cdp URL] [--headful] [--keep]
 *
 * Exit code 0 only when every stage passes. `--keep` leaves the account in
 * outputs/ for inspection; otherwise nothing is deleted either, since the
 * account record is the useful artifact.
 *
 * @module test_e2e
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { BrowserManager } from "./browser/manager.mjs";
import { RemoteBrowser } from "./browser/remote.mjs";
import { loadConfig } from "./config.mjs";
import { provisionOne } from "./core/provision.mjs";
import * as arena from "./arena/client.mjs";
import { createAddress, openInbox } from "./inbox/zenvex.mjs";
import { randomPassword, randomEmailLocal } from "./utils/random.mjs";
import { log, color } from "./utils/logger.mjs";

function parseArgs(argv) {
  const a = { cdp: process.env.CDP_URL || "", headful: false, model: "", prompt: "test" };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--cdp") a.cdp = argv[++i];
    else if (k === "--headful") a.headful = true;
    else if (k === "-m" || k === "--model") a.model = argv[++i];
    else if (k === "-p" || k === "--prompt") a.prompt = argv[++i];
  }
  return a;
}

const stages = [];
function record(name, ok, detail = "") {
  stages.push({ name, ok, detail });
  (ok ? log.ok : log.error)(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const args = parseArgs(process.argv);
  const config = loadConfig({
    CDP_URL: args.cdp || undefined,
    HEADLESS: args.headful ? false : undefined,
    ARENA_MODEL: args.model || undefined,
    ARENA_PROMPT: args.prompt || undefined,
  });
  const model = args.model || config.model;
  const prompt = args.prompt || config.prompt;

  log.raw(`${color.cyan("arena-auto-chat")} ${color.dim("end-to-end test")}`);
  log.info(`model=${model}  prompt=${JSON.stringify(prompt)}  cdp=${config.cdp || "(launch)"}`);

  const browser = config.cdp
    ? new RemoteBrowser(config, config.cdp)
    : new BrowserManager(config);

  let account = null;
  let reply = null;

  try {
    await browser.start();
    record("browser attach", true, config.cdp ? "remote CDP" : "local launch");

    const addr = await createAddress(browser, config.zenvexDomain || "");
    record("zenvex address", !!addr.email, addr.email);

    await openInbox(browser, addr.local);
    record("zenvex inbox opens", true);

    account = await provisionOne(browser, config, { domain: config.zenvexDomain });
    record("arena.ai account", account.ok, account.ok ? account.email : account.error);

    if (account.ok) {
      try {
        reply = await arena.sendChat(browser, model, prompt, config);
        record("direct chat reply", !!reply.reply, `${reply.reply.slice(0, 60)}…`);
      } catch (err) {
        record("direct chat reply", false, err.message);
      }
    }
  } catch (err) {
    record("fatal", false, err.message);
  } finally {
    await browser.stop();
  }

  const outDir = resolve(config.outDir);
  mkdirSync(outDir, { recursive: true });
  const report = {
    ran_at: new Date().toISOString(),
    model,
    prompt,
    account,
    chat: reply,
    stages,
    passed: stages.every((s) => s.ok),
  };
  const reportPath = resolve(outDir, `e2e-report-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  log.raw("");
  const ok = stages.filter((s) => s.ok).length;
  log.info(`stages passed: ${ok}/${stages.length}`);
  log.info(`report: ${reportPath}`);
  process.exit(report.passed ? 0 : 1);
}

main().catch((e) => {
  log.error(e.stack || e.message);
  process.exit(1);
});
