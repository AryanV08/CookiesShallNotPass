
// Whitelisted session cookies that should never be blocked.
const ESSENTIAL_COOKIES = ["PHPSESSID", "JSESSIONID", "sessionid", "csrf_token", "auth_token"];
console.log("[CSP] content script loaded");

// ---------------- Message Helper ----------------
// Send a message to the background script and return a promise for the response.
function sendMessage(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, res => resolve(res)));
}

// ---------------- Banner Handling ----------------
const BANNER_KEYWORDS = ['cookie', 'consent', 'gdpr', 'cmp'];

const handledBanners = new WeakSet();
let bannerLoggedThisPage = false;

// Find cookie/consent banners within the current document (and any accessible iframes/shadow roots).
function findBanners(root = document, seen = new Set()) {
  if (!root || seen.has(root)) return [];
  seen.add(root);

  const selectors = [
    '[id*="cookie"]', '[class*="cookie"]',
    '[id*="consent"]', '[class*="consent"]',
    '[id*="gdpr"]', '[class*="gdpr"]',
    '[id*="consent-banner"]', '[class*="consent-banner"]',
    '.cc-window', '.cc-banner', '.cookie-banner', '.cookie-consent', '.qc-cmp2-container',
    '[aria-label*="cookie"]', '[aria-describedby*="cookie"]',
    '#onetrust-consent-sdk', '[class*="onetrust"]', '[id*="onetrust"]',
    '[class*="sp_message_container"]', '[id*="sp_message_container"]',
    '[data-testid*="cookie"]'
  ];

  const banners = new Set(Array.from(root.querySelectorAll(selectors.join(','))));

  // Heuristic: elements containing cookie/consent keywords and action buttons.
  const candidates = root.querySelectorAll('div,section,aside,footer,dialog,form');
  for (const el of candidates) {
    const text = (el.innerText || '').toLowerCase();
    if (!text) continue;
    if (!BANNER_KEYWORDS.some(k => text.includes(k))) continue;
    if (el.querySelector('button,a,[role="button"],input[type="button"],input[type="submit"]')) {
      banners.add(el);
    }
  }

  // Scan same-origin iframes
  for (const frame of root.querySelectorAll('iframe')) {
    try {
      if (frame.contentDocument) findBanners(frame.contentDocument, seen).forEach(b => banners.add(b));
    } catch(e){}
  }

  // Scan shadow roots
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) findBanners(el.shadowRoot, seen).forEach(b => banners.add(b));
  }

  return Array.from(banners);
}

// Remove nested/duplicate matches so we only act on the top-most banner container.
function dedupeBanners(banners) {
  return banners.filter(b => !banners.some(other => other !== b && other.contains(b)));
}

// Determine if an element looks like an overlay/popup banner.
function isOverlay(el) {
  try {
    const cs = getComputedStyle(el);
    const position = cs.position;
    const highZ = parseInt(cs.zIndex, 10);
    const positioned = position === 'fixed' || position === 'sticky';
    const hasHighZ = !Number.isNaN(highZ) && highZ >= 50;
    return positioned || hasHighZ;
  } catch (_) {
    return false;
  }
}

// Attempt to click deny/essential-only actions on a banner and remove it if successful
function interactWithBanner(banner) {
  const denyTexts = ['reject', 'reject all', 'decline', 'decline all', 'deny', 'deny all', 'reject all cookies', 'continue without accepting', 'continue without agreeing', 'refuse'];
  const essentialsTexts = ['accept necessary', 'necessary only', 'only necessary', 'accept essential', 'do not sell or share my personal information', 'essential only', 'only essential', 'strictly necessary', 'only required'];
  const saveTexts = ['save choices', 'save preferences', 'confirm choices', 'confirm my choices', 'submit preferences', 'save settings', 'save and exit'];

  const interactiveEls = Array.from(banner.querySelectorAll(
    'button,a,input[type="button"],input[type="submit"],[role="button"],input[type="checkbox"],input[type="radio"]'
  ));

  let clicked = false;

  // Prefer hard opt-out actions (deny/reject) when available.
  for (const el of interactiveEls) {
    const txt = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
    if (denyTexts.some(d => txt.includes(d))) {
      try { el.click(); clicked = true; console.log("[CSP] clicked deny/reject:", txt); } catch(e){}
      break;
    }
  }

  if (!clicked) {
    // Fall back to “essentials only” style actions for softer opt-outs
    for (const el of interactiveEls) {
      const txt = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
      if (essentialsTexts.some(e => txt.includes(e))) {
        try { el.click(); clicked = true; console.log("[CSP] clicked essentials only:", txt); } catch(e){}
        break;
      }
    }
  }

  // Uncheck opt-in toggles that are not explicitly marked as essential.
  for (const el of interactiveEls) {
    if ((el.type === 'checkbox' || el.type === 'radio') && !el.dataset.essential) {
      try { el.checked = false; } catch(e){}
    }
  }

  if (!clicked) {
    // Apply toggles then try to save/confirm settings, which often respects the unchecked state
    for (const el of interactiveEls) {
      const txt = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
      if (saveTexts.some(s => txt.includes(s))) {
        try { el.click(); clicked = true; console.log("[CSP] clicked save/confirm:", txt); } catch(e){}
        break;
      }
    }
  }

  if (clicked) {
    try { banner.remove(); } catch(e){}
    return true;
  }

  // Last resort: hide banner if it clearly references cookies/consent to avoid blocking the page
  const text = (banner.innerText || '').toLowerCase();
  if (isOverlay(banner) && BANNER_KEYWORDS.some(k => text.includes(k))) {
    banner.style.setProperty('display', 'none', 'important');
    banner.style.setProperty('visibility', 'hidden', 'important');
    banner.style.setProperty('opacity', '0', 'important');
    return true;
  }
  return false;
}

// Scan for banners and report how many were dismissed.
async function handleBanners() {
  const banners = dedupeBanners(findBanners());
  if (!banners || banners.length === 0) return 0;

  let removedCount = 0;
  for (const b of banners) {
    if (handledBanners.has(b)) continue;
    if (interactWithBanner(b)) {
      handledBanners.add(b);
      removedCount++;
    }
  }

  if (removedCount > 0 && !bannerLoggedThisPage) {
    bannerLoggedThisPage = true;
    await sendMessage({ type: "LOG_BANNER_REMOVED", count: 1 });
  }
  return removedCount;
}

// Observe DOM mutations so that dynamically injected banners can be handled
function startObserver() {
  const obs = new MutationObserver(mutations => {
    if (!mutations.some(m => m.addedNodes && m.addedNodes.length > 0)) return;
    setTimeout(handleBanners, 300);
  });
  obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
}

// ---------------- Cookie Blocking ----------------
// Override document.cookie to prevent non-essential cookies when auto-blocking is active.
(async function blockCookies() {
  const state = (await sendMessage({ type: "GET_STATE" })).state;
  const domain = window.location.hostname.replace(/^www\./, '');
  const shouldBlock = state.autoBlock || state.blacklist.includes(domain);

  if (shouldBlock) {
    const allowed = ESSENTIAL_COOKIES;
    let cookieValue = '';

    Object.defineProperty(document, 'cookie', {
      configurable: true,
      enumerable: true,
      get() { return cookieValue; },
      set(val) {
        const name = val.split('=')[0].trim();
        if (allowed.includes(name)) cookieValue = val;
        else console.log("[CSP] blocked cookie attempt:", val);
      }
    });
  }
})();

// ---------------- Init ----------------
// Run initial banner sweep and schedule follow-up passes for delayed banners.
(async function init() {
  await handleBanners();
  startObserver();
  for (let i=1; i<=5; i++) setTimeout(handleBanners, i*1000);
})();

// ---------------- Message Listener ----------------
// Allow the background page or popup to trigger banner removal manually.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "REMOVE_BANNERS") {
    handleBanners().then(cnt => sendResponse({ removed: cnt })).catch(() => sendResponse({ removed: 0 }));
    return true;
  }
});
