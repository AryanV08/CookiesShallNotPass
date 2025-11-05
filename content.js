
// Content script that auto-dismisses cookie consent banners and blocks non-essential cookies.
const ESSENTIAL_COOKIES = ["PHPSESSID", "JSESSIONID", "sessionid", "csrf_token", "auth_token"];
console.log("[CSP] content script loaded");

// ---------------- Message Helper ----------------
function sendMessage(msg) {
  // Proxy helper so we can await `chrome.runtime.sendMessage`.
  return new Promise(resolve => chrome.runtime.sendMessage(msg, res => resolve(res))); 
}

// ---------------- Banner Handling ----------------
function findBanners(root = document) {
  let banners = [];
  // Broad set of selectors to catch common consent banner implementations.
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
      // Recurse into friendly iframes because many CMPs load there.
      if (frame.contentDocument) banners.push(...findBanners(frame.contentDocument));
    } catch(e){}
  }
  return banners;
}

function interactWithBanner(banner) {
  const denyTexts = ['reject', 'reject all', 'decline', 'decline all', 'deny', 'deny all', 'reject all cookies'];
  const essentialsTexts = ['accept necessary', 'necessary only', 'only necessary', 'accept essential', 'do not sell or share my personal information', 'essential only', 'only essential'];

  const interactiveEls = Array.from(banner.querySelectorAll(
    'button,a,input[type="button"],input[type="submit"],[role="button"],input[type="checkbox"],input[type="radio"]'
  ));

  // Gather every element a user would normally click or toggle inside the banner.
  let clicked = false;
  // Track whether we've already triggered an action so we can avoid duplicate clicks.

  for (const el of interactiveEls) {
    const txt = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
    if (denyTexts.some(d => txt.includes(d))) {
      // Prefer explicit reject / deny actions when present.
      try { el.click(); clicked = true; console.log("[CSP] clicked deny/reject:", txt); } catch(e){}
      break;
    }
  }

  if (!clicked) {
    for (const el of interactiveEls) {
      const txt = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
      if (essentialsTexts.some(e => txt.includes(e))) {
        // Fall back to "accept essentials only" flavors when hard reject is missing.
        try { el.click(); clicked = true; console.log("[CSP] clicked essentials only:", txt); } catch(e){}
        break;
      }
    }
  }

  for (const el of interactiveEls) {
    if ((el.type === 'checkbox' || el.type === 'radio') && !el.dataset.essential) {
      // Make best effort to uncheck non essential trackers pre-selected by CMPs
      try { el.checked = false; } catch(e){}
    }
  }

  if (clicked) {
    try { banner.remove(); } catch(e){}
    // Consider the banner handled once we've fired an action and removed it from the DOM
    return true;
  }
  return false;
}

async function handleBanners() {
  const banners = findBanners();
  if (!banners || banners.length === 0) return 0;

  let removedCount = 0;
  // Track how many banners we successfully interacted with so we can log once.
  for (const b of banners) if (interactWithBanner(b)) removedCount++;

  if (removedCount > 0) await sendMessage({ type: "LOG_BANNER_REMOVED", count: removedCount });
  return removedCount;
}

function startObserver() {
  const obs = new MutationObserver(mutations => {
    // Only react when new nodes are injected; avoids extra work for attribute changes.
    if (!mutations.some(m => m.addedNodes && m.addedNodes.length > 0)) return;
    setTimeout(handleBanners, 300);
  });
  obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
}

// ---------------- Cookie Blocking ----------------
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
        // Replace the setter so third-party scripts can only store whitelisted cookies
        if (allowed.includes(name)) cookieValue = val;
        else console.log("[CSP] blocked cookie attempt:", val);
      }
    });
  }
})();

// ---------------- Init ----------------
(async function init() {
  // Run once immediately, then on DOM mutations and a short retry window.
  await handleBanners();
  startObserver();
  for (let i=1; i<=5; i++) setTimeout(handleBanners, i*1000);
})();

// ---------------- Message Listener ----------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Respond to manual banner removal requests from the popup/settings UI.
  if (msg.type === "REMOVE_BANNERS") {
    handleBanners().then(cnt => sendResponse({ removed: cnt })).catch(() => sendResponse({ removed: 0 }));
    return true;
  }
});
