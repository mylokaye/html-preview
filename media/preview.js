(() => {
  const vscode = acquireVsCodeApi();
  const frame = document.getElementById('preview');
  const viewport = document.getElementById('viewport');
  const status = document.getElementById('status');
  let state = vscode.getState() || {};
  let scroll = { x: 0, y: 0 };
  let generation = 0;
  let warnings = new Set();
  const widths = { responsive: '100%', mobile: '390px', tablet: '768px', desktop: '1440px' };
  function resize() { frame.style.width = widths[state.viewport] || widths.responsive; viewport.value = state.viewport || 'responsive'; }
  document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
  viewport.addEventListener('change', () => {
    state.viewport = viewport.value; vscode.setState(state); resize();
    vscode.postMessage({ type: 'viewport', value: viewport.value });
  });
  window.addEventListener('message', event => {
    if (event.source === frame.contentWindow) {
      const message = event.data;
      if (message?.generation !== generation) return;
      if (message.type === 'scroll' && Number.isFinite(message.x) && Number.isFinite(message.y)) scroll = { x: message.x, y: message.y };
      if (message.type === 'warning' && typeof message.text === 'string') {
        if (warnings.size < 5) warnings.add(message.text.slice(0, 300));
        status.textContent = Array.from(warnings).slice(0, 5).join(' · ');
      }
      return;
    }
    // Electron may expose the host source as a different WindowProxy. The host
    // shares this webview's origin; sandboxed preview content has an opaque origin.
    if (event.origin !== window.origin) return;
    const message = event.data;
    if (message?.type === 'state') { state = { uri: message.uri, viewport: message.viewport }; vscode.setState(state); resize(); }
    if (message?.type !== 'render') return;
    generation++;
    warnings = new Set();
    status.textContent = '';
    document.getElementById('trust').textContent = message.trusted ? '' : 'Restricted Mode: scripts and external requests disabled';
    const parsed = new DOMParser().parseFromString(message.html, 'text/html');
    const policy = document.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy';
    // Inherit the outer resource policy, then disable active/external content in Restricted Mode.
    policy.content = message.trusted ? "object-src 'none'" : `default-src 'none'; img-src ${message.source} data:; style-src ${message.source} 'unsafe-inline'; script-src 'none'; connect-src 'none'; frame-src 'none'; form-action 'none'; object-src 'none'`;
    const base = document.createElement('base');
    base.href = message.base;
    parsed.querySelectorAll('base').forEach(element => element.remove());
    parsed.head.prepend(policy, base);
    frame.setAttribute('sandbox', message.trusted ? 'allow-scripts allow-forms' : '');
    if (message.trusted) {
      const bridge = parsed.createElement('script');
      bridge.textContent = `(() => {
        const generation = ${generation};
        const send = data => parent.postMessage({ ...data, generation }, '*');
        addEventListener('scroll', () => send({type:'scroll',x:scrollX,y:scrollY}), {passive:true});
        addEventListener('load', () => scrollTo(${scroll.x}, ${scroll.y}));
        addEventListener('error', event => {
          if (event.target !== window) send({type:'warning',text:'Resource failed: ' + (event.target.getAttribute('src') || event.target.getAttribute('href') || event.target.tagName)});
          else send({type:'warning',text:'Script error: ' + (event.message || 'see webview developer tools')});
        }, true);
        addEventListener('securitypolicyviolation', event => send({type:'warning',text:'Blocked by content policy: ' + event.blockedURI}));
      })();`;
      parsed.head.insertBefore(bridge, base.nextSibling);
    } else status.textContent = 'Resource diagnostics and scroll restoration require a trusted workspace.';
    frame.srcdoc = '<!doctype html>\n' + parsed.documentElement.outerHTML;
  });
  resize();
  vscode.postMessage({ type: 'ready' });
})();
