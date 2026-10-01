/**
 * arena.ai account + chat automation.
 *
 * Everything here drives the real arena.ai web client through the shared
 * browser session:
 *
 *   1. open the site and the login/create-account modal
 *   2. submit an email address (obtained from the zenvex inbox module)
 *   3. follow the magic verification link and set a password
 *   4. confirm the session is live
 *   5. open a direct chat with a chosen model and exchange messages
 *
 * @module arena/client
 */

import * as dom from "./dom.mjs";
import { findLink, waitForMessage } from "../inbox/zenvex.mjs";
import { log, sleep } from "../utils/logger.mjs";

export const ARENA = "https://arena.ai";

/** Build the direct-chat URL for one model. */
export function directChatUrl(model) {
  return `${ARENA}/text/direct?model_a=${encodeURIComponent(model)}`;
}

/** Wait for the arena.ai home page to be interactive. */
async function waitForHome(browser, timeout) {
  await browser.page.waitFor(
    `document.readyState === 'complete' && !!document.querySelector('textarea')`,
    { timeout, label: "arena home" },
  );
}

/** Expand the sidebar if it is collapsed. */
async function expandSidebar(browser) {
  await browser.page.evaluate(dom.EXPAND_SIDEBAR);
  await sleep(700);
}

/**
 * If the browser profile is already signed in to an arena.ai account, sign out
 * so the caller can start from a clean, logged-out state.
 *
 * @returns {Promise<string|null>} the email that was signed out, if any
 */
export async function signOutIfLoggedIn(browser, config) {
  await browser.goto(`${ARENA}/`);
  await waitForHome(browser, config.pageTimeout);
  await sleep(1200);
  await expandSidebar(browser);

  const account = await browser.page.evaluate(dom.ACCOUNT_CHIP);
  if (!account) return null;

  log.info(`existing session found (${account}); signing out`);
  await browser.page.evaluate(dom.OPEN_ACCOUNT_MENU);
  await sleep(800);
  const clicked = await browser.page.evaluate(dom.SIGN_OUT);
  if (!clicked) throw new Error("found an existing session but could not sign out");
  await browser.page.waitFor(`!document.body.innerText.includes(${JSON.stringify(account)})`, {
    timeout: 30000,
    label: "signed out",
  });
  await sleep(1500);
  return account;
}

/**
 * Open the login modal and submit `email`.
 *
 * @param {import('../browser/manager.mjs').BrowserManager} browser
 * @param {string} email
 * @param {object} config
 */
export async function submitEmail(browser, email, config) {
  log.step("opening arena.ai sign-up");
  await browser.goto(`${ARENA}/`);
  await waitForHome(browser, config.pageTimeout);
  await sleep(1000);

  // The sidebar is collapsed by default; open it so "Log In" is reachable.
  await expandSidebar(browser);

  const opened = await browser.page.evaluate(dom.CLICK_LOGIN);
  if (!opened) throw new Error("could not find the Log In button on arena.ai");

  await browser.page.waitFor(dom.LOGIN_MODAL_READY, {
    timeout: 20000,
    label: "login modal",
  });

  const filled = await browser.page.evaluate(dom.fillEmail(email));
  if (!filled?.ok) throw new Error(`failed to fill the email field: ${filled?.err}`);

  // Wait for React to enable the button, then submit. Retry a few times: the
  // button can still be disabled for a beat after the field is populated.
  const advanced = `(${dom.CREATE_STEP_READY}) || (${dom.VERIFY_STEP_READY})`;
  let submitted = false;
  for (let attempt = 0; attempt < 5 && !submitted; attempt++) {
    await sleep(600);
    const clicked = await browser.page.evaluate(dom.CLICK_CONTINUE_EMAIL);
    log.debug(`continue-with-email: ${clicked}`);
    if (clicked === "clicked") submitted = true;
    else await sleep(500);
  }
  if (!submitted) throw new Error("could not click Continue with email");
  log.info("email submitted to arena.ai");

  // arena.ai may show an explicit "Create Account" confirmation step, or skip
  // straight to the verification notice. Accept whichever appears first.
  // The modal silently stalls when the address is rate-limited, so poll for an
  // error message as well and report it instead of waiting out the timeout.
  const deadline = Date.now() + 25000;
  let ready = false;
  while (Date.now() < deadline) {
    if (await browser.page.evaluate(advanced)) {
      ready = true;
      break;
    }
    const err = await browser.page.evaluate(dom.MODAL_ERROR);
    if (err) throw new Error(`arena.ai rejected the sign-up: ${err}`);
    await sleep(700);
  }
  if (!ready) {
    throw new Error(
      "arena.ai did not advance past the email step (likely rate-limited from this IP; retry later or use --cdp with a different browser)",
    );
  }

  if (await browser.page.evaluate(dom.CREATE_STEP_READY)) {
    const created = await browser.page.evaluate(dom.CLICK_CREATE);
    if (!created) throw new Error("could not click Create Account");
  }

  await browser.page.waitFor(dom.VERIFY_STEP_READY, {
    timeout: 30000,
    label: "verify email step",
  });
  log.ok("arena.ai sent the verification email");
}

/**
 * Follow the magic link from the inbox, set a password, and confirm login.
 *
 * @param {import('../browser/manager.mjs').BrowserManager} browser
 * @param {string} localPart         zenvex inbox local part
 * @param {string} password          password to set
 * @param {object} config
 * @returns {Promise<{email:string|null}>}
 */
export async function completeVerification(browser, localPart, password, config) {
  log.step("waiting for the arena.ai verification email");
  const message = await waitForMessage(browser, /confirm your signup|verify your email/i, {
    timeout: config.emailTimeout,
    localPart,
  });

  const link =
    findLink(message.links, /arena\.ai\/.*(callback|verify|token)/i) ||
    findLink(message.links, /arena\.ai/i);
  if (!link) throw new Error("verification email contained no arena.ai link");
  log.ok(`verification link: ${link.slice(0, 80)}…`);

  log.step("following the verification link");
  await browser.goto(link);

  // The callback redirects to the set-password screen.
  await browser.page.waitFor(dom.SET_PASSWORD_READY, {
    timeout: 40000,
    label: "set password screen",
  });
  log.info("set-password screen reached");

  const res = await browser.page.evaluate(dom.setPassword(password));
  if (!res?.ok) throw new Error(`failed to set password: ${res?.err}`);

  // Finish redirects back to the app, which should now show the account.
  await browser.page.waitFor(dom.LOGGED_IN, { timeout: 40000, label: "logged in" });
  const email = await browser.page.evaluate(dom.SIDEBAR_EMAIL);
  log.ok(`account is active${email ? `: ${email}` : ""}`);
  return { email };
}

/**
 * Open a direct chat with a model and send a message.
 *
 * @param {import('../browser/manager.mjs').BrowserManager} browser
 * @param {string} model
 * @param {string} message
 * @param {object} config
 * @returns {Promise<{reply:string, url:string}>}
 */
export async function sendChat(browser, model, message, config) {
  const url = directChatUrl(model);
  log.step(`opening direct chat with ${model}`);
  await browser.goto(url);
  await browser.page.waitFor(dom.FIND_INPUT, { timeout: config.pageTimeout, label: "chat input" });
  await sleep(1500);

  const filled = await browser.page.evaluate(dom.fillInput(message));
  if (!filled?.ok) throw new Error(`could not fill the chat input: ${filled?.err}`);
  log.info(`typed: ${message}`);

  const submit = async () => {
    let how = await browser.page.evaluate(dom.CLICK_SEND);
    if (how !== "clicked") {
      // Fall back to pressing Enter in the textarea.
      await browser.page.evaluate(`document.querySelector('textarea').focus()`);
      await browser.press("Enter");
      how = "enter";
    }
    return how;
  };

  log.info(`message sent (${await submit()})`);

  // A terms modal can appear the first time a message is sent, and it blocks
  // the submission. Dismiss it, then resend if the input still holds our text.
  await sleep(2500);
  if (await browser.page.evaluate(dom.TERMS_MODAL)) {
    log.info("accepting the terms-of-use modal");
    await browser.page.evaluate(dom.ACCEPT_TERMS);
    await sleep(2500);
    const stillThere = await browser.page.evaluate(
      `(() => { const t = document.querySelector('textarea'); return !!t && t.value.trim().length > 0; })()`,
    );
    if (stillThere) {
      log.info(`resending after the modal (${await submit()})`);
      await sleep(2500);
    }
  }

  await waitForSecurityCheck(browser, config);
  const reply = await waitForReply(browser, config.replyTimeout);
  const finalUrl = await browser.page.evaluate("location.href");
  return { reply, url: finalUrl };
}

/**
 * Wait out arena.ai's anti-bot "Security Verification" gate.
 *
 * Cloud browsers solve the challenge automatically, so we simply stop driving
 * and poll until it disappears. On a local browser with no solver this raises a
 * clear error after the deadline.
 *
 * @param {import('../browser/manager.mjs').BrowserManager} browser
 * @param {object} config
 * @param {number} [maxMs=120000]
 */
export async function waitForSecurityCheck(browser, config, maxMs = 120000) {
  const deadline = Date.now() + maxMs;
  let announced = false;
  while (Date.now() < deadline) {
    let blocked = false;
    try {
      blocked = await browser.page.evaluate(dom.SECURITY_CHECK);
    } catch {
      blocked = false;
    }
    if (!blocked) return true;
    if (!announced) {
      log.warn("arena.ai security verification detected; waiting for it to clear");
      announced = true;
    }
    await sleep(5000);
  }
  throw new Error(
    "arena.ai is showing a security verification that was not solved; " +
      "retry later, reduce the request rate, or complete it manually with --headful",
  );
}

/**
 * Poll the page until the assistant's answer stops changing and generation
 * has ended. Returns the answer text.
 *
 * @param {import('../browser/manager.mjs').BrowserManager} browser
 * @param {number} timeout
 */
export async function waitForReply(browser, timeout) {
  const deadline = Date.now() + timeout;
  let last = "";
  let stable = 0;
  let seenGenerating = false;

  while (Date.now() < deadline) {
    await sleep(700);
    const state = await browser.page.evaluate(dom.CHAT_STATE);

    if (state?.error) throw new Error(state.error);
    if (state?.generating) seenGenerating = true;

    // A security challenge can appear mid-generation; let it clear.
    if (await browser.page.evaluate(dom.SECURITY_CHECK)) {
      log.warn("security verification appeared during generation; waiting");
      await waitForSecurityCheck(browser, { }, 120000);
      continue;
    }

    const text = state?.lastText || "";
    // Ignore the echo of the user's own message: the answer is different text,
    // or text that survives after generation has started.
    if (!text) continue;
    if (text === last) {
      stable += 1;
      if (!state.generating && seenGenerating && stable >= 3) return text;
    } else {
      stable = 0;
      last = text;
    }
  }
  if (last) return last;
  throw new Error("timed out waiting for the assistant reply");
}

/** Open the sidebar and return the signed-in email, if any. */
export async function currentUser(browser) {
  await browser.goto(`${ARENA}/`);
  await waitForHome(browser, 30000);
  await sleep(1200);
  await browser.page.evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => (b.getAttribute('aria-label') || '') === 'Expand sidebar');
    if (btn) btn.click();
    return true;
  })()`);
  await sleep(600);
  return browser.page.evaluate(dom.SIDEBAR_EMAIL);
}
