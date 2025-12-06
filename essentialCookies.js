import { TRACKER_DOMAINS } from './rulesEngine.js';
// ---- Cookie classification lists by aggressiveness level ----

// ESSENTIAL KEYWORDS - Fewer keywords as aggressiveness increases
const essentialKeywords = {
  // LESS AGGRESSIVE: Broadest definition of essential cookies (most permissive)
  less: [
    'csrf', 'xsrf', 'session', 'auth', 'user_id', 'lang', 'theme', 'secure',
    'prefs', 'sessid', 'ssid', 'user', 'login', 'zipcode', 'country', 'currency', 
    'sid', 'uid', 'remember', 'verify', 'token', 'access_token', 'refresh_token', 
    'id_token', 'auth_token', 'jwt', 'oauth', 'sso', 'state', 'nonce', 'callback', 
    'redirect', 'cf_bm', 'cf_clearance', '__cf', 'authenticity_token', 'cart',
    'basket', 'checkout', 'shipping', 'payment', 'order', 'wishlist', 'favorite',
    'account', 'profile', 'settings', 'config', 'preference', 'consent',
    'ccpa', 'compliance', 'legal', 'terms', 'privacy', 'notification', 'alert',
    'message', 'sessionid', 'csrftoken','cf', '__cfruid'
  ],
  
  // STANDARD AGGRESSIVE: Balanced essential cookies
  standard: [
    'csrf', 'xsrf', 'session', 'auth', 'user_id', 'lang', 'theme', 'secure',
    'prefs', 'sessid', 'ssid', 'user', 'login', 'sid', 'uid', 'remember', 
    'verify', 'token', 'access_token', 'refresh_token', 'jwt', 'oauth', 'sso',
    'state', 'nonce', 'callback', 'redirect', 'cf_bm', 'cf_clearance', '__cf',
    'authenticity_token', 'cart', 'basket', 'checkout', 'shipping', 'payment', 'order'
  ],
  
  // MORE AGGRESSIVE: Strict definition - only core functionality (fewest essential cookies)
  more: [
    'csrf', 'xsrf', 'session', 'auth', 'user_id', 'sessid', 'ssid',
    'login', 'sid', 'uid', 'token', 'access_token', 'refresh_token', 'jwt',
    'oauth', 'cf_bm', 'cf_clearance', '__cf'
  ]
};

// NON-ESSENTIAL TRACKING COOKIES - More tracking blocked as aggressiveness increases
const nonEssentialTrackingCookies = {
  // LESS AGGRESSIVE: Only the most obvious trackers (fewest tracking cookies blocked)
  less: [
    'ga', '_ga','gid', '_gat', '_fbp', '_gcl_au', 'ga_', 'gtag',
    'fb_x', 'fr_', 'trk_', 'ads', 'adid', 'pixel', 'unauth', 'track', 'trk', 'geo'
  ],
  
  // STANDARD AGGRESSIVE: Common analytics and advertising
  standard: [
    'ga', '_ga', '_gid', '_gat', '_fbp', '_gcl_au', '_ym_uid', '_gaexp', 'ga', 
    'track', 'trk', 'ads', 'adid', 'adtrack', 'pixel', 'tag', '_utma', 
    '_utmb', '_utmc', '_utmz', '_utmv', '_hjid', 'amplitude_', 'mixpanel',
    'intercom', 'hotjar', 'pardot', 'hubspot', 'unauth', 'track', 'trk', 'geo'
  ],
  
  // MORE AGGRESSIVE: Extended tracking detection (most tracking cookies blocked)
  more: [
    'ga', '_ga', '_gid', '_gat', '_fbp', '_gcl_au', '_ym_uid', '_gaexp', 'ga', 
    'track', 'trk', 'ads', 'adid', 'adtrack', 'pixel', 'tag', '_utma', 
    '_utmb', '_utmc', '_utmz', '_utmv', '_hjid', 'amplitude_', 'mixpanel',
    'intercom', 'hotjar', 'pardot', 'hubspot', 'marketo', 'eloqua', 'drift', 
    'livechat', 'zopim', 'tracking', 'analytics', 'marketing', 'campaign', 
    'conversion', 'retargeting', 'remarketing', 'advertising', 'personalization',
    'optimizely', 'segment', 'kenshoo', 'marin', 'kissmetrics', 'crazyegg',
    'clicktale', 'luckyorange', 'inspectlet', 'mouseflow', 'sessioncam', 'unauth', 'track', 'trk', 'geo'
    
  ]
};

export function isEssential(cookie, state) {
  return new Promise((resolve) => {
    const name = (cookie?.name || '').toLowerCase();
    const aggressiveness = state.aggressivenessLevel || 'standard';

    console.log(`🔍 Checking cookie "${name}" with aggressiveness: ${aggressiveness}`);

    // 1) TRACKING COOKIE CHECK - MORE tracking blocked as aggressiveness increases
    const trackingCookiesToUse = nonEssentialTrackingCookies[aggressiveness] || nonEssentialTrackingCookies.standard;
    const isTrackingCookie = trackingCookiesToUse.some(trk => 
      name.startsWith(trk) || name.includes(trk)
    );
    
    if (isTrackingCookie) {
      console.log(`📊 Cookie "${name}" classified as NON-ESSENTIAL: Tracking cookie`);
      return resolve(false);
    }

    // 2) ESSENTIAL KEYWORD CHECK - FEWER keywords as aggressiveness increases
    const essentialKeywordsToUse = essentialKeywords[aggressiveness] || essentialKeywords.standard;
    const isEssentialByName = essentialKeywordsToUse.some(kw => name.includes(kw));
    
    if (isEssentialByName) {
      console.log(`🔐 Cookie "${name}" classified as ESSENTIAL: Matches essential keyword`);
      return resolve(true);
    }

    // 3) SECURITY ATTRIBUTE LOGIC - Stricter as aggressiveness increases
    if (!(globalThis.chrome?.tabs?.query)) {
      // Test environment logic
      let isEssentialByAttr;
      switch (aggressiveness) {
        case 'less':
          // Very permissive
          isEssentialByAttr = cookie?.httpOnly || cookie?.secure || !cookie?.expirationDate || cookie?.hostOnly;
          break;
        case 'more':
          // Most restrictive
          isEssentialByAttr = !cookie?.expirationDate ||
                              (cookie?.httpOnly && cookie?.secure) || 
                              (cookie?.hostOnly && cookie?.secure) || 
                              (cookie?.secure && (cookie?.sameSite === 'Strict' || cookie?.sameSite === 'Lax'));
          break;
        case 'standard':
        default:
          // Balanced
          isEssentialByAttr = !cookie?.expirationDate || 
                             (cookie?.httpOnly && cookie?.secure) || 
                             (cookie?.httpOnly && cookie?.hostOnly) || 
                             (cookie?.secure && cookie?.hostOnly) || 
                             (cookie?.hostOnly && (cookie?.sameSite === 'Strict' || cookie?.sameSite === 'Lax')) ||
                             (cookie?.httpOnly && (cookie?.sameSite === 'Strict' || cookie?.sameSite === 'Lax')) || 
                             (cookie?.secure && (cookie?.sameSite === 'Strict' || cookie?.sameSite === 'Lax'));
          break;
      }
      console.log(`🔐 Cookie "${name}" in test env, essential: ${isEssentialByAttr}`);
      return resolve(isEssentialByAttr);
    }

    // 4) BROWSER CONTEXT - Stricter third-party blocking as aggressiveness increases
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs?.[0];
      
      try {
        if (currentTab?.url && cookie?.domain) {
          const currentHost = new URL(currentTab.url).hostname;
          const cookieDomain = cookie.domain.replace(/^\./, '');
          
          const isSameSite = currentHost === cookieDomain || 
                            currentHost.endsWith('.' + cookieDomain) ||
                            cookieDomain.endsWith('.' + currentHost);
          
          if (!isSameSite) {
            const isKnownTracker = TRACKER_DOMAINS.some(tracker => 
              cookieDomain.includes(tracker) || tracker.includes(cookieDomain)
            );
            if (isKnownTracker) {
              console.log(`🚫 Cookie "${name}" blocked: Third-party cookie`, cookieDomain);
              return resolve(false);
            }
          }
        }
      } catch (error) {
        console.log(`❓ Cookie "${name}" - error in domain check, allowing`, error);
      }

      // 5) SECURITY ATTRIBUTE CHECK - Stricter as aggressiveness increases
      let isEssentialBySecurityAttrs;
      switch (aggressiveness) {
        case 'less':
          // Very permissive
          isEssentialBySecurityAttrs = cookie?.httpOnly || cookie?.secure || !cookie?.expirationDate || cookie?.hostOnly;
          break;
        case 'more':
          // Most restrictive
          isEssentialBySecurityAttrs = !cookie?.expirationDate ||
                              (cookie?.httpOnly && cookie?.secure) || 
                              (cookie?.hostOnly && cookie?.secure) || 
                              (cookie?.secure && (cookie?.sameSite === 'Strict' || cookie?.sameSite === 'Lax'));
          break;
        case 'standard':
        default:
          isEssentialBySecurityAttrs = !cookie?.expirationDate || 
                             (cookie?.httpOnly && cookie?.secure) || 
                             (cookie?.httpOnly && cookie?.hostOnly) || 
                             (cookie?.secure && cookie?.hostOnly) || 
                             (cookie?.hostOnly && (cookie?.sameSite === 'Strict' || cookie?.sameSite === 'Lax')) ||
                             (cookie?.httpOnly && (cookie?.sameSite === 'Strict' || cookie?.sameSite === 'Lax')) || 
                             (cookie?.secure && (cookie?.sameSite === 'Strict' || cookie?.sameSite === 'Lax'));
          break;
      }

      if (isEssentialBySecurityAttrs) {
        console.log(`🔐 Cookie "${name}" classified as ESSENTIAL: Security attributes or session`);
        return resolve(true);
      }

      // 6) FINAL DECISION - Stricter as aggressiveness increases
      switch (aggressiveness) {
        case 'less':
          // When in doubt, allow (most permissive)
          console.log(`⚠️ Cookie "${name}" - uncertain, allowing (less aggressive mode)`);
          return resolve(true);
        case 'more':
          // When in doubt, block (most restrictive)
          console.log(`🚫 Cookie "${name}" - uncertain, blocking (more aggressive mode)`);
          return resolve(false);
        case 'standard':
        default:
          // Balanced: block but log (you had this as false, which is more aggressive)
          console.log(`⚠️ Cookie "${name}" - uncertain, blocking to protect privacy (standard mode)`);
          return resolve(false);
      }
    });
  });
}