
import { addSiteToWhitelist } from "./whitelist.js";

(() => {
  // State management
  let extensionState = {
    enabled: true,
    blockedCount: 0,
    allowedCount: 0,
    bannersRemoved: 0,
    whitelist: [],
    settings: {
      strictMode: true,
      removeBanners: true,
      notificationLevel: 'detailed',
      autoWhitelist: false,
      privacyMode: false
    }
  };

  // DOM elements
  let elements = {};

  // Initialize the extension
  window.addEventListener("load", init);

  async function addSiteToWhitelistUI() {
    const domain = elements.siteInput.value.trim().toLowerCase();
    addSiteToWhitelist(domain, elements.whitelistList, {
      getItem: () => JSON.stringify(extensionState.whitelist),
      setItem: (_k, v) => { extensionState.whitelist = JSON.parse(v); }
    });
    // ... saveState/updateUI/etc.
  }

  async function init() {
    // Cache DOM elements
    elements = {
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText'),
      mainToggle: document.getElementById('mainToggle'),
      blockedCount: document.getElementById('blockedCount'),
      allowedCount: document.getElementById('allowedCount'),
      bannersRemoved: document.getElementById('bannersRemoved'),
      addSiteBtn: document.getElementById('addSiteBtn'),
      addSiteConfirm: document.getElementById('addSiteConfirm'),
      siteInput: document.getElementById('siteInput'),
      whitelistList: document.getElementById('whitelistList'),
      importBlocklistBtn: document.getElementById('importBlocklistBtn'),
      strictMode: document.getElementById('strictMode'),
      removeBanners: document.getElementById('removeBanners'),
      blocklistFile: document.getElementById('blocklistFile'),
      fileDropZone: document.getElementById('fileDropZone'),
      notificationLevel: document.getElementById('notificationLevel'),
      autoWhitelist: document.getElementById('autoWhitelist'),
      privacyMode: document.getElementById('privacyMode'),
      currentSiteUrl: document.getElementById('currentSiteUrl'),
      whitelistCurrentBtn: document.getElementById('whitelistCurrentBtn'),
      blockCurrentBtn: document.getElementById('blockCurrentBtn'),
      helpBtn: document.getElementById('helpBtn'),
      aboutBtn: document.getElementById('aboutBtn')
    };

    

    // Load saved state
    await loadState();

    // Set up event listeners
    setupEventListeners();

    // Update UI
    updateUI();

    // Get current tab info
    await updateCurrentSite();
  }



  async function loadState() {
    try {
      const result = await chrome.storage.sync.get(['extensionState']);
      if (result.extensionState) {
        extensionState = { ...extensionState, ...result.extensionState };
      }
    } catch (error) {
      console.error('Error loading state:', error);
    }
  }

  async function saveState() {
    try {
      await chrome.storage.sync.set({ extensionState });
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  function setupEventListeners() {
    // Main toggle
    elements.mainToggle.addEventListener('change', async (e) => {
      extensionState.enabled = e.target.checked;
      await saveState();
      updateUI();
      showNotification(extensionState.enabled ? 'Extension enabled' : 'Extension disabled');
    });

    // Add site to whitelist
    elements.addSiteBtn.addEventListener('click', () => {
      elements.siteInput.style.display = elements.siteInput.style.display === 'none' ? 'block' : 'none';
      elements.addSiteConfirm.style.display = elements.addSiteConfirm.style.display === 'none' ? 'block' : 'none';
    });

    elements.addSiteConfirm.addEventListener('click', addSiteToWhitelist);
    elements.siteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addSiteToWhitelist();
    });

    // Blocklist management
    elements.importBlocklistBtn.addEventListener('click', () => {
      elements.blocklistFile.click();
    });

    elements.blocklistFile.addEventListener('change', handleFileImport);

    // File drop zone
    elements.fileDropZone.addEventListener('click', () => {
      elements.blocklistFile.click();
    });

    elements.fileDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      elements.fileDropZone.classList.add('dragover');
    });

    elements.fileDropZone.addEventListener('dragleave', () => {
      elements.fileDropZone.classList.remove('dragover');
    });

    elements.fileDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      elements.fileDropZone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileImport({ target: { files } });
      }
    });

    // Settings
    elements.strictMode.addEventListener('change', async (e) => {
      extensionState.settings.strictMode = e.target.checked;
      await saveState();
    });

    elements.removeBanners.addEventListener('change', async (e) => {
      extensionState.settings.removeBanners = e.target.checked;
      await saveState();
    });

    elements.notificationLevel.addEventListener('change', async (e) => {
      extensionState.settings.notificationLevel = e.target.value;
      await saveState();
    });

    elements.autoWhitelist.addEventListener('change', async (e) => {
      extensionState.settings.autoWhitelist = e.target.checked;
      await saveState();
    });

    elements.privacyMode.addEventListener('change', async (e) => {
      extensionState.settings.privacyMode = e.target.checked;
      await saveState();
    });

    // Current site actions
    elements.whitelistCurrentBtn.addEventListener('click', whitelistCurrentSite);
    elements.blockCurrentBtn.addEventListener('click', blockCurrentSite);

    // Footer buttons
    elements.helpBtn.addEventListener('click', showHelp);
    elements.aboutBtn.addEventListener('click', showAbout);

  // Dashboard Button 
    elements.dashboardBtn = document.getElementById('dashboardBtn');
    elements.dashboardBtn.addEventListener('click', openDashboard);


  }

  function updateUI() {
    // Update status indicator
    if (extensionState.enabled) {
      elements.statusDot.style.background = '#48bb78';
      elements.statusText.textContent = 'Active';
      elements.statusText.style.color = '#48bb78';
    } else {
      elements.statusDot.style.background = '#f56565';
      elements.statusText.textContent = 'Disabled';
      elements.statusText.style.color = '#f56565';
    }

    // Update main toggle
    elements.mainToggle.checked = extensionState.enabled;

    // Update statistics
    elements.blockedCount.textContent = extensionState.blockedCount;
    elements.allowedCount.textContent = extensionState.allowedCount;
    elements.bannersRemoved.textContent = extensionState.bannersRemoved;

    // Update settings
    elements.strictMode.checked = extensionState.settings.strictMode;
    elements.removeBanners.checked = extensionState.settings.removeBanners;
    elements.notificationLevel.value = extensionState.settings.notificationLevel;
    elements.autoWhitelist.checked = extensionState.settings.autoWhitelist;
    elements.privacyMode.checked = extensionState.settings.privacyMode;

    // Update whitelist
    updateWhitelistDisplay();
  }

  function updateWhitelistDisplay() {
    elements.whitelistList.innerHTML = '';
    
    if (extensionState.whitelist.length === 0) {
      elements.whitelistList.innerHTML = '<p style="text-align: center; color: #a0aec0; font-size: 14px; padding: 20px;">No trusted sites added yet</p>';
      return;
    }

    extensionState.whitelist.forEach((site, index) => {
      const item = document.createElement('div');
      item.className = 'whitelist-item';
      item.innerHTML = `
        <span class="site-domain">${site}</span>
        <button class="remove-btn" data-index="${index}">×</button>
      `;
      
      item.querySelector('.remove-btn').addEventListener('click', () => {
        removeSiteFromWhitelist(index);
      });
      
      elements.whitelistList.appendChild(item);
    });
  }

  async function addSiteToWhitelist() {
    const domain = elements.siteInput.value.trim().toLowerCase();
    
    if (!domain) {
      showNotification('Please enter a domain', 'error');
      return;
    }

    // Basic domain validation
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(domain)) {
      showNotification('Please enter a valid domain', 'error');
      return;
    }

    if (extensionState.whitelist.includes(domain)) {
      showNotification('Domain already in whitelist', 'error');
      return;
    }

    extensionState.whitelist.push(domain);
    await saveState();
    updateWhitelistDisplay();
    
    elements.siteInput.value = '';
    elements.siteInput.style.display = 'none';
    elements.addSiteConfirm.style.display = 'none';
    
    showNotification(`Added ${domain} to whitelist`);
  }

  async function removeSiteFromWhitelist(index) {
    const domain = extensionState.whitelist[index];
    extensionState.whitelist.splice(index, 1);
    await saveState();
    updateWhitelistDisplay();
    showNotification(`Removed ${domain} from whitelist`);
  }

  async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      let domains = [];

      if (file.name.endsWith('.json')) {
        const data = JSON.parse(text);
        domains = Array.isArray(data) ? data : data.domains || [];
      } else if (file.name.endsWith('.txt')) {
        domains = text.split('\n').map(line => line.trim()).filter(line => line);
      }

      if (domains.length > 0) {
        // Add domains to whitelist (or create a separate blocklist)
        extensionState.whitelist = [...new Set([...extensionState.whitelist, ...domains])];
        await saveState();
        updateWhitelistDisplay();
        showNotification(`Imported ${domains.length} domains`);
      } else {
        showNotification('No valid domains found in file', 'error');
      }
    } catch (error) {
      console.error('Error importing file:', error);
      showNotification('Error importing file', 'error');
    }

    // Reset file input
    elements.blocklistFile.value = '';
  }

  async function updateCurrentSite() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const url = new URL(tab.url);
        elements.currentSiteUrl.textContent = url.hostname;
        
        // Check if current site is whitelisted
        const isWhitelisted = extensionState.whitelist.includes(url.hostname);
        elements.whitelistCurrentBtn.textContent = isWhitelisted ? 'Remove from Whitelist' : 'Add to Whitelist';
        elements.whitelistCurrentBtn.style.display = 'block';
        elements.blockCurrentBtn.style.display = 'block';
      } else {
        elements.currentSiteUrl.textContent = 'No active tab';
        elements.whitelistCurrentBtn.style.display = 'none';
        elements.blockCurrentBtn.style.display = 'none';
      }
    } catch (error) {
      console.error('Error getting current tab:', error);
      elements.currentSiteUrl.textContent = 'Unable to access tab';
    }
  }

  async function whitelistCurrentSite() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const url = new URL(tab.url);
        const domain = url.hostname;
        
        const index = extensionState.whitelist.indexOf(domain);
        if (index > -1) {
          // Remove from whitelist
          extensionState.whitelist.splice(index, 1);
          showNotification(`Removed ${domain} from whitelist`);
        } else {
          // Add to whitelist
          extensionState.whitelist.push(domain);
          showNotification(`Added ${domain} to whitelist`);
        }
        
        await saveState();
        updateWhitelistDisplay();
        updateCurrentSite();
      }
    } catch (error) {
      console.error('Error updating whitelist:', error);
      showNotification('Error updating whitelist', 'error');
    }
  }

  async function blockCurrentSite() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const url = new URL(tab.url);
        const domain = url.hostname;
        
        // Remove from whitelist if present
        const index = extensionState.whitelist.indexOf(domain);
        if (index > -1) {
          extensionState.whitelist.splice(index, 1);
          await saveState();
          updateWhitelistDisplay();
        }
        
        showNotification(`Blocked cookies for ${domain}`);
        updateCurrentSite();
      }
    } catch (error) {
      console.error('Error blocking site:', error);
      showNotification('Error blocking site', 'error');
    }
  }

  

  function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? '#f56565' : '#48bb78'};
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  function showHelp() {
    showNotification('Help: Use the toggle to enable/disable the extension. Add trusted sites to the whitelist to allow cookies. Import blocklists to automatically block known tracking domains.');
  }

  function showAbout() {
    showNotification('CookiesShallNotPass v1.0.0 - Automatic cookie management for privacy-conscious users.');
  }
  //IMPLEMENT dashboard.html and dashboard.css
  function openDashboard() {
    const dashboardUrl = chrome.runtime.getURL('dashboard.html');
    chrome.tabs.create({ url: dashboardUrl });
  }
  


  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
    
    @keyframes slideOut {
      from {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      to {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
    }
  `;
  document.head.appendChild(style);

  // Simulate some activity for demo purposes
  setInterval(() => {
    if (extensionState.enabled && Math.random() > 0.7) {
      extensionState.blockedCount += Math.floor(Math.random() * 3) + 1;
      updateUI();
    }
  }, 5000);

})();

