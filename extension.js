const vscode = require('vscode');

const previews = new Map();

function activate(context) {
  const openPreview = vscode.commands.registerCommand('vsPreview.openPreview', async (resource) => {
    let document;

    try {
      if (resource instanceof vscode.Uri) {
        document = await vscode.workspace.openTextDocument(resource);
      } else {
        document = vscode.window.activeTextEditor?.document;
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Could not open HTML file: ${error.message}`);
      return;
    }

    if (!document || !isHtmlDocument(document)) {
      vscode.window.showInformationMessage('Open an HTML file to preview it.');
      return;
    }

    const key = document.uri.toString();
    const existing = previews.get(key);
    if (existing) {
      existing.document = document;
      existing.panel.reveal(vscode.ViewColumn.Beside);
      updatePreview(existing);
      return;
    }

    const directory = getDirectoryUri(document.uri);
    const panel = vscode.window.createWebviewPanel(
      'vsPreview.htmlPreview',
      `Preview: ${getFileName(document.uri)}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [directory]
      }
    );

    const entry = { document, panel };
    previews.set(key, entry);
    panel.onDidDispose(() => {
      if (previews.get(key)?.panel === panel) {
        previews.delete(key);
      }
    });
    updatePreview(entry);
  });

  const refreshChangedDocuments = vscode.workspace.onDidChangeTextDocument(({ document }) => {
    const entry = previews.get(document.uri.toString());
    if (entry) {
      entry.document = document;
      updatePreview(entry);
    }
  });

  context.subscriptions.push(openPreview, refreshChangedDocuments);
}

function isHtmlDocument(document) {
  return document.languageId === 'html' || /\.html?$/i.test(document.uri.path);
}

function getFileName(uri) {
  return uri.path.split('/').filter(Boolean).pop() || 'HTML';
}

function getDirectoryUri(uri) {
  const lastSlash = uri.path.lastIndexOf('/');
  return uri.with({
    path: uri.path.slice(0, lastSlash + 1) || '/',
    fragment: ''
  });
}

function updatePreview({ document, panel }) {
  panel.webview.html = getPreviewHtml(panel.webview, document);
}

function getPreviewHtml(webview, document) {
  const baseUri = webview.asWebviewUri(getDirectoryUri(document.uri)).toString();
  const policy = [
    "default-src 'none'",
    `frame-src ${webview.cspSource} https: about:`,
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} https: 'unsafe-inline'`,
    `script-src ${webview.cspSource} https: 'unsafe-inline'`,
    `font-src ${webview.cspSource} https: data:`,
    `media-src ${webview.cspSource} https: data:`,
    `connect-src ${webview.cspSource} https:`,
    'form-action https:',
    `base-uri ${webview.cspSource} https:`,
    "object-src 'none'"
  ].join('; ');

  const previewDocument = addPreviewHead(
    document.getText(),
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(policy)}">` +
      `<base href="${escapeAttribute(baseUri)}">`
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${escapeAttribute(policy)}">
  <style>
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
    iframe { display: block; width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  <iframe title="HTML preview" sandbox="allow-scripts allow-forms" srcdoc="${escapeAttribute(previewDocument)}"></iframe>
</body>
</html>`;
}

function addPreviewHead(html, headContent) {
  const head = /<head\b[^>]*>/i;
  if (head.test(html)) {
    return html.replace(head, (openingTag) => `${openingTag}${headContent}`);
  }

  const htmlTag = /<html\b[^>]*>/i;
  if (htmlTag.test(html)) {
    return html.replace(htmlTag, (openingTag) => `${openingTag}<head>${headContent}</head>`);
  }

  const doctype = /<!doctype\b[^>]*>/i;
  if (doctype.test(html)) {
    return html.replace(doctype, (openingTag) => `${openingTag}<html><head>${headContent}</head><body>`) + '</body></html>';
  }

  return `<!doctype html><html><head>${headContent}</head><body>${html}</body></html>`;
}

function escapeAttribute(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function deactivate() {
  previews.clear();
}

exports.activate = activate;
exports.deactivate = deactivate;
