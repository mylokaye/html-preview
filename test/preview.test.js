const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

test('renders same-origin VS Code host messages while ignoring other origins and preview content', () => {
  const elements = Object.fromEntries(['preview', 'viewport', 'status', 'refresh', 'trust'].map(id => [id, {
    style: {}, contentWindow: {}, addEventListener() {}, setAttribute() {}
  }]));
  const messages = [];
  let receive;
  const window = { origin: 'vscode-webview://preview', parent: {}, addEventListener(type, callback) { receive = callback; } };
  const api = { getState: () => ({}), setState() {}, postMessage: message => messages.push(message) };
  const createElement = () => ({});
  const sandbox = {
    window, acquireVsCodeApi: () => api,
    document: { getElementById: id => elements[id], createElement },
    DOMParser: class {
      parseFromString(html) {
        return {
          head: { prepend() {}, insertBefore() {} },
          querySelectorAll: () => [], createElement,
          documentElement: { outerHTML: html }
        };
      }
    }
  };
  vm.runInNewContext(fs.readFileSync('media/preview.js', 'utf8'), sandbox);
  assert.equal(messages[0].type, 'ready');
  const render = { type: 'render', html: '<html><head></head><body><h1>Hello</h1></body></html>',
    base: 'https://resources.example/', source: 'https://resources.example', trusted: true };
  receive({ source: {}, origin: 'https://unrelated.example', data: render });
  assert.equal(elements.preview.srcdoc, undefined);
  const host = {}; // Host WindowProxy identity can differ from window.parent in Electron.
  receive({ source: host, origin: window.origin, data: { type: 'state', uri: 'github:///repo/form.html', viewport: 'mobile' } });
  assert.equal(elements.preview.style.width, '390px');
  receive({ source: host, origin: window.origin, data: render });
  assert.ok(elements.preview.srcdoc.includes('<h1>Hello</h1>'));
  receive({ source: elements.preview.contentWindow, origin: 'null', data: { ...render, html: 'unexpected' } });
  assert.ok(elements.preview.srcdoc.includes('<h1>Hello</h1>'));
  receive({ source: host, origin: window.origin, data: { ...render, trusted: false } });
  assert.match(elements.trust.textContent, /Restricted Mode/);
  assert.ok(elements.preview.srcdoc.includes('<h1>Hello</h1>'));
});
