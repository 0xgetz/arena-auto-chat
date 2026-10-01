/**
 * DOM selectors and in-page scripts for arena.ai.
 *
 * All knowledge of the page structure lives here, so a UI change on arena.ai
 * is normally a one-file fix. Scripts return JSON-serialisable values and
 * never throw: failures are reported in the payload.
 *
 * Selectors verified against the live arena.ai client (2026).
 *
 * @module arena/dom
 */

/** JSON-quote a string for safe interpolation into a JS expression. */
export const q = (value) => JSON.stringify(value);

/** True when the chat input (a textarea) is present on the arena.ai chat page. */
export const FIND_INPUT = `!!document.querySelector('textarea')`;

/**
 * Fill the chat textarea through the native value setter so React's synthetic
 * event system notices the change, then fire input/change events.
 */
export function fillInput(text) {
  return `(() => {
    const el = document.querySelector('textarea');
    if (!el) return { ok: false, err: 'no-input' };
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(el, ${q(text)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, value: el.value };
  })()`;
}

/** Click the send button (identified by its accessible name). */
export const CLICK_SEND = `(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => (b.getAttribute('aria-label') || '') === 'Send message');
  if (!btn) return 'missing';
  if (btn.disabled) return 'disabled';
  btn.click();
  return 'clicked';
})()`;

/** Open the login/create-account modal from the sidebar. */
export const CLICK_LOGIN = `(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => (b.innerText || '').trim() === 'Log In');
  if (!btn) return false;
  btn.click();
  return true;
})()`;

/** True when the sidebar footer shows a signed-in account. */
export const ACCOUNT_CHIP = `(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => /@/.test(b.innerText || ''));
  return btn ? (btn.innerText || '').trim() : null;
})()`;

/** Open the account menu in the sidebar footer. */
export const OPEN_ACCOUNT_MENU = `(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => /@/.test(b.innerText || ''));
  if (!btn) return false;
  btn.click();
  return true;
})()`;

/** Click Sign Out in the account menu. */
export const SIGN_OUT = `(() => {
  const btn = [...document.querySelectorAll('button,[role="menuitem"]')]
    .find(b => (b.innerText || '').trim() === 'Sign Out');
  if (!btn) return false;
  btn.click();
  return true;
})()`;

/** Expand the collapsed sidebar so its controls are clickable. */
export const EXPAND_SIDEBAR = `(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => (b.getAttribute('aria-label') || '') === 'Expand sidebar');
  if (btn) btn.click();
  return !!btn;
})()`;

/** True once the login modal with the email field is on screen. */
export const LOGIN_MODAL_READY = `(() => {
  const text = document.body ? document.body.innerText : '';
  return text.includes('Log In or Create Account') &&
         !!document.querySelector('input[type="email"], input[placeholder*="email" i]');
})()`;

/**
 * Type an email into the modal. Does not submit; call `CLICK_CONTINUE_EMAIL`
 * once the field is filled so React has time to enable the button.
 */
export function fillEmail(email) {
  return `(() => {
    const input = document.querySelector('input[type="email"]')
      || document.querySelector('input[placeholder*="email" i]');
    if (!input) return { ok: false, err: 'no-email-input' };
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${q(email)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, value: input.value };
  })()`;
}

/** Click "Continue with email" if it exists and is enabled. */
export const CLICK_CONTINUE_EMAIL = `(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => (b.innerText || '').trim().toLowerCase() === 'continue with email');
  if (!btn) return 'missing';
  if (btn.disabled) return 'disabled';
  btn.click();
  return 'clicked';
})()`;

/** Type an email into the modal and continue (single-shot convenience). */
export function submitEmail(email) {
  return `(() => {
    const input = document.querySelector('input[type="email"]')
      || document.querySelector('input[placeholder*="email" i]');
    if (!input) return { ok: false, err: 'no-email-input' };
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${q(email)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const btn = [...document.querySelectorAll('button')]
      .find(b => (b.innerText || '').trim().toLowerCase() === 'continue with email');
    if (!btn) return { ok: false, err: 'no-continue-button' };
    btn.click();
    return { ok: true };
  })()`;
}

/** True once the "Create Account" step is showing. */
export const CREATE_STEP_READY = `(() => {
  const text = document.body ? document.body.innerText : '';
  return text.includes('Create Account') &&
         [...document.querySelectorAll('button')].some(b => (b.innerText || '').trim() === 'Create Account');
})()`;

/** Submit the Create Account step. */
export const CLICK_CREATE = `(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => (b.innerText || '').trim() === 'Create Account');
  if (!btn) return false;
  btn.click();
  return true;
})()`;

/** True once arena.ai asks the user to check their email. */
export const VERIFY_STEP_READY = `(() => {
  const text = document.body ? document.body.innerText : '';
  return text.includes('Verify your email address') ||
         text.includes('Check your email for the magic link');
})()`;

/**
 * Any user-facing error shown inside the auth modal (rate limits, blocked
 * signups, invalid addresses). Empty string when there is none.
 */
export const MODAL_ERROR = `(() => {
  const text = document.body ? document.body.innerText : '';
  const start = text.indexOf('Log In or Create Account');
  const scope = start >= 0 ? text.slice(start) : text;
  const m = scope.match(/(too many|rate limit|try again|not available|blocked|invalid|error|failed)[^\\n]{0,120}/i);
  return m ? m[0].trim() : '';
})()`;

/** True once the set-password screen is showing (magic link already followed). */
export const SET_PASSWORD_READY = `(() => {
  const text = document.body ? document.body.innerText : '';
  return text.includes('Create password') && document.querySelectorAll('input[type="password"]').length >= 2;
})()`;

/** Fill both password fields and click Finish. */
export function setPassword(password) {
  return `(() => {
    const inputs = [...document.querySelectorAll('input[type="password"]')];
    if (inputs.length < 2) return { ok: false, err: 'password-inputs-missing' };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (const el of inputs) {
      el.focus();
      setter.call(el, ${q(password)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const btn = [...document.querySelectorAll('button')]
      .find(b => (b.innerText || '').trim() === 'Finish');
    if (!btn) return { ok: false, err: 'no-finish-button' };
    btn.click();
    return { ok: true };
  })()`;
}

/**
 * True when arena.ai is showing its anti-bot "Security Verification" gate.
 * Hosted browsers solve this automatically; a local browser needs a human.
 */
export const SECURITY_CHECK = `(() => {
  const text = document.body ? document.body.innerText : '';
  return /Security Verification/i.test(text) ||
         !!document.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"]');
})()`;

/** True once the terms-of-use modal is blocking the chat. */
export const TERMS_MODAL = `(() => {
  const text = document.body ? document.body.innerText : '';
  return text.includes('Terms of Use & Privacy Policy') &&
         [...document.querySelectorAll('button')].some(b => (b.innerText || '').trim() === 'Agree');
})()`;

/** Accept the terms modal if present. */
export const ACCEPT_TERMS = `(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => (b.innerText || '').trim() === 'Agree');
  if (!btn) return false;
  btn.click();
  return true;
})()`;

/**
 * Read the state of the conversation: how many assistant blocks exist, the
 * text of the last one, and whether generation is still in progress.
 *
 * arena.ai renders the user's message and the model's answer in the main
 * column; the "Thought for …" line marks the start of an assistant block.
 */
export const CHAT_STATE = `(() => {
  const main = document.querySelector('main') || document.body;
  const text = main ? main.innerText : '';

  // The send button flips to a stop control while the model is streaming.
  const generating = !!document.querySelector('button[aria-label="Stop"]')
    || !!document.querySelector('button[aria-label*="Stop" i]')
    || /\\bGenerating\\.\\.\\./.test(text);

  // Each assistant turn starts with a "Thought for …" reasoning summary.
  const thoughtMatches = [...text.matchAll(/Thought for [^\\n]*/g)];
  const agentCount = thoughtMatches.length;

  // Assistant output is rendered as a sequence of <p> blocks:
  //   <p class="leading-[normal]">Thought for N seconds</p>   (marker)
  //   <p class="">…reasoning…</p>
  //   <p class="">…the visible answer…</p>                    (what we want)
  //   <p class="">…echo of the user's message…</p>
  // The answer is therefore the first unstyled <p> after the reasoning block.
  const paras = [...main.querySelectorAll('p')];
  let markerAt = -1;
  for (let i = 0; i < paras.length; i++) {
    if (/^Thought for /.test((paras[i].innerText || "").trim())) markerAt = i;
  }

  // Unstyled <p> blocks are the conversation body: reasoning, answer, then the
  // echo of the user's message. Everything before the last marker is history.
  const CHROME = /^(Inputs are processed|Ask followup|Direct|Battle Mode|Agent Mode|Side by Side|DirectChat|Auto|New Chat|Leaderboard|Search|Get More Done|Start evaluating|Try it now|Hide this|Terms of Use|Privacy Policy|Cookies|Get started)$/i;
  const plain = [];
  for (let i = markerAt + 1; i < paras.length; i++) {
    const cls = (paras[i].className || "").toString().trim();
    const t = (paras[i].innerText || "").trim();
    if (!t) continue;
    if (cls === "") plain.push(t);
    else if (plain.length) break; // UI chrome after the answer
  }

  // plain[0] is the reasoning paragraph, plain[1] the answer, plain[2] the
  // echo of the user's message. Without a reasoning marker, the first block is
  // the answer itself.
  // An upstream failure is rendered inline instead of an answer.
  const error = /Something went wrong/i.test(text)
    ? "arena.ai reported a generation error (try again or pick another model)"
    : "";

  let lastText = "";
  if (plain.length > 1) lastText = plain[1];
  else if (plain.length === 1) lastText = plain[0];
  else if (markerAt === -1) {
    // No reasoning marker: the answer is the last conversation <p> that is not
    // chrome. The first such block is the echo of the user's message.
    const body = paras
      .map((p) => ({ cls: (p.className || "").toString().trim(), t: (p.innerText || "").trim() }))
      .filter((x) => x.t && x.cls === "" && !CHROME.test(x.t));
    // body[0] = user echo, body[1..] = assistant answer.
    lastText = body.length > 1 ? body[body.length - 1] : "";
  }

  return { agentCount, lastText, generating, error, hasInput: !!document.querySelector('textarea'), tail: text.slice(-600) };
})()`;

/** The signed-in account's email as shown in the sidebar footer. */
export const SIDEBAR_EMAIL = `(() => {
  const text = document.body ? document.body.innerText : '';
  const m = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}/);
  return m ? m[0] : null;
})()`;

/** True when the sidebar shows a logged-in user (an email address). */
export const LOGGED_IN = `(() => {
  const text = document.body ? document.body.innerText : '';
  return /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}/.test(text) &&
         !text.includes('Log In or Create Account');
})()`;
