# Changelog

## 3.0.0 — 2026-09-28

- Refactored the backend from a single server file into focused configuration, persistence, realtime, screenshot, snippet, application-configuration, and clipboard modules.
- Removed Gemini-based text extraction, its routes, and its deployment configuration.
- Added Cloudinary-backed screenshot archiving and archive maintenance.
- Improved the web dashboard, archive workflows, screenshot viewing, and management controls.
- Added two-way plain-text clipboard sync: desktop copies upload automatically, while the web Clipboard panel can manually push text to the desktop client.
- Added a 50-entry clipboard history with live updates, individual deletion, and clear-all controls.
- Made the desktop client fully silent by removing its tray icon and console UI; it now starts from a Windows Startup-folder shortcut.
