export function addSiteToWhitelist(domain, whitelistListEl, storage) {
    if (!domain || !/^[\w.-]+$/.test(domain)) return false;
  
    const whitelist = JSON.parse(storage.getItem("whitelist") || "[]");
    if (!whitelist.includes(domain)) {
      whitelist.push(domain);
      storage.setItem("whitelist", JSON.stringify(whitelist));
  
      if (whitelistListEl && typeof document !== 'undefined') {
        const item = document.createElement("div");
        item.className = "whitelist-item";
        item.textContent = domain;
        whitelistListEl.appendChild(item);
      }
    }
    return true;
  }
  