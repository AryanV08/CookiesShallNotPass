import { expect } from 'chai';
import '../../background.js';

describe('background message router', () => {
  beforeEach(() => {
    chrome.storage._local = {};
    chrome.tabs._sent = [];
  });

  it('handles GET_STATE', (done) => {
    const sendResponse = (resp) => {
      try {
        expect(resp.success).to.equal(true);
        expect(resp.state).to.be.an('object');
        done();
      } catch (e) { done(e); }
    };
    chrome.runtime.onMessage._dispatch({ type: 'GET_STATE' }, {}, sendResponse);
  });

  it('handles SET_WHITELIST', (done) => {
    const sendResponse = (resp) => {
      try {
        expect(resp.ok).to.equal(true);
        expect(chrome.storage._local.whitelist).to.be.an('array');
        done();
      } catch (e) { done(e); }
    };
    chrome.runtime.onMessage._dispatch({ type: 'SET_WHITELIST', payload: ['example.com'] }, {}, sendResponse);
  });
});
