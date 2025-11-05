// tests/ui/dashboard.test.js
import { expect } from 'chai';
import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('UI/dashboard.html');

const tick = () => new Promise(r => setTimeout(r, 0));
async function waitFor(check, { timeoutMs = 900, intervalMs = 15 } = {}) {
  const t0 = Date.now();
  for (;;) {
    if (check()) return;
    if (Date.now() - t0 > timeoutMs) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

describe('Dashboard UI', () => {
  let state;
  let calls;
  let origSend;

  beforeEach(async () => {
    // 1) Use the GLOBAL jsdom (provided by jsdom-global/register)
    //    Replace its HTML with your dashboard HTML.
    const html = fs.readFileSync(htmlPath, 'utf8');
    document.open();
    document.write(html);
    document.close();

    // Let your code know it's under test (optional guard for intervals)
    window.__TEST__ = true;

    // 2) Provide a baseline state that GET_STATE should return
    state = {
      blocked: 10,
      allowed: 5,
      bannersRemoved: 2,
      active: true,
      autoBlock: false,
      whitelist: ['alpha.com'],
      blacklist: ['beta.com']
    };
    calls = [];

    // 3) Save original sendMessage so background tests won’t break
    origSend = chrome.runtime.sendMessage;

    // 4) Stub sendMessage ONLY for this suite, and RESTORE in afterEach
    chrome.runtime.sendMessage = (msg, cb = () => {}) => {
      calls.push(msg);
      setTimeout(() => {
        if (msg.type === 'GET_STATE') {
          cb({ success: true, state });
          return;
        }
        if (msg.type === 'UPDATE_STATE') {
          if (msg.state && typeof msg.state === 'object') {
            state = { ...state, ...msg.state };
          }
          cb({ success: true, state });
          return;
        }
        cb({ success: false });
      }, 0);
    };

    // 5) Import your real dashboard code which registers DOMContentLoaded
    await import('../../UI/dashboard.js');

    // 6) Fire DOMContentLoaded on the GLOBAL document (the one dashboard.js uses)
    document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

    // allow initial GET_STATE + render to resolve
    await tick();
  });

  afterEach(() => {
    // restore original sendMessage so background tests behave normally
    chrome.runtime.sendMessage = origSend;
  });

  it('renders stats, toggles, and initial list headings/items', async () => {
    expect(document.getElementById('totalBlocked').textContent).to.equal('10');
    expect(document.getElementById('totalAllowed').textContent).to.equal('5');
    expect(document.getElementById('totalBanners').textContent).to.equal('2');

    expect(document.getElementById('autoBlockToggle').checked).to.equal(false);
    expect(document.getElementById('blockerActiveToggle').checked).to.equal(true);

    // Metric pills display the counts
    const whitelistCountText = document.getElementById('whitelistCount').textContent;
    const blacklistCountText = document.getElementById('blacklistCount').textContent;
    expect(whitelistCountText).to.match(/^\d+$/);
    expect(blacklistCountText).to.match(/^\d+$/);
    expect(Number(whitelistCountText)).to.equal(state.whitelist.length);
    expect(Number(blacklistCountText)).to.equal(state.blacklist.length);

    const wl = [...document.getElementById('whitelist').querySelectorAll('li')].map(li => li.firstChild.textContent);
    const bl = [...document.getElementById('blacklist').querySelectorAll('li')].map(li => li.firstChild.textContent);
    expect(wl).to.deep.equal(['alpha.com']);
    expect(bl).to.deep.equal(['beta.com']);
  });

  it('toggling Auto-Block sends UPDATE_STATE', async () => {
    const auto = document.getElementById('autoBlockToggle');
    auto.checked = true;
    auto.dispatchEvent(new window.Event('change', { bubbles: true }));
    await tick();

    const last = calls.filter(c => c.type === 'UPDATE_STATE').pop();
    expect(last).to.exist;
    expect(last.state.autoBlock).to.equal(true);
  });

  it('toggling Blocker Active sends UPDATE_STATE', async () => {
    const active = document.getElementById('blockerActiveToggle');
    active.checked = false;
    active.dispatchEvent(new window.Event('change', { bubbles: true }));
    await tick();

    const last = calls.filter(c => c.type === 'UPDATE_STATE').pop();
    expect(last).to.exist;
    expect(last.state.active).to.equal(false);
  });

  it('adding to whitelist updates DOM and heading count', async () => {
    const input = document.getElementById('whitelistInput');
    const list  = document.getElementById('whitelist');
    const add   = document.getElementById('addWhitelistBtn');

    input.value = 'example.com';
    add.click();

    await waitFor(() => [...list.querySelectorAll('li')]
      .some(li => li.firstChild.textContent === 'example.com'));

    const items = [...list.querySelectorAll('li')].map(li => li.firstChild.textContent);
    expect(items).to.deep.equal(['alpha.com', 'example.com']);
    const countText = document.getElementById('whitelistCount').textContent;
    expect(countText).to.match(/^\d+$/);
    expect(Number(countText)).to.equal(2);
  });

  it('removing a whitelist item (❌) updates DOM and heading count', async () => {
    const list = document.getElementById('whitelist');
    const removeBtn = list.querySelector('li button'); // first item's ❌
    expect(removeBtn).to.exist;
    removeBtn.click();

    await waitFor(() => list.querySelectorAll('li').length === 0);

    const items = [...list.querySelectorAll('li')].map(li => li.firstChild.textContent);
    expect(items).to.deep.equal([]);
    const countText = document.getElementById('whitelistCount').textContent;
    expect(countText).to.match(/^\d+$/);
    expect(Number(countText)).to.equal(0);
  });

  it('adding to blacklist updates DOM and heading count', async () => {
    const input = document.getElementById('blacklistInput');
    const list  = document.getElementById('blacklist');
    const add   = document.getElementById('addBlacklistBtn');

    input.value = 'tracker.com';
    add.click();

    await waitFor(() => [...list.querySelectorAll('li')]
      .some(li => li.firstChild.textContent === 'tracker.com'));

    const items = [...list.querySelectorAll('li')].map(li => li.firstChild.textContent);
    expect(items).to.deep.equal(['beta.com', 'tracker.com']);
    const countText = document.getElementById('blacklistCount').textContent;
    expect(countText).to.match(/^\d+$/);
    expect(Number(countText)).to.equal(2);
  });
});
