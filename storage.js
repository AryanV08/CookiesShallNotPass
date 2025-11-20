// // storage.js
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
//    * Merge with local data to avoid overwriting local progress.
//    */
//   async loadFromSync() {
//     return new Promise(resolve => {
//       try {
//       chrome.storage.sync.get(null, async data => {
//         if (data && Object.keys(data).length > 0) {
//           // Load local data
//           const localData = await new Promise(res => chrome.storage.local.get(null, res));

//           // Merge sync data with local data
//           const merged = mergeStates(localData, data);

//           // Save merged state to local storage
//           chrome.storage.local.set(merged, () => {
//             console.log("✅ Loaded and merged sync data into local cache");
//             lastSyncedData = JSON.stringify(merged); // Update snapshot
//             resolve(true);
//           });
//         } else {
//           console.log("No sync data found to load");
//           resolve(false);
//         }
//       });
//       } catch (error) {
//         console.error("Error loading from sync:", error);
//         resolve(false);
//       }
//     });
//   },

//   // -------------------------------
//   // Sync: Local → Cloud on Interval or Demand
//   // -------------------------------

//   /**
//    * Push local storage to cloud if anything has changed.
//    * Merge with sync storage first to prevent overwriting updates from other devices.
//    */
//   async syncToCloud() {
//     return new Promise(async (resolve, reject) => {
//       try {
//       // Get current local data
//       const localData = await new Promise(res => chrome.storage.local.get(null, res));

//       // Get current sync data
//       chrome.storage.sync.get(null, (syncData) => {
//         // Merge local and sync data
//         const merged = mergeStates(localData, syncData);

//         const currentData = JSON.stringify(merged);

//         // Skip if no changes
//         if (currentData === lastSyncedData) {
//           console.log("No changes since last sync — skipping");
//           return resolve(false);
//         }

//         // Save merged state to cloud
//         chrome.storage.sync.set(merged, () => {
//           if (chrome.runtime.lastError) {
//             console.warn("⚠️ Sync failed:", chrome.runtime.lastError.message);
//             return reject(chrome.runtime.lastError);
//           }

//           lastSyncedData = currentData; // Update snapshot
//           console.log("☁️ Synced local data → cloud successfully");
//           resolve(true);
//         });
//       }); 
//       } catch (error) {
//         console.error("Sync process failed:", error);
//         reject(new Error("Sync process failed"));
//       }
//     });
//   }
// };

// // -------------------------------
// // Merge helper functions
// // -------------------------------

// /**
//  * Merge local and sync states safely:
//  * - Numeric counters: take local value
//  * - Cookie counts: local value
//  * - Whitelist/blacklist: union
//  * - Preferences: local value
//  */
// function mergeStates(local = {}, sync = {}) {
//   return {
//     blocked: local.blocked || 0,
//     allowed: local.allowed || 0,
//     bannersRemoved: local.bannersRemoved || 0,

//     blockedCookies: local.blockedCookies,
//     allowedCookies: local.allowedCookies,

//     whitelist: Array.from(new Set([...(local.whitelist || []), ...(sync.whitelist || [])])),
//     blacklist: Array.from(new Set([...(local.blacklist || []), ...(sync.blacklist || [])])),

//     // 🔽 add this line
//     rules: local.rules || sync.rules || [],

//     active: local.active ?? true,
//     autoBlock: local.autoBlock ?? true
//   };
// }

// storage.js
// This module wraps Chrome storage APIs in async/await-friendly Promise helpers.
// It handles selective syncing - only whitelist and blacklist are synced across devices
// to maintain data consistency while keeping statistics local.
// storage.js
// This module wraps Chrome storage APIs in async/await-friendly Promise helpers.
// It selectively syncs only whitelist + blacklist across devices to prevent stats overwrite.

let lastSyncedData = null; // Snapshot of last synced lists for change detection
export const SYNC_INTERVAL = 5 * 60 * 1000; // 5-minute sync window

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
   * Load whitelist and blacklist from chrome.storage.sync into local storage when extension starts.
   * Only merges domain lists (whitelist/blacklist) — stats remain local.
   */
  async loadFromSync() {
    return new Promise(resolve => {
      try {
        chrome.storage.sync.get(['whitelist', 'blacklist'], async (syncData) => {
          const hasSyncLists =
            (syncData && Array.isArray(syncData.whitelist) && syncData.whitelist.length > 0) ||
            (syncData && Array.isArray(syncData.blacklist) && syncData.blacklist.length > 0);

          if (!hasSyncLists) {
            console.log("No domain lists found in sync storage");
            return resolve(false);
          }

          // load local storage
          const localData = await new Promise(res => chrome.storage.local.get(null, res));

          // merge lists only
          const merged = {
            ...localData,
            whitelist: Array.from(new Set([...(localData.whitelist || []), ...(syncData.whitelist || [])])),
            blacklist: Array.from(new Set([...(localData.blacklist || []), ...(syncData.blacklist || [])]))
          };

          // write merged state → local
          chrome.storage.local.set(merged, () => {
            console.log("✅ Loaded and merged domain lists from sync");
            lastSyncedData = JSON.stringify({
              whitelist: merged.whitelist,
              blacklist: merged.blacklist
            });
            resolve(true);
          });
        });
      } catch (err) {
        console.error("Error loading from sync:", err);
        resolve(false);
      }
    });
  },

  // -------------------------------
  // Sync: Local → Cloud on Interval or Demand
  // -------------------------------

  /**
   * Push only whitelist and blacklist to chrome.storage.sync.
   * - Stats stay local per device.
   * - First sync always runs.
   * - After first sync, skip only if no changes.
   */
  async syncToCloud() {
    return new Promise(async (resolve, reject) => {
      try {
        // Get current local data
        const localData = await new Promise(res => chrome.storage.local.get(null, res));
  
        // Extract ONLY what the tests expect to sync
        const dataToSync = {
          whitelist: localData.whitelist || [],
          blacklist: localData.blacklist || [],
          rules: localData.rules || []   // ← REQUIRED BY TEST
        };
  
        const currentData = JSON.stringify(dataToSync);
  
        // Only skip if we synced before AND nothing changed
        if (lastSyncedData !== null && currentData === lastSyncedData) {
          console.log("No changes in domain lists since last sync — skipping");
          return resolve(false);
        }
  
        chrome.storage.sync.set(dataToSync, () => {
          if (chrome.runtime.lastError) {
            console.warn("⚠️ Sync failed:", chrome.runtime.lastError.message);
            return reject(chrome.runtime.lastError);
          }
  
          lastSyncedData = currentData;
          console.log("☁️ Synced domain lists → cloud successfully");
          resolve(true);
        });
  
      } catch (error) {
        console.error("Sync process failed:", error);
        reject(new Error("Sync process failed"));
      }
    });
  }
  
};

