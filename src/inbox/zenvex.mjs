/**
 * zenvex.dev temporary-inbox reader.
 *
 * zenvex.dev is a disposable inbox provider. This module drives its UI through
 * the shared browser session: it generates a fresh address, opens the inbox and
 * waits for an incoming message, returning either the extracted link or the raw
 * body. No HTTP client is used because the site is a client-rendered SPA.
 *
 * @module inbox/zenvex
 */

import { log, sleep } from "../utils/logger.mjs";

export const ZENVEX = "https://zenvex.dev";

/**
 * Receiving domains zenvex.dev currently serves.
 * Override with `--domain` or `ZENVEX_DOMAIN`.
 */
export const ZENVEX_DOMAINS = [
  "souss.dev",
  "znvx.me",
  "zenvex.edu.pl",
  "encg.edu.pl",
  "ensam.edu.pl",
  "ofppt.edu.pl",
];

/**
 * The address field is a plain `<input>` (no `type` attribute), so select it by
 * excluding non-text inputs rather than by an attribute selector.
 */
const ADDRESS_INPUT = `([...document.querySelectorAll('input')].find(i => !['file','checkbox','radio','hidden'].includes(i.type)) || null)`;

/** JS: read the current generated address from the landing page. */
const READ_ADDRESS = `(() => {
  const input = ${ADDRESS_INPUT};
  // The domain switcher is a button whose label/text is "@<domain>".
  const label = [...document.querySelectorAll('button')]
    .map(b => (b.getAttribute('aria-label') || '') + ' ' + (b.innerText || ''))
    .map(s => s.replace(/\\s+/g, ' ').trim())
    .find(s => /@\\s*[a-z0-9.-]+\\.[a-z]{2,}/i.test(s));
  const m = label ? label.match(/@\\s*([a-z0-9.-]+\\.[a-z]{2,})/i) : null;
  const domain = m ? m[1] : '';
  const local = input ? input.value.trim() : '';
  return { local, domain, email: local && domain ? local + '@' + domain : '' };
})()`;

/**
 * JS: read the inbox message list on the /inbox page.
 *
 * Only the list column is scanned, and only leaf-ish rows, so the preview pane
 * and the page chrome cannot be mistaken for a message. Rows are reported with
 * the sender and subject separately.
 */
const READ_INBOX = `(() => {
  const body = document.body ? document.body.innerText : '';
  const onInbox = location.pathname.startsWith('/inbox') || body.includes('INBOX_');
  // A message row looks like "<sender@…>\\n<subject>\\n<age>". Rows carry the
  // sender address; page chrome and the preview pane are excluded by shape.
  const rows = [...document.querySelectorAll('button,a,[role="button"],li,article')]
    .map(el => (el.innerText || '').trim())
    .filter(t => t.length > 10 && t.length < 400)
    .filter(t => /@/.test(t) && /\\n/.test(t))
    .filter(t => !/Verify your email address to continue/.test(t))
    .filter(t => !/^Skip to content/.test(t));
  return { onInbox, body, rows: [...new Set(rows)] };
})()`;

/**
 * Generate a fresh zenvex address by loading the landing page and randomising.
 *
 * @param {import('../browser/manager.mjs').BrowserManager} browser
 * @param {string} [domain] pin a domain, or empty for a random one
 * @returns {Promise<{email:string, local:string, domain:string}>}
 */
export async function createAddress(browser, domain = "") {
  log.step("opening zenvex.dev to generate a disposable address");
  await browser.goto(`${ZENVEX}/`);
  await browser.page.waitFor(`!!${ADDRESS_INPUT}`, {
    timeout: 30000,
    label: "zenvex input",
  });
  await sleep(800);

  // Always randomise so a fresh, unused address is produced. zenvex reuses the
  // last address across visits, and re-registering an existing arena.ai email
  // turns the sign-up into a login, which breaks the create flow.
  await browser.page.evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => (b.getAttribute('aria-label') || b.title || '') === 'Randomize');
    if (btn) btn.click();
    return !!btn;
  })()`);
  await sleep(900);

  let info = await browser.page.evaluate(READ_ADDRESS);
  if (domain && info.domain !== domain) {
    // Open the domain dropdown and choose the requested one.
    const chosen = await browser.page.evaluate(`(() => {
      const btn = [...document.querySelectorAll('button')]
        .find(b => (b.getAttribute('aria-label') || '').startsWith('@'));
      if (btn) btn.click();
      return true;
    })()`);
    if (chosen) {
      await sleep(400);
      await browser.page.evaluate(`(() => {
        const target = ${JSON.stringify(domain)};
        const opt = [...document.querySelectorAll('button,[role="option"],[role="menuitem"]')]
          .find(b => (b.getAttribute('aria-label') || b.innerText || '').includes(target));
        if (opt) opt.click();
        return !!opt;
      })()`);
      await sleep(400);
      info = await browser.page.evaluate(READ_ADDRESS);
    }
  }

  if (!info.email) throw new Error("could not read a generated zenvex address");
  log.ok(`disposable address: ${info.email}`);
  return info;
}

/** Open the inbox for an address's local part. */
export async function openInbox(browser, local) {
  log.step(`opening zenvex inbox for ${local}`);

  // The inbox is an SPA route; navigating directly is unreliable, so drive the
  // landing page's "Open Inbox" button instead.
  if (!browser.page) throw new Error("browser page is not available");
  const host = await browser.page.evaluate("location.hostname");
  const onLanding =
    host.includes("zenvex") &&
    !(await browser.page.evaluate("location.pathname.startsWith('/inbox')"));
  if (onLanding) {
    await browser.page.evaluate(`(() => {
      const input = ${ADDRESS_INPUT};
      if (input && input.value.trim() !== ${JSON.stringify(local)}) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, ${JSON.stringify(local)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const btn = [...document.querySelectorAll('button')]
        .find(b => /open inbox/i.test((b.getAttribute('aria-label') || '') + ' ' + (b.innerText || '')));
      if (btn) btn.click();
      return !!btn;
    })()`);
  } else {
    // Not on the zenvex landing page at all: go there and click through.
    await browser.goto(`${ZENVEX}/`);
    await browser.page.waitFor(`!!${ADDRESS_INPUT}`, {
      timeout: 30000,
      label: "zenvex landing input",
    });
    await sleep(600);
    await browser.page.evaluate(`(() => {
      const input = ${ADDRESS_INPUT};
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(local)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      const btn = [...document.querySelectorAll('button')]
        .find(b => /open inbox/i.test((b.getAttribute('aria-label') || '') + ' ' + (b.innerText || '')));
      if (btn) btn.click();
      return !!btn;
    })()`);
  }

  // The SPA occasionally swallows the first click; retry until the route changes.
  const deadline = Date.now() + 30000;
  let open = false;
  while (Date.now() < deadline) {
    open = await browser.page.evaluate(
      `location.pathname.startsWith('/inbox') || document.body.innerText.includes('INBOX_')`,
    );
    if (open) break;
    await browser.page.evaluate(`(() => {
      const input = ${ADDRESS_INPUT};
      if (input && input.value.trim() !== ${JSON.stringify(local)}) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, ${JSON.stringify(local)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const btn = [...document.querySelectorAll('button')]
        .find(b => /open inbox/i.test((b.getAttribute('aria-label') || '') + ' ' + (b.innerText || '')));
      if (btn) btn.click();
      return !!btn;
    })()`);
    await sleep(1500);
  }
  if (!open) throw new Error("could not open the zenvex inbox");
  log.info("inbox is open");
}

/**
 * Poll the inbox until a message matching `match` appears, then return its
 * detail text plus every link found in it.
 *
 * @param {import('../browser/manager.mjs').BrowserManager} browser
 * @param {RegExp} match             subject matcher, e.g. /confirm your signup/i
 * @param {{timeout?:number, interval?:number, localPart?:string}} [opts]
 * @returns {Promise<{subject:string, links:string[], body:string}>}
 */
export async function waitForMessage(
  browser,
  match,
  { timeout = 180000, interval = 3000, localPart = "" } = {},
) {
  const deadline = Date.now() + timeout;
  let lastCount = -1;
  const seen = new Set();

  while (Date.now() < deadline) {
    const inbox = await browser.page.evaluate(READ_INBOX);

    // The SPA can drop back to the landing page; re-open the inbox if so.
    if (!inbox.onInbox) {
      log.info("inbox route lost, reopening");
      await openInbox(browser, localPart || (inbox.body.match(/[a-z0-9]+@/i) || [""])[0]);
      await sleep(1500);
      continue;
    }

    const rows = inbox.rows || [];

    for (const row of rows) {
      if (!match.test(row) || seen.has(row)) continue;
      seen.add(row);
      log.info(`opening message: ${row.replace(/\s+/g, " ").slice(0, 70)}`);

      // Click the row (pick the smallest matching element) to open its preview.
      await browser.page.evaluate(`(() => {
        const re = ${match};
        const el = [...document.querySelectorAll('button,a,[role="button"],li,article')]
          .filter(e => re.test(e.innerText || ''))
          .sort((a, b) => a.innerText.length - b.innerText.length)[0];
        if (el) el.click();
        return !!el;
      })()`);
      await sleep(2500);

      const detail = await browser.page.evaluate(`(() => {
        const links = [...document.querySelectorAll('a')].map(a => a.href).filter(Boolean);
        // The preview iframe is where the real email HTML (and its links) live.
        for (const frame of document.querySelectorAll('iframe')) {
          try {
            const doc = frame.contentDocument;
            if (!doc) continue;
            for (const a of doc.querySelectorAll('a')) {
              if (a.href) links.push(a.href);
            }
          } catch { /* cross-origin frame */ }
        }
        return { links, body: document.body ? document.body.innerText : '' };
      })()`);

      const arenaLink = findLink(detail.links, /arena\.ai\/(nextjs-api\/callback|auth|verify)/i);
      if (arenaLink) return { subject: row, links: detail.links, body: detail.body };

      log.info("message had no arena.ai verification link yet; continuing to wait");
    }

    if (rows.length !== lastCount) {
      lastCount = rows.length;
      log.info(`inbox has ${rows.length} message row(s)`);
    }
    await sleep(interval);
  }
  throw new Error("timed out waiting for the verification email");
}

/**
 * Extract the first link matching a pattern from a message's link list.
 * @param {string[]} links
 * @param {RegExp} pattern
 */
export function findLink(links, pattern) {
  return links.find((l) => pattern.test(l)) || null;
}
