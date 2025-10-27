import { expect } from 'chai';
import { addSiteToWhitelist } from '../../main.js';


describe('addSiteToWhitelist (pure)', () => {
  let mockStorage;
  let whitelistListEl;

  beforeEach(() => {
    whitelistListEl = document.createElement('div');
    whitelistListEl.id = 'whitelistList';

    mockStorage = {
      data: {},
      getItem(key) { return this.data[key] || null; },
      setItem(key, val) { this.data[key] = val; },
      clear() { this.data = {}; }
    };
  });

  it('adds a valid domain to storage and updates DOM', () => {
    const ok = addSiteToWhitelist('example.com', whitelistListEl, mockStorage);
    expect(ok).to.equal(true);

    const list = JSON.parse(mockStorage.getItem('whitelist'));
    expect(list).to.deep.equal(['example.com']);

    expect(whitelistListEl.children.length).to.equal(1);
    expect(whitelistListEl.children[0].className).to.equal('whitelist-item');
    expect(whitelistListEl.children[0].textContent).to.equal('example.com');
  });

  it('prevents duplicates', () => {
    addSiteToWhitelist('example.com', whitelistListEl, mockStorage);
    addSiteToWhitelist('example.com', whitelistListEl, mockStorage);

    const list = JSON.parse(mockStorage.getItem('whitelist'));
    expect(list).to.deep.equal(['example.com']);
    expect(whitelistListEl.children.length).to.equal(1);
  });

  it('returns false for invalid input', () => {
    const ok = addSiteToWhitelist('', whitelistListEl, mockStorage);
    expect(ok).to.equal(false);
    expect(mockStorage.getItem('whitelist')).to.equal(null);
    expect(whitelistListEl.children.length).to.equal(0);
  });

  it('works without DOM element (storage-only)', () => {
    const ok = addSiteToWhitelist('site.org', null, mockStorage);
    expect(ok).to.equal(true);
    const list = JSON.parse(mockStorage.getItem('whitelist'));
    expect(list).to.deep.equal(['site.org']);
  });

  it('accepts dashed/subdomain formats', () => {
    const ok = addSiteToWhitelist('cdn-assets.example.co.uk', whitelistListEl, mockStorage);
    expect(ok).to.equal(true);
    const list = JSON.parse(mockStorage.getItem('whitelist'));
    expect(list).to.include('cdn-assets.example.co.uk');
  });
});
