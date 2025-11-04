import { expect } from 'chai';
import '../../content.js';

describe('content script messaging', () => {
  it('responds to REMOVE_NON_ESSENTIAL_COOKIES', (done) => {
    const sendResponse = (resp) => {
      try {
        expect(resp).to.have.property('removed');
        done();
      } catch (e) { done(e); }
    };
    chrome.runtime.onMessage._dispatch({ type: 'REMOVE_NON_ESSENTIAL_COOKIES' }, {}, sendResponse);
  });
});
