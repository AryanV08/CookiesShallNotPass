import { expect } from 'chai';
import { addOrUpdateRules, toHostnamePattern, buildRule } from '../../rulesEngine.js';

describe('rulesEngine', () => {
  beforeEach(() => {
    chrome.declarativeNetRequest._last = null;
  });

  it('converts hostname to a URLFilter pattern', () => {
    expect(toHostnamePattern('example.com')).to.equal('*://*.example.com/*');
    expect(toHostnamePattern('sub.domain.co.uk')).to.equal('*://*.domain.co.uk/*'); // adjust if your logic differs
  });

  it('builds a rule object', () => {
    const rule = buildRule({ id: 123, domain: 'example.com', action: 'block' });
    expect(rule).to.include({ id: 123, priority: 1 });
    expect(rule.action.type).to.be.a('string');
    expect(rule.condition.urlFilter).to.include('example.com');
  });

  it('calls updateDynamicRules with adds/removes', (done) => {
    addOrUpdateRules([{ id: 2 }], [1]);
    const last = chrome.declarativeNetRequest._last;
    expect(last.removeRuleIds).to.deep.equal([1]);
    expect(last.addRules).to.deep.include({ id: 2 });
    done();
  });
});
