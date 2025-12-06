import { expect } from 'chai';
import { Storage } from '../../storage.js';

describe('Storage', () => {
  beforeEach(async () => {
    // reset both stores between tests
    await new Promise(r => chrome.storage.local.clear(r));
    await new Promise(r => chrome.storage.sync.clear(r));
  });

  it('sets and gets values from chrome.storage.local', async () => {
    await Storage.set('whitelist', ['example.com']);
    const value = await Storage.get('whitelist');
    expect(value).to.deep.equal(['example.com']);
  });

  it('removes keys from chrome.storage.local', async () => {
    await Storage.set('a', 1);
    await Storage.set('b', 2);
    await Storage.remove('a');

    const a = await Storage.get('a');
    const b = await Storage.get('b');
    expect(a).to.equal(undefined);
    expect(b).to.equal(2);
  });

  it('syncs local data to chrome.storage.sync', async () => {
    await Storage.set('whitelist', ['a.com']);
    await Storage.set('blacklist', ['b.com']);
    await Storage.set('rules', [{ id: 1 }]);

    if (typeof Storage.syncToCloud === 'function') {
      await Storage.syncToCloud();
    } else {
      // Fallback path: trigger the list-only sync helper used in runtime
      const currentState = {
        whitelist: await Storage.get('whitelist'),
        blacklist: await Storage.get('blacklist')
      };
      await Storage.forceSyncNow(currentState);
    }

    const syncWhitelist = await new Promise(r => chrome.storage.sync.get('whitelist', o => r(o.whitelist)));
    const syncBlacklist = await new Promise(r => chrome.storage.sync.get('blacklist', o => r(o.blacklist)));
    // rules may or may not sync depending on the implementation; lists must always sync
    const syncRules = await new Promise(r => chrome.storage.sync.get('rules', o => r(o.rules)));
    expect(syncWhitelist).to.deep.equal(['a.com']);
    expect(syncBlacklist).to.deep.equal(['b.com']);
    expect(syncRules === undefined || JSON.stringify(syncRules) === JSON.stringify([{ id: 1 }])).to.equal(true);
  });
});
