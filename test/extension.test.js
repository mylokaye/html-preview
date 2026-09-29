const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function setup() {
  const commands = {}, events = {}, panels = [], watchers = [];
  let mode = 'onChange', root = 'file';
  class Uri {
    constructor(path, scheme = 'file') { this.path = path; this.scheme = scheme; this.authority = ''; }
    with(changes) { return Object.assign(new Uri(this.path, this.scheme), changes); }
    toString() { return `${this.scheme}://${this.path}`; }
    static parse(value) { const [scheme, path] = value.split('://'); return new Uri(path, scheme); }
    static joinPath(uri, ...parts) { return uri.with({path: uri.path + '/' + parts.join('/')}); }
  }
  const document = { uri: new Uri('/project/pages/index.html'), languageId: 'html', getText: () => '<h1>Hello</h1>' };
  const listen = name => callback => { events[name] = callback; return { dispose() {} }; };
  function panel() {
    const value = { active: true, messages: [], webview: {
      cspSource: 'https://resources.example', asWebviewUri: uri => uri,
      postMessage(message) { value.messages.push(message); },
      onDidReceiveMessage(callback) { value.receive = callback; },
      set html(value) { this.content = value; },
    }, reveal() {}, onDidDispose(callback) { value.onDispose = callback; }, dispose() { value.onDispose?.(); } };
    panels.push(value); return value;
  }
  const vscode = { Uri, RelativePattern: class { constructor(base, pattern) { this.base = base; this.pattern = pattern; } }, ViewColumn: { Beside: 2 },
    commands: { registerCommand(name, callback) { commands[name] = callback; return {dispose() {}}; } },
    window: { activeTextEditor: {document}, createWebviewPanel: panel, showInformationMessage() {}, showErrorMessage(message) { throw Error(message); }, registerWebviewPanelSerializer(name, value) { events.serializer = value; return {dispose() {}}; } },
    workspace: { isTrusted: true, getConfiguration: () => ({get: (name, fallback) => ({refreshMode: mode, resourceRoot: root, refreshDelay: 0})[name] ?? fallback}), getWorkspaceFolder: uri => ({uri: new Uri('/project', uri.scheme)}), openTextDocument: async uri => ({...document, uri}),
      createFileSystemWatcher(pattern) { const watcher = {pattern, onDidChange(fn) {this.change = fn;}, onDidCreate(fn) {this.create = fn;}, onDidDelete(fn) {this.delete = fn;}, dispose() {this.disposed = true;}}; watchers.push(watcher); return watcher; },
      onDidChangeTextDocument: listen('change'), onDidSaveTextDocument: listen('save'), onDidChangeConfiguration: listen('configuration'), onDidGrantWorkspaceTrust: listen('trust') } };
  const sandbox = {require: () => vscode, exports: {}, setTimeout, clearTimeout};
  vm.runInNewContext(fs.readFileSync('extension.js', 'utf8'), sandbox);
  sandbox.exports.activate({subscriptions: [], extensionUri: new Uri('/extension')});
  return {commands, events, panels, watchers, document, Uri, vscode, stop: sandbox.exports.deactivate, setMode: value => mode = value, setRoot: value => root = value};
}
const tick = () => new Promise(resolve => setTimeout(resolve, 15));
test('reuses panels, debounces edits and sends content without replacing the shell', async () => {
  const s = setup(); await s.commands['vsPreview.openPreview']();
  const p = s.panels[0], html = p.webview.content;
  p.receive({type:'ready'}); p.messages.length = 0;
  s.events.change({document:s.document}); s.events.change({document:s.document}); await tick();
  assert.equal(p.messages.length, 1); assert.equal(p.webview.content, html);
  await s.commands['vsPreview.openPreview'](); assert.equal(s.panels.length, 1); s.stop();
});
test('save/manual modes and external asset events', async () => {
  const s = setup(); await s.commands['vsPreview.openPreview'](); const p = s.panels[0];
  s.setMode('onSave'); s.events.change({document:s.document}); await tick(); assert.equal(p.messages.length, 0);
  s.events.save({uri:new s.Uri('/project/pages/site.css')}); await tick(); assert.equal(p.messages.length, 1);
  s.setMode('manual'); s.watchers[0].change(new s.Uri('/project/pages/site.js')); await tick(); assert.equal(p.messages.length, 1);
  s.commands['vsPreview.refresh'](); assert.equal(p.messages.length, 2); s.stop(); assert.equal(s.watchers[0].disposed, true);
});
test('workspace roots, virtual URIs, Restricted Mode and restoration', async () => {
  const s = setup(); s.setRoot('workspace'); s.vscode.workspace.isTrusted = false;
  await s.commands['vsPreview.openPreview'](new s.Uri('/project/pages/index.html', 'github'));
  const p = s.panels[0]; assert.equal(p.webview.options.localResourceRoots[0].scheme, 'github'); assert.equal(p.webview.options.localResourceRoots[0].path, '/project');
  assert.ok(!p.webview.content.includes('connect-src https://resources.example https:'));
  p.receive({type:'ready'}); assert.equal(p.messages[1].trusted, false);
  p.dispose(); await s.events.serializer.deserializeWebviewPanel(p, {uri:'github:///project/pages/index.html',viewport:'mobile'});
  p.receive({type:'ready'}); assert.equal(p.messages.at(-2).viewport, 'mobile'); s.stop();
});
