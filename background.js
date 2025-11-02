import { Storage } from './popup/storage.js';
import { createBlockRule, updateRules, ESSENTIAL_COOKIES } from './popup/rulesEngine.js';

console.log("[CSP] background loaded");

let state = {
  blocked: 0,
  allowed: 0,
  bannersRemoved: 0,
  blacklist: [],
  whitelist: [],
  active: true,
  autoBlock: true
};

const ESSENTIAL_COOKIE_NAMES = new Set(ESSENTIAL_COOKIES.map(name => name.toLowerCase()));
const ESSENTIAL_NAME_KEYWORDS = [
  "session",
  "sessionid",
  "csrftoken",
  "xsrf",
  "csrf",
  "auth",
  "jwt",
  "token",
  "sso",
  "login"
];
const ESSENTIAL_NAME_PREFIXES = ["__secure-", "__host-", "sess_", "session-"];
const TRACKER_NAME_KEYWORDS = [
  "_ga",
  "_gid",
  "_gat",
  "_gac",
  "_gcl",
  "__utma",
  "__utmb",
  "__utmc",
  "__utmt",
  "__utmz",
  "_fbp",
  "_fbc",
  "ajs_anonymous_id",
  "ajs_user_id",
  "amplitude",
  "mixpanel",
  "segment",
  "_hj",
  "hotjar",
  "optimizely",
  "clarity",
  "_clck",
  "_clsk",
  "_uetsid",
  "_uetvid",
  "_pin_",
  "_scid",
  "sc_at",
  "hubspotutk",
  "pardot",
  "_mkto",
  "matomo",
  "piwik",
  "sentrysid",
  "adnxs",
  "doubleclick",
  "criteo",
  "pixel",
  "beacon",
  "tracking",
  "trackid"
];
const TRACKER_DOMAIN_KEYWORDS = [
  "doubleclick.",
  "googlesyndication.",
  "google-analytics.",
  "googletagmanager.",
  "googletagservices.",
  "googleadservices.",
  "connect.facebook.",
  "facebook.net",
  "scorecardresearch.",
  "quantserve.",
  "demdex.",
  "omtrdc.",
  "optimizely.",
  "hotjar.",
  "fullstory.",
  "clarity.ms",
  "branch.io",
  "appsflyer.",
  "taboola.",
  "outbrain.",
  "criteo.",
  "adsrvr.",
  "adnxs.",
  "doubleverify.",
  "snapads.",
  "ads-twitter.com",
  "analytics.twitter.com",
  "analytics.linkedin.com",
  "pardot.",
  "marketo.",
  "matomo.",
  "piwik."
];
const CRITICAL_DOMAIN_KEYWORDS = [
  "accounts.google.",
  "myaccount.google.",
  "mail.google.",
  "workspace.google.",
  "login.live.",
  "login.microsoftonline.",
  "appleid.apple.",
  "icloud.com"
];
const SHORT_LIVED_THRESHOLD_SECONDS = 2 * 60 * 60; // 2 hours
const removalInProgress = new Set();

// Load state from storage
(async () => {
  await Storage.loadFromSync();
  const saved = await Storage.get("state");
  if (saved) state = saved;

  // Clear old rules
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules: [] });

  if (!state.autoBlock && state.blacklist.length > 0) {
    const rules = state.blacklist.map(d => createBlockRule(d));
    await updateRules(rules);
  }
})();

async function saveState() {
  await Storage.set("state", state);
}

function normalizeDomain(domain = "") {
  return domain.replace(/^\./, "").toLowerCase();
}

function domainsOverlap(domainA = "", domainB = "") {
  const a = normalizeDomain(domainA);
  const b = normalizeDomain(domainB);
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

function domainMatchesList(domain, list = []) {
  return list.some(entry => domainsOverlap(domain, entry));
}

function buildRemovalUrl(cookie) {
  const protocol = cookie.secure ? "https" : "http";
  const domain = normalizeDomain(cookie.domain);
  let path = cookie.path || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  return `${protocol}://${domain}${path}`;
}

function cookieKey(cookie) {
  return `${cookie.storeId || "default"}|${normalizeDomain(cookie.domain)}|${cookie.name}`;
}

// Check if cookie is essential using heuristics
function isEssentialCookie(cookie) {
  if (!cookie) return false;

  const nameLower = (cookie.name || "").toLowerCase();
  const domainLower = normalizeDomain(cookie.domain);
  const sameSite = (cookie.sameSite || "").toLowerCase();

  if (ESSENTIAL_COOKIE_NAMES.has(nameLower)) return true;
  if (ESSENTIAL_NAME_PREFIXES.some(prefix => nameLower.startsWith(prefix))) return true;
  if (ESSENTIAL_NAME_KEYWORDS.some(keyword => nameLower.includes(keyword))) return true;
  if (CRITICAL_DOMAIN_KEYWORDS.some(keyword => domainLower.includes(keyword))) return true;
  if (cookie.session || !cookie.expirationDate) return true;

  const expiration = cookie.expirationDate ? cookie.expirationDate - Date.now() / 1000 : null;
  if (expiration !== null && expiration <= SHORT_LIVED_THRESHOLD_SECONDS) return true;

  if (sameSite === "strict") return true;

  return false;
}

async function handleCookieChange(change) {
  if (!state.active) return;

  const { removed, cookie } = change;
  if (!cookie) return;

  if (typeof state.blocked !== "number") state.blocked = 0;
  if (typeof state.allowed !== "number") state.allowed = 0;

  const key = cookieKey(cookie);

  if (removed) {
    if (removalInProgress.has(key)) removalInProgress.delete(key);
    return;
  }

  const domain = normalizeDomain(cookie.domain);
  const inWhitelist = domainMatchesList(domain, state.whitelist);
  const inBlacklist = domainMatchesList(domain, state.blacklist);
  const essential = isEssentialCookie(cookie);
  const nameLower = (cookie.name || "").toLowerCase();

  const matchesTrackerName = TRACKER_NAME_KEYWORDS.some(keyword => nameLower.includes(keyword));
  const matchesTrackerDomain = TRACKER_DOMAIN_KEYWORDS.some(keyword => domain.includes(keyword));
  const qualifiesForAutoBlock = !inWhitelist && (matchesTrackerName || matchesTrackerDomain);
  const shouldAutoBlock = state.autoBlock && qualifiesForAutoBlock;
  const shouldBlacklistBlock = !state.autoBlock && inBlacklist;

  const shouldBlock =
    !essential &&
    (shouldAutoBlock || shouldBlacklistBlock);

  let statsChanged = false;

  if (shouldBlock) {
    const url = buildRemovalUrl(cookie);
    try {
      removalInProgress.add(key);
      const result = await chrome.cookies.remove({ url, name: cookie.name, storeId: cookie.storeId });
      if (result) {
        state.blocked++;
        removalInProgress.delete(key);
        statsChanged = true;
      } else {
        removalInProgress.delete(key);
      }
    } catch (err) {
      removalInProgress.delete(key);
      console.warn("[CSP] Failed to remove non-essential cookie", cookie.name, domain, err);
    }
  } else {
    state.allowed++;
    statsChanged = true;
  }

  if (statsChanged) await saveState();
}

// ----- Messages -----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch(msg.type) {
      case "GET_STATE":
        sendResponse({ success: true, state });
        break;

      case "GET_STATS":
        sendResponse({ success: true, stats: { blocked: state.blocked, allowed: state.allowed, bannersRemoved: state.bannersRemoved } });
        break;

      case "UPDATE_STATE":
        if (msg.state) state = { ...state, ...msg.state };
        await saveState();
        sendResponse({ success: true, state });
        break;

      case "BLOCK_SITE": {
        const domain = msg.domain;
        if (!state.blacklist.includes(domain)) state.blacklist.push(domain);
        const idx = state.whitelist.indexOf(domain);
        if (idx !== -1) state.whitelist.splice(idx, 1);
        await updateRules(state.blacklist.map(d => createBlockRule(d)));
        await saveState();
        sendResponse({ success: true, stats: state });
        break;
      }

      case "WHITELIST_SITE": {
        const domain = msg.domain;
        if (!state.whitelist.includes(domain)) state.whitelist.push(domain);
        const idx = state.blacklist.indexOf(domain);
        if (idx !== -1) state.blacklist.splice(idx, 1);
        await updateRules(state.blacklist.map(d => createBlockRule(d)));
        await saveState();
        sendResponse({ success: true, stats: state });
        break;
      }

      case "LOG_BANNER_REMOVED":
        state.bannersRemoved += msg.count || 1;
        await saveState();
        sendResponse({ success: true, stats: state });
        break;

      default:
        sendResponse({ success: false });
    }
  })();
  return true;
});

// ----- Cookie tracking -----
chrome.cookies.onChanged.addListener(change => {
  handleCookieChange(change).catch(err => console.error("[CSP] Cookie handler error", err));
});

// Sync every 5 minutes
setInterval(() => Storage.syncToCloud(), 5*60*1000);

// Sync on suspend
chrome.runtime.onSuspend.addListener(() => {
  Storage.syncToCloud();
});
