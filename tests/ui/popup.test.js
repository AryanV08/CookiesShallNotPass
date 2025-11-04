import { expect } from 'chai';
import { loadHtml } from '../setup/loadHtml.js';
import { initPopup } from '../../UI/popup.js';

describe('Popup UI', () => {
  let document, window, sent;

  beforeEach(() => {
    ({ document, window } = loadHtml('UI/popup.html'));
    sent = [];
    // intercept messages
    global.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };
  });

  it('renders the main structure', () => {
    expect(document.querySelector('#extensionToggle')).to.exist;
    expect(document.querySelector('#blockedCount')).to.exist;
    expect(document.querySelector('#currentSite')).to.exist;
  });

  it('toggle sends SET_EXTENSION_ACTIVE', () => {
    const { toggle } = initPopup({ document, chrome });
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    expect(sent).to.deep.include({ type: 'SET_EXTENSION_ACTIVE', value: false });
  });

  it('whitelist and block buttons send messages', () => {
    const { wlBtn, blkBtn } = initPopup({ document, chrome });
    wlBtn.click();
    blkBtn.click();
    expect(sent).to.deep.include({ type: 'WHITELIST_CURRENT_SITE' });
    expect(sent).to.deep.include({ type: 'BLACKLIST_CURRENT_SITE' });
  });

  it('dashboard button sends OPEN_DASHBOARD', () => {
    const { dashBtn } = initPopup({ document, chrome });
    dashBtn.click();
    expect(sent).to.deep.include({ type: 'OPEN_DASHBOARD' });
  });
});
