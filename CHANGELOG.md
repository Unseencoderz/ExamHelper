# Changelog

## 3.1.0 — 2026-09-29

- Rebuilt the web frontend from scratch on Vite + React 19 + TypeScript + Tailwind CSS v4, replacing the old vanilla HTML/CSS/JS frontend. The new frontend lives in `web-app/` and is served from `web-app/dist` via the backend's `WEB_DIR` setting.
- Added a password-protected Archive Vault and Settings area: both views display an inline login screen when no admin session is active, and unlock automatically on successful authentication without navigating away.
- Added a persistent collapsible sidebar: defaults to a 64px icon-only rail on first visit, expands to a 256px labeled rail, and persists the preference across reloads via `localStorage`.
- Added per-section unread notification badges on the Screenshots and Clipboard nav items, counting items received since the section was last visited.
- Added a live desktop connection status indicator (`DesktopIndicator`) shown in the sidebar footer, with an animated pulse dot when the daemon is online.
- Added Lucide React as the icon library, used throughout the sidebar, panels, and action controls.
- Added `framer-motion` / `motion` for contained UI transitions.
- Replaced the previous flat dashboard with a split-layout: sticky top header with breadcrumb and active/archive counts, sidebar, and a scrollable main work plane.
- Added mobile-responsive sidebar drawer (hamburger-triggered) alongside the desktop persistent rail.
- Added hotkey readout in the expanded sidebar footer, showing the current configured screenshot hotkey as a `<kbd>` badge (admin session required to display).
- Updated `render.yaml` build command to reference `web-app` (was `web-frontend`); updated `WEB_DIR` to `/opt/render/project/src/web-app/dist`.
- Corrected the API documentation cookie name from the old `Vixlo_admin_session` to the actual `examhelper_admin_session`.
- Updated `DESIGN.md` to reflect the GitHub-dark color palette actually in use (`#0D1117` canvas, `#58A6FF` accent, `#3FB950` success, etc.) and the Plus Jakarta Sans / JetBrains Mono font stack.

## 3.0.0 — 2026-09-28

- Refactored the backend from a single server file into focused configuration, persistence, realtime, screenshot, snippet, application-configuration, and clipboard modules.
- Removed Gemini-based text extraction, its routes, and its deployment configuration.
- Added Cloudinary-backed screenshot archiving and archive maintenance.
- Improved the web dashboard, archive workflows, screenshot viewing, and management controls.
- Added two-way plain-text clipboard sync: desktop copies upload automatically, while the web Clipboard panel can manually push text to the desktop client.
- Added a 50-entry clipboard history with live updates, individual deletion, and clear-all controls.
- Made the desktop client fully silent by removing its tray icon and console UI; it now starts from a Windows Startup-folder shortcut.
