import { expect } from 'chai';
import { initBackground } from '../../background.js';

// helper: route a message through the runtime mock
const send = (msg) => new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));

describe('background message router', () => {
  beforeEach(async () => {
    // reset mock storage/tab state
    if (chrome.storage.__local) {
      for (const k of Object.keys(chrome.storage.__local)) delete chrome.storage.__local[k];
    }
    if (chrome.tabs && Array.isArray(chrome.tabs._sent)) chrome.tabs._sent.length = 0;

    // init background listeners
    await initBackground(chrome);
  });

  it('handles GET_STATE', async () => {
    const res = await send({ type: 'GET_STATE' });
    expect(res).to.have.property('success', true);
    expect(res).to.have.property('state');
    expect(res.state).to.include.all.keys(
      'blocked','allowed','bannersRemoved','blacklist','whitelist','active','autoBlock'
    );
  });

  it('handles WHITELIST_SITE (not SET_WHITELIST)', async () => {
    const add = await send({ type: 'WHITELIST_SITE', domain: 'example.com' });
    expect(add.success).to.equal(true);
    expect(add.stats.whitelist).to.include('example.com');
    expect(add.stats.blacklist).to.not.include('example.com');

    const res = await send({ type: 'GET_STATE' });
    expect(res.state.whitelist).to.include('example.com'); // persisted
  });
});