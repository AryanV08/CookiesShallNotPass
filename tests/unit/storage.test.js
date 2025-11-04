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
    await Storage.set('rules', [{ id: 1 }]);

    await Storage.syncToCloud();

    const syncWhitelist = await new Promise(r => chrome.storage.sync.get('whitelist', o => r(o.whitelist)));
    const syncRules = await new Promise(r => chrome.storage.sync.get('rules', o => r(o.rules)));

    expect(syncWhitelist).to.deep.equal(['a.com']);
    expect(syncRules).to.deep.equal([{ id: 1 }]);
  });
});
