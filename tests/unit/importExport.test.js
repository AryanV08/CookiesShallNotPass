import { expect } from 'chai';
import {
  parseJsonLists,
  parseTxtLists,
  buildJsonExport,
  buildTxtExport
} from '../../UI/dashboard.js';

describe('List import/export helpers', () => {
  describe('parseJsonLists', () => {
    it('extracts whitelist and blacklist arrays from valid payloads', () => {
      const json = JSON.stringify({
        whitelist: ['alpha.com', 'beta.com'],
        blacklist: ['tracker.com']
      });

      const lists = parseJsonLists(json);

      expect(lists).to.deep.equal({
        whitelist: ['alpha.com', 'beta.com'],
        blacklist: ['tracker.com']
      });
    });

    it('returns empty arrays when the JSON omits list arrays', () => {
      const json = JSON.stringify({
        whitelist: 'alpha.com',
        blacklist: null
      });

      expect(parseJsonLists(json)).to.deep.equal({
        whitelist: [],
        blacklist: []
      });
    });
  });

  describe('parseTxtLists', () => {
    it('honors section headers, inline declarations, and ignores comments', () => {
      const text = `
        # Comment line should be ignored
        alpha.com
        beta.com

        [blacklist]
        tracker.com
        blacklist : ads.com
        whitelist - safe.example
      `;

      const lists = parseTxtLists(text);

      expect(lists).to.deep.equal({
        whitelist: ['alpha.com', 'beta.com', 'safe.example'],
        blacklist: ['tracker.com', 'ads.com']
      });
    });
  });

  describe('buildJsonExport', () => {
    it('serializes only whitelist + blacklist with pretty formatting', () => {
      const state = {
        whitelist: ['alpha.com'],
        blacklist: ['tracker.com', 'ads.com'],
        ignored: 42
      };

      const payload = buildJsonExport(state);
      const expected = JSON.stringify({
        whitelist: ['alpha.com'],
        blacklist: ['tracker.com', 'ads.com']
      }, null, 2);

      expect(payload).to.equal(expected);
    });

    it('falls back to empty arrays if state is missing', () => {
      expect(buildJsonExport()).to.equal(JSON.stringify({
        whitelist: [],
        blacklist: []
      }, null, 2));

      expect(buildJsonExport({ whitelist: null, blacklist: undefined })).to.equal(JSON.stringify({
        whitelist: [],
        blacklist: []
      }, null, 2));
    });
  });

  describe('buildTxtExport', () => {
    it('creates sectioned plain text with whitelist and blacklist entries', () => {
      const text = buildTxtExport({
        whitelist: ['alpha.com', 'beta.com'],
        blacklist: ['tracker.com']
      });

      expect(text).to.equal('[whitelist]\nalpha.com\nbeta.com\n\n[blacklist]\ntracker.com\n');
    });

    it('always outputs both section headers even when no entries exist', () => {
      const text = buildTxtExport({});
      expect(text).to.equal('[whitelist]\n\n[blacklist]\n');
    });
  });
});
