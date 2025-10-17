// Content script: hide cookie banners (simple MVP)
function hideCookieBanners() {
  // Look for common cookie banner selectors
  const selectors = [
    '[id*="cookie"]',
    '[class*="cookie"]',
    '[id*="consent"]',
    '[class*="consent"]',
    '[id*="banner"]',
    '[class*="banner"]'
  ];

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      el.style.display = 'none';
    });
  });
}

// Run on page load
hideCookieBanners();

// Optional: observe DOM changes for dynamically loaded banners
const observer = new MutationObserver(() => hideCookieBanners());
observer.observe(document.body, { childList: true, subtree: true });
