// tests/setup/globals.js

// ---------- In-memory stores ----------
const __local = {};
const __sync  = {};
const clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

// ---------- Base chrome mock ----------
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
        } else if (typeof keys === 'object') { // defaults object
          for (const k of Object.keys(keys)) {
            out[k] = (__local[k] !== undefined) ? __local[k] : keys[k];
          }
        }
        cb(out);
      },
      set(obj, cb = () => {}) { Object.assign(__local, clone(obj)); cb(); },
      remove(keys, cb = () => {}) {
        (Array.isArray(keys) ? keys : [keys]).forEach(k => delete __local[k]);
        cb();
      },
      clear(cb = () => {}) { for (const k of Object.keys(__local)) delete __local[k]; cb(); }
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
      set(obj, cb = () => {}) { Object.assign(__sync, clone(obj)); cb(); },
      clear(cb = () => {}) { for (const k of Object.keys(__sync)) delete __sync[k]; cb(); }
    },

    // expose for tests
    __local,
    __sync,

    // events
    onChanged: {
      _listeners: [],
      addListener(fn) { this._listeners.push(fn); },
      _dispatch(changes, areaName = 'local') {
        for (const fn of this._listeners) fn(changes, areaName);
      }
    }
  },

  runtime: {
    onMessage: {
      _listeners: [],
      addListener(fn) { this._listeners.push(fn); },
      // internal helper used by our sendMessage mock
      _dispatch(message, sender = {}, sendResponse = () => {}) {
        let claimedAsync = false;
        for (const fn of this._listeners) {
          const ret = fn(message, sender, sendResponse);
          if (ret === true) claimedAsync = true; // chrome indicates async by returning true
        }
        return claimedAsync;
      }
    },
    onInstalled: { addListener() {} },
    onSuspend:   { addListener() {} },

    // routes messages to listeners & behaves async
    sendMessage: (msg, cb = () => {}) => {
      setTimeout(() => {
        const claimed = chrome.runtime.onMessage._dispatch(
          msg,
          { id: 0 },           // fake sender
          (resp) => cb(resp)   // bridge sendResponse -> callback
        );
        // If no listener claimed async and none responded synchronously,
        // provide a harmless default so tests don’t hang.
        if (!claimed) setTimeout(() => cb({ ok: true }), 0);
      }, 0);
    },

    getURL: (rel) => `chrome-extension://test/${rel}`
  },

  tabs: {
    _sent: [],
    _created: [],
    // support both callback and promise styles
    query(queryInfo, cb) {
      const tabs = [{ id: 1, url: 'https://example.com/path' }];
      return (typeof cb === 'function') ? cb(tabs) : Promise.resolve(tabs);
    },
    sendMessage(tabId, msg, cb = () => {}) { chrome.tabs._sent.push({ tabId, msg }); cb(); },
    create(props, cb = () => {}) { chrome.tabs._created.push(props); cb({ id: 2, ...props }); }
  },

  // --- DNR mock: async getDynamicRules + updateDynamicRules
  declarativeNetRequest: {
    _rules: [],   // current dynamic rules
    _last: null,  // last update request (for assertions)

    async getDynamicRules() {
      return this._rules.slice();
    },

    async updateDynamicRules({ addRules = [], removeRuleIds = [] } = {}) {
      if (removeRuleIds.length) {
        this._rules = this._rules.filter(r => !removeRuleIds.includes(r.id));
      }
      if (addRules.length) {
        this._rules.push(...addRules.map(r => JSON.parse(JSON.stringify(r))));
      }
      this._last = {
        addRules: addRules.map(r => JSON.parse(JSON.stringify(r))),
        removeRuleIds: [...removeRuleIds]
      };
    }
  },

  alarms: {
    _created: [],
    create(name, info) { this._created.push({ name, info }); },
    clear(_name, cb = () => {}) { cb(true); },
    onAlarm: {
      _listeners: [],
      addListener(fn) { this._listeners.push(fn); },
      _dispatch(alarm) { for (const fn of this._listeners) fn(alarm); }
    }
  },

  action: {
    setBadgeText: (_opts, _cb) => {},
    setBadgeBackgroundColor: (_opts, _cb) => {}
  },

  cookies: {
    onChanged: {
      _listeners: [],
      addListener(fn) { this._listeners.push(fn); },
      _dispatch(change) { for (const fn of this._listeners) fn(change); }
    }
  }
};

// ---------- Globals used in UI/tests ----------
global.console = console;
global.window  = global.window || {};
window.__TEST__ = true;
global.alert   = global.alert || (() => {});

// ---------- Safety net: clear any stray intervals so Mocha exits ----------
(() => {
  const realSet = global.setInterval;
  const realClr = global.clearInterval;
  const ids = [];

  global.setInterval = (...args) => {
    const id = realSet(...args);
    ids.push(id);
    return id;
  };

  global.clearInterval = (id) => {
    const i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1);
    return realClr(id);
  };

  const cleanup = () => ids.slice().forEach(id => realClr(id));

  // Prefer Mocha hook if available; otherwise fall back to process exit.
  if (typeof global.after === 'function') {
    global.after(cleanup);
  } else if (typeof after === 'function') {
    after(cleanup);
  } else {
    process.on('exit', cleanup);
  }
})();