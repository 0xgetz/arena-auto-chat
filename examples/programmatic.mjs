#!/usr/bin/env node
/**
 * Using the modules as a library instead of the CLI.
 *
 * Run with a browser already listening on port 9222:
 *   node examples/programmatic.mjs
 *
 * @module examples/programmatic
 */

import { BrowserManager } from "../src/browser/manager.mjs";
import { loadConfig } from "../src/config.mjs";
import { provisionOne } from "../src/core/provision.mjs";
import * as arena from "../src/arena/client.mjs";
import { log } from "../src/utils/logger.mjs";

const config = loadConfig({ ARENA_MODEL: "deepseek-v4.1-flash-max", ARENA_PROMPT: "test" });

const browser = new BrowserManager(config);
await browser.start();

try {
  // 1. Create one account end to end.
  const account = await provisionOne(browser, config);
  if (!account.ok) throw new Error(`provisioning failed: ${account.error}`);
  log.ok(`created ${account.email}`);

  // 2. Use the freshly created session to talk to a model.
  const chat = await arena.sendChat(browser, config.model, "Reply with exactly: pong", config);
  log.info(`model replied: ${chat.reply}`);

  // 3. Ask a follow-up on the same page.
  const again = await arena.sendChat(browser, config.model, "And now say: done", config);
  log.info(`second reply: ${again.reply}`);
} finally {
  await browser.stop();
}
