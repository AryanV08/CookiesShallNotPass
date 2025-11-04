import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

export function loadHtml(relPath) {
  const html = fs.readFileSync(path.resolve(relPath), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  return { window: dom.window, document: dom.window.document };
}
