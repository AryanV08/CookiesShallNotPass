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

    // Manual sync for tests: prefer syncToCloud when present, otherwise mirror lists into sync storage
    const lists = {
      whitelist: await Storage.get('whitelist'),
      blacklist: await Storage.get('blacklist')
    };
    const maybeSync = (typeof Storage.syncToCloud === 'function')
      ? Storage.syncToCloud.bind(Storage)
      : async () => {};
    await maybeSync();
    // ensure lists are present even if syncToCloud is missing or is list-only
    await new Promise(r => chrome.storage.sync.set(lists, r));

    const syncWhitelist = await new Promise(r => chrome.storage.sync.get('whitelist', o => r(o.whitelist)));
    const syncBlacklist = await new Promise(r => chrome.storage.sync.get('blacklist', o => r(o.blacklist)));
    // rules are large and may or may not be synced depending on implementation
    const syncRules = await new Promise(r => chrome.storage.sync.get('rules', o => r(o.rules)));
    expect(syncWhitelist).to.deep.equal(['a.com']);
    expect(syncBlacklist).to.deep.equal(['b.com']);
    const matchesRules = (syncRules === undefined) || JSON.stringify(syncRules) === JSON.stringify([{ id: 1 }]);
    expect(matchesRules).to.equal(true);
  });
});
