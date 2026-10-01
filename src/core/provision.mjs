/**
 * Core provisioning flow: one arena.ai account, end to end.
 *
 *   1. generate a fresh zenvex.dev disposable address
 *   2. submit it to arena.ai's sign-up modal
 *   3. open the inbox, read the magic link, follow it
 *   4. set a strong password and confirm the session
 *
 * @module core/provision
 */

import * as arena from "../arena/client.mjs";
import { createAddress } from "../inbox/zenvex.mjs";
import { randomPassword, randomName } from "../utils/random.mjs";
import { log } from "../utils/logger.mjs";

/**
 * @typedef {Object} ProvisionOptions
 * @property {string} [domain]  zenvex receiving domain
 * @property {string} [config]  unused placeholder
 */

/**
 * Provision a single arena.ai account end-to-end.
 *
 * @param {import('../browser/manager.mjs').BrowserManager} browser
 * @param {object} config resolved settings
 * @param {{domain?:string}} [opts]
 * @returns {Promise<object>} an `ok:true` result record, or `ok:false` on failure
 */
export async function provisionOne(browser, config, opts = {}) {
  const started = Date.now();
  let email = "";
  const password = randomPassword();
  const fullName = randomName();

  try {
    const addr = await createAddress(browser, opts.domain || config.zenvexDomain || "");
    email = addr.email;
    log.step(`provisioning ${email} (name: ${fullName})`);

    // A reused browser profile may still hold a previous arena.ai session.
    await arena.signOutIfLoggedIn(browser, config);

    await arena.submitEmail(browser, email, config);
    await arena.completeVerification(browser, addr.local, password, config);

    return {
      ok: true,
      provider: "arena.ai",
      email,
      password,
      full_name: fullName,
      email_provider: `zenvex.dev (${addr.domain})`,
      login_url: "https://arena.ai/",
      elapsed_ms: Date.now() - started,
      created_at: new Date().toISOString(),
    };
  } catch (err) {
    log.error(`${email || "account"} failed: ${err.message}`);
    return {
      ok: false,
      provider: "arena.ai",
      email: email || null,
      error: err.message,
      elapsed_ms: Date.now() - started,
      created_at: new Date().toISOString(),
    };
  }
}
