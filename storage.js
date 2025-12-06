// storage.js
// Chrome storage wrapper with smart sync for domain lists

export const SYNC_INTERVAL = 30 * 1000; // 30 seconds debounce interval

// The debouncer timer ID
let syncTimeout = null;
// Optimistic Lock/Flag to prevent self-triggering during a write
let isWritingToSync = false;

// Keys we want to sync (ONLY the lists)
const SYNCABLE_KEYS = [
    'blacklist', 'whitelist'
];

export const Storage = {
  // Local Storage Helpers (Immediate R/W)
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

  async syncToCloud() {
    // Only sync list keys to stay within sync quotas
    const lists = await new Promise(resolve => {
      chrome.storage.local.get(SYNCABLE_KEYS, resolve);
    });

    await new Promise(resolve => {
      chrome.storage.sync.set({
        whitelist: lists.whitelist || [],
        blacklist: lists.blacklist || []
      }, () => resolve(true));
    });

    return true;
  },
  
  // Helper function to perform the actual write logic (used by scheduleSync and forceSyncNow)
  async _performSyncWrite(currentState) {
    // Clear any pending scheduled sync, as we are running it now
    if (syncTimeout) {
        clearTimeout(syncTimeout);
        syncTimeout = null;
    }
    
    isWritingToSync = true;
    
    try {
        console.log("[CSP] Initiating cloud list write.");

        // Prepare only the lists
        const listsToSync = {
            whitelist: currentState.whitelist || [],
            blacklist: currentState.blacklist || []
        };
        
        // Write the lists to sync storage
        await new Promise(resolve => {
            chrome.storage.sync.set(listsToSync, () => {
                if (chrome.runtime.lastError) {
                    console.error("Cloud Sync failed:", chrome.runtime.lastError);
                } else {
                    console.log("Lists successfully written to cloud!");
                }
                resolve();
            });
        });

    } catch (error) {
        console.error("Error during sync write:", error);
    } finally {
        // Release the write "lock" after a small delay
        setTimeout(() => {
            isWritingToSync = false;
        }, 500);
    }
  },

  // Initial State Merge Logic (Handles First Run)
  // Ensures local state is consistent with sync storage upon initialization.
  async mergeOrInitState() {
    // Provide a robust default state structure if 'state' is not found locally
    let localState = await this.get('state') || {
      blocked: 0,
      allowed: 0,
      bannersRemoved: 0,
      blacklist: [],
      whitelist: [],
      active: true,
      autoBlock: true,
      autoBannerRemoval: true,
      savedBlockerState: null,
      aggresivietyLevel: 'standard',
      theme: 'dark',
      allowedCookies: {},
      blockedCookies: {}
    };
    
    // Check Sync Storage for existing lists
    const syncResult = await new Promise(resolve => {
        chrome.storage.sync.get(SYNCABLE_KEYS, resolve);
    });
    
    // Check if Sync has any data for the lists
    const syncHasData = (syncResult.whitelist && syncResult.whitelist.length > 0) || 
                        (syncResult.blacklist && syncResult.blacklist.length > 0);

    if (!syncHasData) {
        // Case: Sync is not defined (First Run/Empty). Overwrite Sync with Local.
        console.log("[CSP] Sync storage empty. Initializing Sync from Local State.");
        
        // Prepare lists for sync
        const listsToSync = {
            whitelist: localState.whitelist || [],
            blacklist: localState.blacklist || []
        };
        
        // Overwrite sync with local lists
        await new Promise(resolve => {
            chrome.storage.sync.set(listsToSync, resolve);
        });

        return localState;

    } else {
        // Case: Sync is defined. Overwrite Local lists from Sync.
        console.log("[CSP] Sync storage found. Overwriting Local Lists from Sync.");

        // Overwrite local lists with synced lists
        const mergedState = {
            ...localState,
            whitelist: syncResult.whitelist || [],
            blacklist: syncResult.blacklist || []
        };
        
        await this.set('state', mergedState);

        return mergedState;
    }
  },

  // Local -> Sync Overwrite (Delayed Write Handler)
  // Schedules a state sync to Chrome Sync Storage after a debounce period.
  scheduleSync(currentState) {
    if (syncTimeout) {
        clearTimeout(syncTimeout);
    }
    
    // Set a timeout to run the sync write logic
    syncTimeout = setTimeout(() => {
        this._performSyncWrite(currentState);
    }, SYNC_INTERVAL);
  },

  // Local -> Sync Overwrite (IMMEDIATE Write Handler)
  // Forces an immediate state sync to Chrome Sync Storage. Used on extension suspend.
  async forceSyncNow(currentState) {
    // Immediately run the sync write logic
    return this._performSyncWrite(currentState);
  },

  // Sync -> Local Overwrite (Read Handler)
  // Fetches Sync lists and overwrites the corresponding lists in the Local cache.
  async overwriteLocalWithSync() {
    if (isWritingToSync) {
        console.log("[CSP] Sync-to-Local skipped: Currently writing to Sync storage.");
        return;
    }
    
    try {
        // Retrieve Sync storage lists (Source of Truth)
        const syncResult = await new Promise(resolve => {
            chrome.storage.sync.get(SYNCABLE_KEYS, resolve);
        });
        
        // Retrieve current local state (to preserve local settings/counters)
        const localState = await this.get('state') || {
          blocked: 0,
          allowed: 0,
          bannersRemoved: 0,
          blacklist: [],
          whitelist: [],
          active: true,
          autoBlock: true,
          autoBannerRemoval: true,
          savedBlockerState: null,
          aggresivietyLevel: 'standard',
          theme: 'dark',
          allowedCookies: {},
          blockedCookies: {}
        };

        // Overwrite only the lists in the local cache
        const cachedState = {
            ...localState, 
            whitelist: syncResult.whitelist || [],
            blacklist: syncResult.blacklist || []
        };

        await this.set('state', cachedState);
        console.log("Local lists successfully updated from cloud sync data!");
        
        return cachedState;

    } catch (error) {
        console.error("Error during Sync-to-Local overwrite:", error);
    }
  }
};
