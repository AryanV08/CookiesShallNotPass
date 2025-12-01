console.log("[CSP] content script loaded");

// ---------------- State Helper ----------------
async function fetchState() {
  try {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime?.id) {
        reject(new Error("Extension context invalidated"));
        return;
      }
      
      chrome.runtime.sendMessage({ type: "GET_STATE" }, res => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(res?.state);
      });
    });
  } catch(e) {
    console.log("[CSP] Failed to fetch state:", e);
    return null;
  }
}

// ---------------- Message Helper ----------------
async function sendMessage(msg) {
  try {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime?.id) {
        reject(new Error("Extension context invalidated"));
        return;
      }
      
      chrome.runtime.sendMessage(msg, res => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(res);
      });
    });
  } catch(e) {
    console.log("[CSP] Failed to send message:", e);
    return null;
  }
}

// ---------------- Comprehensive Banner Detection ----------------
function findBanners(root = document) {
  let banners = [];
  
  // More selective selectors - focus on visible UI elements, not script tags
  const selectors = [
    // Cookie-specific patterns (visible elements only)
    'div[id*="cookie"]', 'div[class*="cookie"]',
    'section[id*="cookie"]', 'section[class*="cookie"]',
    'aside[id*="cookie"]', 'aside[class*="cookie"]',
    'dialog[id*="cookie"]', 'dialog[class*="cookie"]',
    
    // Consent-specific patterns
    'div[id*="consent"]', 'div[class*="consent"]',
    'section[id*="consent"]', 'section[class*="consent"]',
    
    // GDPR/Privacy patterns
    'div[id*="gdpr"]', 'div[class*="gdpr"]',
    'div[id*="privacy"]', 'div[class*="privacy"]',
    
    // Banner/Modal/Notice patterns (only visible containers)
    'div[id*="banner"]', 'div[class*="banner"]',
    'div[id*="notice"]', 'div[class*="notice"]',
    'div[id*="notification"]', 'div[class*="notification"]',
    'div[id*="modal"]', 'div[class*="modal"]',
    'div[id*="popup"]', 'div[class*="popup"]',
    'div[id*="overlay"]', 'div[class*="overlay"]',
    
    // Common cookie banner frameworks (specific to visible elements)
    '.cc-window', '.cc-banner', '.cookie-banner', 
    '.cookie-consent', '.cookie-notice', '.gdpr-banner',
    '.onetrust-banner-container', '.ot-sdk-container',
    '.cookies-banner', '.cookie-bar'
  ];
  
  // Find all potential banner elements
  const elements = root.querySelectorAll(selectors.join(','));
  
  // Filter to likely cookie banners with additional checks
  for (const el of elements) {
    // Skip script tags and non-visible elements
    if (el.tagName === 'SCRIPT' || el.tagName === 'LINK' || el.tagName === 'STYLE') {
      continue;
    }
    
    // Check if element is likely visible
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      continue;
    }
    
    const text = (el.innerText || '').toLowerCase();
    const hasKeywords = text.includes('cookie') || 
                       text.includes('consent') || 
                       text.includes('privacy') ||
                       text.includes('gdpr') ||
                       text.includes('tracking') ||
                       text.includes('we use cookies');
    
    // Only include if it has relevant keywords AND matches cookie patterns
    if (hasKeywords) {
      banners.push(el);
    }
  }

  // Check for banners in iframes (more selective)
  const iframes = root.querySelectorAll('iframe');
  for (const frame of iframes) {
    // Only check iframes that are likely to contain banners
    const frameSrc = (frame.src || '').toLowerCase();
    const frameId = (frame.id || '').toLowerCase();
    const frameClass = (frame.className || '').toLowerCase();
    
    const isBannerIframe = frameSrc.includes('cookie') || 
                          frameSrc.includes('consent') || 
                          frameSrc.includes('gdpr') ||
                          frameId.includes('cookie') || 
                          frameId.includes('consent') ||
                          frameClass.includes('cookie') || 
                          frameClass.includes('consent');
    
    if (isBannerIframe) {
      banners.push(frame);
    }
    
    // Try to access iframe content (same-origin only)
    try {
      if (frame.contentDocument && frame.contentDocument !== document) {
        const iframeBanners = findBanners(frame.contentDocument);
        banners.push(...iframeBanners);
      }
    } catch(e) {
      // Cross-origin iframe, cannot access content
    }
  }
  
  return banners;
}

// ---------------- Banner Removal Strategies ----------------
function tryRemoveBanner(banner) {
  try {
    // Don't remove iframes or important elements that might break the page
    if (banner.tagName === 'IFRAME') {
      // For iframes, just hide them
      return hideBanner(banner);
    }

    // Skip script tags and other non-UI elements
    if (banner.tagName === 'SCRIPT' || banner.tagName === 'LINK' || banner.tagName === 'STYLE') {
      console.log("[CSP] Skipping non-UI element:", banner.tagName);
      return hideBanner(banner); // Hide instead of remove
    }
    
    // Try direct removal for divs and other containers
    if (banner.remove && (banner.tagName === 'DIV' || banner.tagName === 'SECTION' || banner.tagName === 'ASIDE' || banner.tagName === 'DIALOG')) {
      banner.remove();
      console.log("[CSP] Successfully removed banner directly");
      return true;
    }
    
    return false;
  } catch(e) {
    console.log("[CSP] Cannot remove banner directly:", e);
    return false;
  }
}


function interactWithBanner(banner) {
  // Comprehensive list of denial/rejection options
  const denyTexts = [
    'reject', 'reject all', 'decline', 'decline all', 
    'deny', 'deny all', 'refuse', 'refuse all',
    'no thanks', 'no thank you', 'no', 'opt out',
    'dismiss', 'close', 'continue without accepting',
    'do not accept', 'not now', 'later'
  ];
  
  // Essential/necessary only options
  const essentialTexts = [
    'necessary', 'essential', 'only', "don't",
    'accept essential', 'essential only', 'only essential',
    'required only', 'functional only', 'strictly necessary',
    'minimum cookies', 'do not sell', 'do not share', 
    'manage preferences', 'customize settings', 'customize',
    'cookie settings', 'privacy settings', 'consent settings', 
    'manage consent', 'preferences', 'settings'
  ];
  
  // Close/dismiss options
  const closeTexts = [
    'close', 'dismiss', 'continue', 'ok', 'okay',
    'understand', 'got it', 'agree', 'accept', 'i agree'
  ];

  // Find all interactive elements
  const interactiveEls = Array.from(banner.querySelectorAll(
    'button, a, input[type="button"], input[type="submit"], [role="button"], ' +
    'input[type="checkbox"], input[type="radio"], [onclick], [tabindex]'
  ));

  let interacted = false;

  // Strategy 1: Try to click deny/reject buttons (highest priority)
  for (const el of interactiveEls) {
    const txt = (el.innerText || el.value || el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase();
    
    if (denyTexts.some(d => txt.includes(d))) {
      try {
        console.log("[CSP] Clicking deny/reject button:", txt);
        el.click();
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        interacted = true;
        break;
      } catch(e) {
        console.log("[CSP] Failed to click deny button:", e);
      }
    }
  }

  // Strategy 2: Try essential/necessary only buttons
  if (!interacted) {
    for (const el of interactiveEls) {
      const txt = (el.innerText || el.value || el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase();
      
      if (essentialTexts.some(e => txt.includes(e))) {
        try {
          console.log("[CSP] Clicking essential/necessary only button:", txt);
          el.click();
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          interacted = true;
          break;
        } catch(e) {
          console.log("[CSP] Failed to click essential button:", e);
        }
      }
    }
  }

  // Strategy 3: Uncheck all non-essential checkboxes/toggles
  if (!interacted) {
    for (const el of interactiveEls) {
      if ((el.type === 'checkbox' || el.type === 'radio') && el.checked) {
        const label = (el.getAttribute('aria-label') || el.getAttribute('data-label') || el.name || '').toLowerCase();
        // Don't uncheck if it's marked as essential/necessary
        if (!label.includes('essential') && 
            !label.includes('necessary') && 
            !label.includes('required') &&
            !label.includes('functional')) {
          try {
            el.checked = false;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            console.log("[CSP] Unchecked non-essential toggle");
            interacted = true;
          } catch(e) {
            console.log("[CSP] Failed to uncheck toggle:", e);
          }
        }
      }
    }
  }

  // Strategy 4: Try close/dismiss buttons
  if (!interacted) {
    for (const el of interactiveEls) {
      const txt = (el.innerText || el.value || el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase();
      
      if (closeTexts.some(c => txt.includes(c))) {
        try {
          console.log("[CSP] Clicking close/dismiss button:", txt);
          el.click();
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          interacted = true;
          break;
        } catch(e) {
          console.log("[CSP] Failed to click close button:", e);
        }
      }
    }
  }

  return interacted;
}

function hideBanner(banner) {
  try {
    // Apply multiple hiding techniques
    banner.style.display = 'none';
    banner.style.visibility = 'hidden';
    banner.style.opacity = '0';
    banner.style.pointerEvents = 'none';
    banner.style.position = 'fixed';
    banner.style.zIndex = '-9999';
    banner.style.left = '-9999px';
    banner.setAttribute('hidden', 'true');
    banner.setAttribute('aria-hidden', 'true');
    
    console.log("[CSP] Hidden banner as fallback");
    return true;
  } catch(e) {
    console.log("[CSP] Could not hide banner:", e);
    return false;
  }
}

function handleSingleBanner(banner) {
  console.log("[CSP] Processing banner:", banner.tagName, banner.id || banner.className);
  
  // STEP 1: Try to remove the banner directly (preferred method)
  if (tryRemoveBanner(banner)) {
    return true;
  }
  
  // STEP 2: If removal failed, try to interact with it
  const interacted = interactWithBanner(banner);
  
  // STEP 3: After interaction, try to remove again
  if (interacted) {
    setTimeout(() => {
      if (!tryRemoveBanner(banner)) {
        hideBanner(banner);
      }
    }, 500);
    return true;
  }
  
  // STEP 4: Last resort - hide the banner completely
  return hideBanner(banner);
}

// ---------------- Main Banner Handler ----------------
let processedBanners = new Set();

async function handleBanners() {
  // Check if extension context is still valid
  if (!chrome.runtime?.id) {
    console.log("[CSP] Extension context invalidated, stopping banner handling");
    stopObserver();
    return 0;
  }

  // Check if auto banner removal is enabled
  const state = await fetchState();
  if (!state?.autoBannerRemoval) {
    return 0;
  }

  const banners = findBanners();
  if (!banners || banners.length === 0) {
    return 0;
  }

  console.log(`[CSP] Found ${banners.length} potential banner(s)`);
  
  let handled = false;
  for (const banner of banners) {
    // Create a unique identifier for this banner
    const bannerId = banner.id || banner.className || banner.tagName + (banner.innerText || '').substring(0, 50);
    
    // Skip if we've already processed this banner IN THE CURRENT PAGE SESSION
    if (processedBanners.has(bannerId)) {
      console.log("[CSP] Skipping already processed banner in current session:", bannerId);
      continue;
    }
    
    if (handleSingleBanner(banner)) {
      handled = true;
      processedBanners.add(bannerId);
      console.log("[CSP] Marked banner as processed in current session:", bannerId);
    }
  }

  // Report to background only if we removed banners
  if (handled) {
    console.log(`[CSP] Successfully handled a new banner in this session`);
    try {
      await sendMessage({ type: "LOG_BANNER_REMOVED", count: 1 });
    } catch(e) {
      console.error("[CSP] Failed to report banner removal:", e);
    }
  }
  
  return 1;
}

// Reset processed banners when page loads (fresh start for each page load)
window.addEventListener('load', () => {
  processedBanners.clear();
  console.log("[CSP] Page loaded - cleared processed banners cache for fresh count");
});

// Also reset when script first runs to ensure fresh start
processedBanners.clear();
console.log("[CSP] Fresh page session - ready to count banners");

// Optional: Reset on beforeunload to be extra safe
window.addEventListener('beforeunload', () => {
  processedBanners.clear();
});

// ---------------- Observer for Dynamic Banners ----------------
let observer = null;

function startObserver() {
  if (observer) {
    return; // Already running
  }

  observer = new MutationObserver(async (mutations) => {
    // Check if new nodes were added
    const hasNewNodes = mutations.some(m => m.addedNodes && m.addedNodes.length > 0);
    if (hasNewNodes) {
      // Wait a bit for the banner to fully render
      setTimeout(handleBanners, 300);
    }
  });
  
  observer.observe(document.body || document.documentElement, { 
    childList: true, 
    subtree: true 
  });
  
  console.log("[CSP] Banner observer started");
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
    console.log("[CSP] Banner observer stopped");
  }
}

// ---------------- State Management ----------------
let currentBannerRemovalState = false;

async function checkStateAndToggleObserver() {
  if (!chrome.runtime?.id) {
    console.log("[CSP] Extension context invalidated, stopping state checks");
    clearInterval(stateCheckInterval);
    stopObserver();
    return;
  }

  const state = await fetchState();
  const bannerRemovalEnabled = state?.autoBannerRemoval || false;
  
  // Only toggle if state actually changed
  if (bannerRemovalEnabled !== currentBannerRemovalState) {
    console.log(`[CSP] Banner removal state changed to: ${bannerRemovalEnabled}`);
    currentBannerRemovalState = bannerRemovalEnabled;
    
    if (bannerRemovalEnabled) {
      console.log("[CSP] Banner removal enabled, starting observer");
      startObserver();
      handleBanners();
    } else {
      console.log("[CSP] Banner removal disabled, stopping observer");
      stopObserver();
    }
  }
}

// ---------------- Initialization ----------------
(async function init() {
  console.log("[CSP] Initializing content script");
  
  // Check if extension context is valid
  if (!chrome.runtime?.id) {
    console.log("[CSP] Extension context invalidated on load");
    return;
  }
  
  try {
    // Get initial state and set up
    await checkStateAndToggleObserver();
    
    // Schedule additional sweeps for delayed banners
    for (let i = 1; i <= 5; i++) {
      setTimeout(handleBanners, i * 1000);
    }
    
    console.log("[CSP] Content script initialized");
  } catch(e) {
    console.log("[CSP] Initialization error:", e);
  }
})();

// ---------------- Periodic State Check ----------------
const stateCheckInterval = setInterval(() => {
  checkStateAndToggleObserver().catch(e => {
    console.log("[CSP] State check error:", e);
  });
}, 2000);