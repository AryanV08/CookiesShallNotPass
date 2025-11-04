// tests/setup/globals.js

// In-memory stores for test
const __local = {};
const __sync = {};
const clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

global.chrome = {
  storage: {
    local: {
      get(keys, cb) {
        const out = {};
        if (!keys) {
          Object.assign(out, __local);
        } else if (Array.isArray(keys)) {
          keys.forEach(k => { out[k] = __local[k]; });
        } else if (typeof keys === 'string') {
          out[keys] = __local[keys];
        } else if (typeof keys === 'object') {
          // get with defaults object: return found or defaults
          for (const k of Object.keys(keys)) {
            out[k] = (__local[k] !== undefined) ? __local[k] : keys[k];
          }
        }
        cb(out);
      },
      set(obj, cb = () => {}) {
        Object.keys(obj).forEach(k => { __local[k] = clone(obj[k]); });
        cb();
      },
      remove(keys, cb = () => {}) {
        (Array.isArray(keys) ? keys : [keys]).forEach(k => { delete __local[k]; });
        cb();
      },
      clear(cb = () => {}) {
        for (const k of Object.keys(__local)) delete __local[k];
        cb();
      }
    },
    sync: {
      get(keys, cb) {
        const out = {};
        if (!keys) {
          Object.assign(out, __sync);
        } else if (Array.isArray(keys)) {
          keys.forEach(k => { out[k] = __sync[k]; });
        } else if (typeof keys === 'string') {
          out[keys] = __sync[keys];
        } else if (typeof keys === 'object') {
          for (const k of Object.keys(keys)) {
            out[k] = (__sync[k] !== undefined) ? __sync[k] : keys[k];
          }
        }
        cb(out);
      },
      set(obj, cb = () => {}) {
        Object.keys(obj).forEach(k => { __sync[k] = clone(obj[k]); });
        cb();
      },
      clear(cb = () => {}) {
        for (const k of Object.keys(__sync)) delete __sync[k];
        cb();
      }
    },
    // expose for tests
    __local,
    __sync
  },
  declarativeNetRequest: {
    updateDynamicRules({ addRules = [], removeRuleIds = [] }, cb = () => {}) {
      chrome.declarativeNetRequest._last = { addRules: clone(addRules), removeRuleIds: clone(removeRuleIds) };
      cb();
    }
  },
  runtime: {
    onMessage: {
      _listeners: [],
      addListener(fn) { this._listeners.push(fn); },
      // test helper
      _dispatch(message, sender = {}, sendResponse = () => {}) {
        for (const fn of this._listeners) {
          const ret = fn(message, sender, sendResponse);
          if (ret === true) return true;
        }
      }
    },
    onInstalled: { addListener() {} },
    onSuspend: { addListener() {} }
  },
  tabs: {
    _sent: [],
    query(queryInfo, cb) { cb([{ id: 1, url: 'https://example.com' }]); },
    sendMessage(tabId, msg, cb = () => {}) { chrome.tabs._sent.push({ tabId, msg }); cb(); }
  }
};

global.console = console;
global.window = global.window || {};
window.__TEST__ = true;
