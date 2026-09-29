const vscode = require('vscode');
const previews = new Map();

function configuration(uri) {
  return vscode.workspace.getConfiguration('vsPreview', uri);
}

function directoryUri(uri) {
  return uri.with({ path: uri.path.slice(0, uri.path.lastIndexOf('/') + 1) || '/', query: '', fragment: '' });
}

function resourceRoot(uri) {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  return configuration(uri).get('resourceRoot', 'file') === 'workspace' && folder
    ? folder.uri : directoryUri(uri);
}

function contains(root, uri) {
  return root.scheme === uri.scheme && root.authority === uri.authority &&
    (uri.path === root.path || uri.path.startsWith(root.path.replace(/\/$/, '') + '/'));
}

function schedule(entry) {
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => refresh(entry), configuration(entry.document.uri).get('refreshDelay', 250));
}

function refresh(entry) {
  clearTimeout(entry.timer);
  entry.panel.webview.postMessage({ type: 'render', html: entry.document.getText(),
    base: entry.panel.webview.asWebviewUri(directoryUri(entry.document.uri)).toString(),
    source: entry.panel.webview.cspSource, trusted: vscode.workspace.isTrusted });
}

function configure(entry, context) {
  clearTimeout(entry.timer);
  entry.watcher?.dispose();
  entry.root = resourceRoot(entry.document.uri);
  entry.panel.webview.options = { enableScripts: true, localResourceRoots: [entry.root, vscode.Uri.joinPath(context.extensionUri, 'media')] };
  entry.watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(entry.root, '**/*'));
  const changed = uri => {
    if (configuration(entry.document.uri).get('refreshMode', 'onChange') !== 'manual' &&
        uri.toString() !== entry.document.uri.toString()) schedule(entry);
  };
  entry.watcher.onDidChange(changed);
  entry.watcher.onDidCreate(changed);
  entry.watcher.onDidDelete(changed);
  entry.panel.webview.html = shell(entry.panel.webview, context);
}

function attach(panel, document, context, viewport = 'responsive') {
  const key = document.uri.toString();
  const entry = { panel, document, viewport };
  previews.set(key, entry);
  panel.title = `Preview: ${document.uri.path.split('/').pop() || 'HTML'}`;
  panel.webview.onDidReceiveMessage(message => {
    if (message?.type === 'ready') {
      panel.webview.postMessage({ type: 'state', uri: key, viewport: entry.viewport });
      refresh(entry);
    } else if (message?.type === 'refresh') refresh(entry);
    else if (message?.type === 'viewport' && ['responsive', 'mobile', 'tablet', 'desktop'].includes(message.value)) {
      entry.viewport = message.value;
    }
  });
  panel.onDidDispose(() => {
    clearTimeout(entry.timer);
    entry.watcher?.dispose();
    if (previews.get(key) === entry) previews.delete(key);
  });
  configure(entry, context);
  return entry;
}

function shell(webview, context) {
  const script = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'preview.js'));
  const style = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'preview.css'));
  const external = vscode.workspace.isTrusted ? ' https:' : '';
  // The controller has no inline scripts; the isolated document gets its own stricter policy.
  const policy = `default-src 'none'; script-src ${webview.cspSource}${external} 'unsafe-inline'; style-src ${webview.cspSource}${external} 'unsafe-inline'; img-src ${webview.cspSource}${external} data:; font-src ${webview.cspSource}${external} data:; media-src ${webview.cspSource}${external} data:; connect-src ${webview.cspSource}${external}; frame-src ${webview.cspSource}${external} about:; base-uri ${webview.cspSource}${external}; form-action${external || " 'none'"}; object-src 'none'`;
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${escapeAttribute(policy)}"><link rel="stylesheet" href="${escapeAttribute(style.toString())}"></head><body>
  <header><button id="refresh" type="button">Refresh</button><label for="viewport">Viewport</label><select id="viewport"><option value="responsive">Responsive</option><option value="mobile">Mobile · 390px</option><option value="tablet">Tablet · 768px</option><option value="desktop">Desktop · 1440px</option></select><span id="trust"></span></header>
  <div id="status" role="status" aria-live="polite"></div><main><iframe id="preview" title="HTML preview" sandbox="allow-scripts allow-forms"></iframe></main><script src="${escapeAttribute(script.toString())}"></script></body></html>`;
}

function escapeAttribute(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('vsPreview.openPreview', async resource => {
    try {
      const document = resource instanceof vscode.Uri
        ? await vscode.workspace.openTextDocument(resource) : vscode.window.activeTextEditor?.document;
      if (!document || !(document.languageId === 'html' || /\.html?$/i.test(document.uri.path))) {
        vscode.window.showInformationMessage('Open an HTML file to preview it.');
        return;
      }
      const existing = previews.get(document.uri.toString());
      if (existing) { existing.document = document; existing.panel.reveal(vscode.ViewColumn.Beside); refresh(existing); return; }
      const panel = vscode.window.createWebviewPanel('vsPreview.htmlPreview', 'HTML preview', vscode.ViewColumn.Beside, { enableScripts: true });
      attach(panel, document, context);
    } catch (error) { vscode.window.showErrorMessage(`Could not open HTML preview: ${error.message}`); }
  }));
  context.subscriptions.push(vscode.commands.registerCommand('vsPreview.refresh', () => {
    for (const entry of previews.values()) if (entry.panel.active) refresh(entry);
  }));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(({ document }) => {
    const entry = previews.get(document.uri.toString());
    if (entry) {
      entry.document = document;
      if (configuration(document.uri).get('refreshMode', 'onChange') === 'onChange') schedule(entry);
    }
  }));
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(document => {
    for (const entry of previews.values()) {
      if (configuration(entry.document.uri).get('refreshMode', 'onChange') === 'manual') continue;
      if (entry.document.uri.toString() === document.uri.toString()) entry.document = document;
      if (contains(entry.root, document.uri)) schedule(entry);
    }
  }));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    for (const entry of previews.values()) if (event.affectsConfiguration('vsPreview', entry.document.uri)) configure(entry, context);
  }));
  context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => {
    for (const entry of previews.values()) configure(entry, context);
  }));
  context.subscriptions.push(vscode.window.registerWebviewPanelSerializer('vsPreview.htmlPreview', {
    async deserializeWebviewPanel(panel, state) {
      try {
        if (typeof state?.uri !== 'string') throw new Error('Missing preview file');
        const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(state.uri));
        attach(panel, document, context, ['responsive', 'mobile', 'tablet', 'desktop'].includes(state.viewport) ? state.viewport : 'responsive');
      } catch (error) { panel.dispose(); vscode.window.showErrorMessage(`Could not restore HTML preview: ${error.message}`); }
    }
  }));
  context.subscriptions.push({ dispose: deactivate });
}

function deactivate() {
  for (const entry of previews.values()) { clearTimeout(entry.timer); entry.watcher?.dispose(); entry.panel.dispose(); }
  previews.clear();
}
exports.activate = activate;
exports.deactivate = deactivate;
