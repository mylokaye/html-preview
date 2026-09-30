# Changelog

## 0.1.7

- Update the extension icon and README header image.

## 0.1.6

- Fix blank previews by validating forwarded VS Code messages by webview origin, including Electron host WindowProxy differences.
- Add a controller regression check for host messages and unrelated message sources.

## 0.1.5

- Update the GitHub and Marketplace descriptions to highlight live previews, responsive viewports, asset refresh, diagnostics and GitHub workspace support.
- Correct repository and issue links to the renamed `mylokaye/vs-html-preview` repository.
- Add version history to the shared GitHub/Marketplace README and document earlier project versions here.
- Includes all 0.1.4 preview improvements; no runtime behaviour changes.

## 0.1.4

- Debounced HTML updates, refresh-on-save and manual refresh modes.
- Refresh previews when assets in the permitted resource root are saved or change on disk.
- Configurable HTML-directory or workspace resource access.
- Refresh toolbar, responsive viewport presets and Explorer context command.
- Preserve scroll position during trusted preview refreshes and restore previews after restart.
- Show resource, script and content-policy errors in trusted previews.
- Static previews in Restricted Mode; workspace scripts and external requests require trust.
- Parse HTML with the browser DOM parser; normalise the preview base URL.
- Add automated lifecycle tests and release packaging exclusions.

## 0.1.3

- Add the Marketplace banner and refine the extension icon.
- Expand listing keywords and description for HTML previews and remote workspaces.
- Add repository, homepage and issue links, and gallery appearance metadata.

## 0.1.2

- Introduce VS HTML Preview branding, publisher metadata and extension icon.
- Add the MIT licence and expanded usage, virtual workspace and privacy documentation.

## 0.0.1

- Initial HTML preview panel with live HTML updates and relative resource resolution.
- Support local and virtual workspace resource URIs.
