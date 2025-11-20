
// Whitelisted session cookies that should never be blocked.
const ESSENTIAL_COOKIES = ["PHPSESSID", "JSESSIONID", "sessionid", "csrf_token", "auth_token"];
console.log("[CSP] content script loaded");

// ---------------- Message Helper ----------------
// Send a message to the background script and return a promise for the response.
function sendMessage(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, res => resolve(res)));
}

// ---------------- Banner Handling ----------------
// Find cookie/consent banners within the current document (and any accessible iframes).
function findBanners(root = document) {
  let banners = [];
  const selectors = [
    '[id*="cookie"]', '[class*="cookie"]',
    '[id*="consent"]', '[class*="consent"]',
    '[id*="gdpr"]', '[class*="gdpr"]',
    '[id*="consent-banner"]', '[class*="consent-banner"]',
    '.cc-window', '.cc-banner', '.cookie-banner', '.cookie-consent', '.qc-cmp2-container'
  ];
  banners.push(...root.querySelectorAll(selectors.join(',')));

  for (const frame of root.querySelectorAll('iframe')) {
    try {
      // Recursively scan iframe documents when same-origin access is allowed.
      if (frame.contentDocument) banners.push(...findBanners(frame.contentDocument));
    } catch(e){}
  }
  return banners;
}

// Attempt to click deny/essential-only actions on a banner and remove it if successful
function interactWithBanner(banner) {
  const denyTexts = ['reject', 'reject all', 'decline', 'decline all', 'deny', 'deny all', 'reject all cookies'];
  const essentialsTexts = ['accept necessary', 'necessary only', 'only necessary', 'accept essential', 'do not sell or share my personal information', 'essential only', 'only essential'];

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

  if (clicked) {
    try { banner.remove(); } catch(e){}
    return true;
  }
  return false;
}

// Scan for banners and report how many were dismissed.
async function handleBanners() {
  const banners = findBanners();
  if (!banners || banners.length === 0) return 0;

  let removedCount = 0;
  for (const b of banners) if (interactWithBanner(b)) removedCount++;

  if (removedCount > 0) await sendMessage({ type: "LOG_BANNER_REMOVED", count: removedCount });
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
