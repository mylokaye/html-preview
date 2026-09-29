![VS HTML Preview banner](images/html-preview.jpg)

# VS HTML Preview

Live HTML previews beside the editor in VS Code, with responsive viewports, asset refresh, diagnostics and GitHub workspace support.

[GitHub repository](https://github.com/mylokaye/vs-html-preview) · [Mylo Kaye's website](https://mylokaye.me)

## Features

- Preview `.html` and `.htm` files from the Command Palette, editor menus or Explorer.
- Debounced HTML updates, refresh-on-save and manual refresh modes.
- Refresh when saved assets change within the permitted resource root.
- Responsive, mobile (390px), tablet (768px) and desktop (1440px) viewport presets.
- Refresh button and **Refresh HTML Preview** command for the active preview.
- Scroll restoration during trusted refreshes and preview restoration after VS Code restarts.
- Resource, script and content-policy error feedback in trusted previews.
- Static previews in Restricted Mode.

## Use

Open an HTML file and run **Preview HTML**, or right-click it in Explorer. The preview opens beside the editor. Running the command again brings the existing preview into view.

Choose a viewport in the toolbar. Fixed widths can scroll horizontally when wider than the panel. Refresh reruns page scripts and resets form/application state; scroll position is restored where possible. Restart restoration preserves the file and viewport, not page state or scroll position.

## Settings

| Setting | Default | Behaviour |
| --- | --- | --- |
| `vsPreview.refreshMode` | `onChange` | `onChange` refreshes while editing HTML; `onSave` refreshes on saves; `manual` refreshes only on request. |
| `vsPreview.refreshDelay` | `250` | Automatic refresh debounce in milliseconds (0–5000). |
| `vsPreview.resourceRoot` | `file` | `file` permits the HTML directory; `workspace` permits its containing workspace folder, including sibling assets. |

Asset saves and file-system changes refresh previews within the permitted root, including changes to files that the page may not reference. Unsaved external CSS/JavaScript edits are not included. File-system monitoring depends on the workspace provider; use Refresh if a virtual provider does not report changes.

## GitHub repositories and VS Code for the Web

Open a repository with GitHub Repositories or in VS Code for the Web, then run **Preview HTML**. Resource access uses VS Code URIs rather than local disk paths. Each workspace folder remains a separate resource boundary.

## Compatibility

This is a static HTML preview, not a development server. Server-side templates, backend routes, root-relative site URLs and localhost HTTP/WebSocket services are not supported. Relative assets resolve against the HTML directory; existing `<base>` elements are replaced with the preview base.

The iframe deliberately has an opaque origin. Browser storage, service workers and some module-script/fetch requests may fail because of origin or CORS restrictions. Workspace CSP rules can also block preview scripts and diagnostics. Use webview developer tools for details when the status strip cannot report an error.

## Security and privacy

The preview runs in an isolated iframe without access to the VS Code API. Trusted previews allow scripts, forms and HTTPS resources. In Restricted Mode, workspace scripts, forms, nested frames and external network requests are disabled; local styles and images remain available. Scripts in trusted previews may make HTTPS network requests.

Resource access defaults to the HTML directory. Selecting `workspace` allows preview content to load resources throughout the containing workspace folder. The extension does not collect telemetry or transmit files itself.

## Development and verification

Open this folder in VS Code and press **F5** to launch an Extension Development Host. Run `npm run check` and `npm test` for syntax and mocked extension lifecycle checks. These tests cover panel reuse, debounce, modes, asset saves, virtual URI boundaries, restricted policy and restoration; they do not replace host integration tests.

Before release, smoke-test local folders, a GitHub virtual workspace and VS Code for the Web: relative CSS/images/scripts, parent-directory assets in workspace mode, asset saves, manual mode, Restricted Mode, viewport sizing, diagnostics and restart restoration. Check ES modules against the documented sandbox limits.

Package with `npx --yes --package @vscode/vsce vsce package`. VSIX builds and `.DS_Store` files are ignored; attach packages to releases rather than committing them.

## Version history

| Version | Changes |
| --- | --- |
| **0.1.5** | Updated GitHub and Marketplace descriptions, corrected repository and issue links, and added version history to this page and the changelog. Includes all 0.1.4 features. |
| **0.1.4** | Debounced live updates, save/manual refresh modes, asset monitoring, configurable resource roots, responsive viewport presets, Explorer command, scroll and preview restoration, error feedback and Restricted Mode support. |
| **0.1.3** | Added the listing banner, refined the icon, expanded discoverability metadata and added project/support links. |
| **0.1.2** | Introduced VS HTML Preview branding, publisher metadata, icon, MIT licence and expanded usage documentation. |
| **0.0.1** | Initial HTML preview with live HTML updates, relative resources and local/virtual workspace support. |

See [CHANGELOG.md](CHANGELOG.md) for detailed changes. This history records project versions; Marketplace availability can lag while a package is verified.

## License

MIT. See [LICENSE](LICENSE). Release changes are listed in [CHANGELOG.md](CHANGELOG.md).
