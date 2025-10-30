console.log("[CSP] content script loaded");

function sendMessage(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, res => resolve(res)));
}

function findBanners(root = document) {
  const selectors = [
    '[id*="cookie"]', '[class*="cookie"]',
    '[id*="consent"]', '[class*="consent"]',
    '[id*="gdpr"]', '[class*="gdpr"]',
    '[id*="consent-banner"]', '[class*="consent-banner"]',
    '.cc-window', '.cc-banner', '.cookie-banner', '.cookie-consent', '.qc-cmp2-container'
  ];
  return root.querySelectorAll(selectors.join(','));
}

// Returns true if an action was performed
function interactWithBanner(banner) {
  const denyTexts = ['reject', 'reject all', 'decline', 'decline all', 'deny', 'deny all', 'reject all cookies'];
  const essentialsTexts = ['accept necessary', 'necessary only', 'only necessary', 'accept essential', 'Do Not Sell or Share My Personal Information', 'essential only', 'only essential'];

  const interactiveEls = Array.from(banner.querySelectorAll(
    'button,a,input[type="button"],input[type="submit"],[role="button"],input[type="checkbox"],input[type="radio"]'
  ));

  let clicked = false;

  // Step 1: try to click any deny/reject button
  for (const el of interactiveEls) {
    const txt = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
    if (denyTexts.some(d => txt.includes(d))) {
      try { el.click(); clicked = true; console.log("[CSP] clicked deny/reject:", txt); } catch(e){}
      break;
    }
  }

  // Step 2: if no deny, click essentials only
  if (!clicked) {
    for (const el of interactiveEls) {
      const txt = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
      if (essentialsTexts.some(e => txt.includes(e))) {
        try { el.click(); clicked = true; console.log("[CSP] clicked essentials only:", txt); } catch(e){}
        break;
      }
    }
  }

  // Step 3: uncheck non-essential checkboxes if present
  for (const el of interactiveEls) {
    if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) continue;
    if ((el.type === 'checkbox' || el.type === 'radio') && !el.dataset.essential) {
      try { el.checked = false; } catch(e){}
    }
  }

  // Step 4: remove banner
  if (clicked) {
    try { banner.remove(); } catch(e){}
    return true;
  }

  return false;
}

async function handleBanners() {
  const banners = findBanners();
  if (!banners || banners.length === 0) return;

  let removedCount = 0;
  for (const b of banners) {
    const interacted = interactWithBanner(b);
    if (interacted) removedCount++;
  }

  if (removedCount > 0) {
    await sendMessage({ type: "LOG_BANNER_REMOVED", count: removedCount });
  }
}

function startObserver() {
  const obs = new MutationObserver(mutations => {
    if (!mutations.some(m => m.addedNodes && m.addedNodes.length > 0)) return;
    setTimeout(handleBanners, 300);
  });
  obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
}

(async function init() {
  await handleBanners();
  startObserver();
  for (let i=1; i<=5; i++) setTimeout(handleBanners, i*1000);
})();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "REMOVE_BANNERS") {
    handleBanners().then(cnt => sendResponse({ removed: cnt })).catch(() => sendResponse({ removed: 0 }));
    return true;
  }
});
