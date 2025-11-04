import { expect } from 'chai';
import {
  createBlockRule,
  updateRules,
  TRACKER_DOMAINS
} from '../../rulesEngine.js';

describe('rulesEngine', () => {
  beforeEach(() => {
    // reset DNR state before each test
    chrome.declarativeNetRequest._rules = [];
    chrome.declarativeNetRequest._last = null;
  });

  it('createBlockRule: builds a correct block rule and increments id', () => {
    const r1 = createBlockRule('example.com');
    const r2 = createBlockRule('tracker.net');

    // basic structure
    expect(r1).to.have.keys(['id', 'priority', 'action', 'condition']);
    expect(r1.action).to.deep.equal({ type: 'block' });
    expect(r1.priority).to.equal(1);
    expect(r1.condition.urlFilter).to.equal('*://*.example.com/*');
    expect(r1.condition.resourceTypes).to.include('script');

    // ids should be increasing by 1
    expect(r2.id).to.equal(r1.id + 1);
    expect(r2.condition.urlFilter).to.equal('*://*.tracker.net/*');
  });

  it('updateRules: replaces existing dynamic rules with tracker domain rules', async () => {
    // seed some existing rules to ensure they are removed
    chrome.declarativeNetRequest._rules = [{ id: 1 }, { id: 2 }];

    await updateRules();

    // last call should reflect removal of [1,2] and add TRACKER_DOMAINS.length rules
    const last = chrome.declarativeNetRequest._last;
    expect(last).to.exist;
    expect(last.removeRuleIds).to.deep.equal([1, 2]);
    expect(last.addRules).to.have.lengthOf(TRACKER_DOMAINS.length);

    // DNR should now contain exactly tracker rules
    const current = await chrome.declarativeNetRequest.getDynamicRules();
    expect(current).to.have.lengthOf(TRACKER_DOMAINS.length);

    // sanity-check one of the generated rules (e.g., for google-analytics.com)
    const ga = current.find(r => r.condition?.urlFilter?.includes('google-analytics.com'));
    expect(ga).to.exist;
    expect(ga.action).to.deep.equal({ type: 'block' });
    expect(ga.condition.resourceTypes).to.include.members([
      'main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'image', 'websocket'
    ]);
  });
});