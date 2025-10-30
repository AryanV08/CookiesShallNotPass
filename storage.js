// storage.js
let lastSyncedData = null;
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const Storage = {
  // ----- Core Local Storage Operations -----
  async get(key) {
    return new Promise(resolve => {
      chrome.storage.local.get([key], result => resolve(result[key]));
    });
  },

  async set(key, value) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [key]: value }, () => resolve(true));
    });
  },

  async remove(key) {
    return new Promise(resolve => {
      chrome.storage.local.remove([key], () => resolve(true));
    });
  },

  // ----- Load From Sync on Startup -----
  async loadFromSync() {
    return new Promise(resolve => {
      chrome.storage.sync.get(null, data => {
        if (data && Object.keys(data).length > 0) {
          chrome.storage.local.set(data, () => {
            console.log("✅ Loaded sync data into local cache");
            lastSyncedData = JSON.stringify(data);
            resolve(true);
          });
        } else {
          console.log("ℹ️ No sync data found to load");
          resolve(false);
        }
      });
    });
  },

  // ----- Periodic / Manual Sync to Cloud -----
  async syncToCloud() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(null, localData => {
        const currentData = JSON.stringify(localData);

        // Skip if nothing changed
        if (currentData === lastSyncedData) {
          console.log("🟡 No changes since last sync — skipping");
          return resolve(false);
        }

        chrome.storage.sync.set(localData, () => {
          if (chrome.runtime.lastError) {
            console.warn("⚠️ Sync failed:", chrome.runtime.lastError.message);
            return reject(chrome.runtime.lastError);
          }

          lastSyncedData = currentData;
          console.log("☁️ Synced local data → cloud successfully");
          resolve(true);
        });
      });
    });
  }
};
