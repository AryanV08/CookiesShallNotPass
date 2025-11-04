// tests/ui/popup.test.js
import { expect } from 'chai';
import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('UI/popup.html'); // adjust if needed

const tick = () => new Promise(r => setTimeout(r, 0));
async function waitFor(check, { timeoutMs = 900, intervalMs = 15 } = {}) {
  const t0 = Date.now();
  for (;;) {
    if (check()) return;
    if (Date.now() - t0 > timeoutMs) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

describe('Popup UI', () => {
  let state;
  let calls;
  let origSend;
  let origAlert;
  let origCreate;

  beforeEach(async () => {
    // Load popup.html into the GLOBAL jsdom
    const html = fs.readFileSync(htmlPath, 'utf8');
    document.open();
    document.write(html);
    document.close();

    // baseline state for GET_STATE
    state = {
      blocked: 1,
      allowed: 2,
      bannersRemoved: 3,
      active: true,
      whitelist: [],
      blacklist: []
    };
    calls = [];

    // save originals to restore later
    origSend = chrome.runtime.sendMessage;
    origAlert = global.alert;
    origCreate = chrome.tabs.create;

    // capture alert text
    let lastAlert = null;
    global.alert = (msg) => { lastAlert = String(msg); };
    global.__getLastAlert = () => lastAlert;
    global.__clearLastAlert = () => { lastAlert = null; };

    // track created tabs
    chrome.tabs._created = [];
    chrome.tabs.create = (props, cb = () => {}) => {
      chrome.tabs._created.push(props);
      cb({ id: 999, ...props });
    };

    // mock sendMessage to emulate background responses used by popup
    chrome.runtime.sendMessage = (msg, cb = () => {}) => {
      calls.push(msg);
      setTimeout(() => {
        switch (msg.type) {
          case 'GET_STATE':
            cb({ success: true, state });
            return;
          case 'UPDATE_STATE':
            if (msg.state && typeof msg.state === 'object') {
              state = { ...state, ...msg.state };
            }
            cb({ success: true, state });
            return;
          case 'BLOCK_SITE': {
            const { domain } = msg;
            if (!state.blacklist.includes(domain)) state.blacklist.push(domain);
            state.whitelist = state.whitelist.filter(d => d !== domain);
            cb({ success: true, stats: state });
            return;
          }
          case 'WHITELIST_SITE': {
            const { domain } = msg;
            if (!state.whitelist.includes(domain)) state.whitelist.push(domain);
            state.blacklist = state.blacklist.filter(d => d !== domain);
            cb({ success: true, stats: state });
            return;
          }
          default:
            cb({ success: false });
        }
      }, 0);
    };

    // Import popup after DOM is ready
    await import('../../UI/popup.js');

    // Fire DOMContentLoaded so popup runs
    document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

    // Let initial GET_STATE/updateUI complete
    await tick();
  });

  afterEach(() => {
    chrome.runtime.sendMessage = origSend;
    chrome.tabs.create = origCreate;
    global.alert = origAlert;
    delete global.__getLastAlert;
    delete global.__clearLastAlert;
  });

  it('renders initial stats, toggle, and current site', async () => {
    // wait until updateUI paints (blockedCount changes from initial "0")
    await waitFor(() => document.getElementById('blockedCount').textContent !== '0');

    expect(document.getElementById('blockedCount').textContent).to.equal('1');
    expect(document.getElementById('allowedCount').textContent).to.equal('2');
    expect(document.getElementById('bannersRemoved').textContent).to.equal('3');

    expect(document.getElementById('extensionToggle').checked).to.equal(true);
    expect(document.getElementById('currentSite').textContent).to.equal('example.com');
  });

  it('toggling extensionToggle sends UPDATE_STATE(active)', async () => {
    const toggle = document.getElementById('extensionToggle');
    toggle.checked = false;
    toggle.dispatchEvent(new window.Event('change', { bubbles: true }));
    await tick();

    const last = calls.filter(c => c.type === 'UPDATE_STATE').pop();
    expect(last).to.exist;
    expect(last.state).to.deep.equal({ active: false });
  });

  it('clicking Whitelist sends WHITELIST_SITE and shows alert', async () => {
    __clearLastAlert();
    document.getElementById('whitelistBtn').click();
    await tick();

    const last = calls.filter(c => c.type === 'WHITELIST_SITE').pop();
    expect(last).to.exist;
    expect(last.domain).to.equal('example.com');
    expect(__getLastAlert()).to.match(/example\.com has been added to the whitelist/);
  });

  it('clicking Block sends BLOCK_SITE and shows alert', async () => {
    __clearLastAlert();
    document.getElementById('blockBtn').click();
    await tick();

    const last = calls.filter(c => c.type === 'BLOCK_SITE').pop();
    expect(last).to.exist;
    expect(last.domain).to.equal('example.com');
    expect(__getLastAlert()).to.match(/example\.com has been added to the blacklist/);
  });

  it('Dashboard button opens UI/dashboard.html in a new tab', async () => {
    document.getElementById('dashboardBtn').click();
    await tick();

    expect(chrome.tabs._created.length).to.be.greaterThan(0);
    const created = chrome.tabs._created.pop();
    expect(created.url).to.equal('chrome-extension://test/UI/dashboard.html');
  });
});