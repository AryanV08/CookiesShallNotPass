// // storage.js
// // This module wraps Chrome storage APIs in async/await-friendly Promise helpers.
// // It also handles syncing between local storage (fast, extension-local cache)
// // and Chrome sync storage (cloud-backed, shared across signed-in Chrome browsers).

// let lastSyncedData = null;                   // Snapshot of last synced state for change detection
// export const SYNC_INTERVAL = 5 * 60 * 1000;        // 5-minute sync window (not used in this file but referenced externally)

// export const Storage = {
//   // -------------------------------
//   // Local Storage Helpers
//   // -------------------------------

//   /**
//    * Retrieve a value from chrome.storage.local
//    * @param {string} key
//    * @returns {*} The stored value (or undefined if missing)
//    */
//   async get(key) {
//     return new Promise(resolve => {
//       chrome.storage.local.get([key], result => resolve(result[key]));
//     });
//   },

//   /**
//    * Store a key/value pair in chrome.storage.local
//    * @param {string} key
//    * @param {*} value
//    */
//   async set(key, value) {
//     return new Promise(resolve => {
//       chrome.storage.local.set({ [key]: value }, () => resolve(true));
//     });
//   },

//   /**
//    * Remove a key from chrome.storage.local
//    * @param {string} key
//    */
//   async remove(key) {
//     return new Promise(resolve => {
//       chrome.storage.local.remove([key], () => resolve(true));
//     });
//   },

//   // -------------------------------
//   // Sync: Cloud → Local on Startup
//   // -------------------------------

//   /**
//    * Load all data from chrome.storage.sync into local storage when extension starts.
//    * Great for cold-start consistency across devices signed into Chrome.
//    */
//   async loadFromSync() {
//     return new Promise(resolve => {
//       chrome.storage.sync.get(null, data => {
//         if (data && Object.keys(data).length > 0) {
//           // If sync has content, hydrate local cache with it
//           chrome.storage.local.set(data, () => {
//             console.log(" Loaded sync data into local cache");
//             lastSyncedData = JSON.stringify(data); // track snapshot for later comparison
//             resolve(true);
//           });
//         } else {
//           console.log(" No sync data found to load");
//           resolve(false);
//         }
//       });
//     });
//   },

//   // -------------------------------
//   // Sync: Local → Cloud on Interval or Demand
//   // -------------------------------

//   /**
//    * Push local storage to cloud if anything has changed.
//    * Avoids unnecessary sync calls by comparing snapshots.
//    */
//   async syncToCloud() {
//     return new Promise((resolve, reject) => {
//       chrome.storage.local.get(null, localData => {
//         const currentData = JSON.stringify(localData);

//         // Skip if there are no changes since last sync
//         if (currentData === lastSyncedData) {
//           console.log("No changes since last sync — skipping");
//           return resolve(false);
//         }

//         // Upload to sync storage
//         chrome.storage.sync.set(localData, () => {
//           if (chrome.runtime.lastError) {
//             console.warn("⚠️ Sync failed:", chrome.runtime.lastError.message);
//             return reject(chrome.runtime.lastError);
//           }

//           lastSyncedData = currentData; // update snapshot
//           console.log("☁️ Synced local data → cloud successfully");
//           resolve(true);
//         });
//       });
//     });
//   }
// };


// storage.js
// This module wraps Chrome storage APIs in async/await-friendly Promise helpers.
// It also handles syncing between local storage (fast, extension-local cache)
// and Chrome sync storage (cloud-backed, shared across signed-in Chrome browsers).

let lastSyncedData = null;                   // Snapshot of last synced state for change detection
export const SYNC_INTERVAL = 5 * 60 * 1000;        // 5-minute sync window (not used in this file but referenced externally)

export const Storage = {
  // -------------------------------
  // Local Storage Helpers
  // -------------------------------

  /**
   * Retrieve a value from chrome.storage.local
   * @param {string} key
   * @returns {*} The stored value (or undefined if missing)
   */
  async get(key) {
    return new Promise(resolve => {
      chrome.storage.local.get([key], result => resolve(result[key]));
    });
  },

  /**
   * Store a key/value pair in chrome.storage.local
   * @param {string} key
   * @param {*} value
   */
  async set(key, value) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [key]: value }, () => resolve(true));
    });
  },

  /**
   * Remove a key from chrome.storage.local
   * @param {string} key
   */
  async remove(key) {
    return new Promise(resolve => {
      chrome.storage.local.remove([key], () => resolve(true));
    });
  },

  // -------------------------------
  // Sync: Cloud → Local on Startup
  // -------------------------------

  /**
   * Load all data from chrome.storage.sync into local storage when extension starts.
   * Merge with local data to avoid overwriting local progress.
   */
  async loadFromSync() {
    return new Promise(resolve => {
      try {
      chrome.storage.sync.get(null, async data => {
        if (data && Object.keys(data).length > 0) {
          // Load local data
          const localData = await new Promise(res => chrome.storage.local.get(null, res));

          // Merge sync data with local data
          const merged = mergeStates(localData, data);

          // Save merged state to local storage
          chrome.storage.local.set(merged, () => {
            console.log("✅ Loaded and merged sync data into local cache");
            lastSyncedData = JSON.stringify(merged); // Update snapshot
            resolve(true);
          });
        } else {
          console.log("No sync data found to load");
          resolve(false);
        }
      });
      } catch (error) {
        console.error("Error loading from sync:", error);
        resolve(false);
      }
    });
  },

  // -------------------------------
  // Sync: Local → Cloud on Interval or Demand
  // -------------------------------

  /**
   * Push local storage to cloud if anything has changed.
   * Merge with sync storage first to prevent overwriting updates from other devices.
   */
  async syncToCloud() {
    return new Promise(async (resolve, reject) => {
      try {
      // Get current local data
      const localData = await new Promise(res => chrome.storage.local.get(null, res));

      // Get current sync data
      chrome.storage.sync.get(null, (syncData) => {
        // Merge local and sync data
        const merged = mergeStates(localData, syncData);

        const currentData = JSON.stringify(merged);

        // Skip if no changes
        if (currentData === lastSyncedData) {
          console.log("No changes since last sync — skipping");
          return resolve(false);
        }

        // Save merged state to cloud
        chrome.storage.sync.set(merged, () => {
          if (chrome.runtime.lastError) {
            console.warn("⚠️ Sync failed:", chrome.runtime.lastError.message);
            return reject(chrome.runtime.lastError);
          }

          lastSyncedData = currentData; // Update snapshot
          console.log("☁️ Synced local data → cloud successfully");
          resolve(true);
        });
      }); 
      } catch (error) {
        console.error("Sync process failed:", error);
        reject(new Error("Sync process failed"));
      }
    });
  }
};

// -------------------------------
// Merge helper functions
// -------------------------------

/**
 * Merge local and sync states safely:
 * - Numeric counters: take local value
 * - Cookie counts: local value
 * - Whitelist/blacklist: union
 * - Preferences: local value
 */
function mergeStates(local = {}, sync = {}) {
  return {
    blocked: local.blocked || 0,
    allowed: local.allowed || 0, 
    bannersRemoved: local.bannersRemoved || 0,

    blockedCookies: local.blockedCookies, 
    allowedCookies: local.allowedCookies, 

    whitelist: Array.from(new Set([...(local.whitelist || []), ...(sync.whitelist || [])])),
    blacklist: Array.from(new Set([...(local.blacklist || []), ...(sync.blacklist || [])])),

    active: local.active ?? true,      // Keep local preference
    autoBlock: local.autoBlock ?? true // Keep local preference
  };
}

