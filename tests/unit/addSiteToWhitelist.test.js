import { expect } from 'chai';
import { createBlockRule, updateRules, TRACKER_DOMAINS } from '../../rulesEngine.js';

describe('rulesEngine', () => {
  describe('createBlockRule', () => {
    it('produces a block rule with expected shape and increments ids', () => {
      const firstRule = createBlockRule('example.com');
      expect(firstRule.id).to.be.a('number');
      expect(firstRule.priority).to.equal(1);
      expect(firstRule.action).to.deep.equal({ type: 'block' });
      expect(firstRule.condition.urlFilter).to.equal('*://*.example.com/*');
      expect(firstRule.condition.resourceTypes).to.include.members([
        'main_frame',
        'sub_frame',
        'xmlhttprequest',
        'script',
        'image',
        'websocket'
      ]);

      const secondRule = createBlockRule('other.test');
      expect(secondRule.id).to.equal(firstRule.id + 1);
      expect(secondRule.condition.urlFilter).to.equal('*://*.other.test/*');
    });
  });

  describe('updateRules', () => {
    let originalChrome;

    beforeEach(() => {
      originalChrome = global.chrome;
    });

    afterEach(() => {
      global.chrome = originalChrome;
    });

    it('replaces existing rules with tracker block rules', async () => {
      const existingRules = [{ id: 5 }, { id: 9 }];
      let capturedArgs = null;

      global.chrome = {
        ...originalChrome,
        declarativeNetRequest: {
          getDynamicRules: async () => existingRules,
          updateDynamicRules: async args => {
            capturedArgs = args;
            return true;
          }
        }
      };

      await updateRules();

      expect(capturedArgs).to.exist;
      expect(capturedArgs.removeRuleIds).to.deep.equal(existingRules.map(r => r.id));

      const expectedFilters = TRACKER_DOMAINS.map(domain => `*://*.${domain}/*`);
      const actualFilters = capturedArgs.addRules.map(rule => rule.condition.urlFilter);
      expect(actualFilters).to.deep.equal(expectedFilters);

      const ruleIds = capturedArgs.addRules.map(rule => rule.id);
      expect(new Set(ruleIds).size).to.equal(ruleIds.length);
    });
  });
});
