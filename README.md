# ExamHelper

ExamHelper is a Windows screenshot companion with a browser dashboard, realtime text snippets and hotkey configuration, Cloudinary-backed screenshot archiving, and two-way plain-text clipboard sync.

## Project structure

```text
ExamHelper/
├── backend/
│   ├── server.js                 # HTTP/Socket.IO entry point
│   └── src/
│       ├── app.js                # Express application and routes
│       ├── config.js             # Environment and storage configuration
│       ├── logger.js             # Server logging
│       ├── jsonStore.js          # Shared JSON persistence helpers
│       ├── realtime.js           # Socket.IO state and events
│       ├── screenshots/          # Upload, metadata, and archive workflows
│       ├── snippets/             # Snippet storage and routes
│       ├── appConfig/            # Screenshot-hotkey storage and routes
│       └── clipboard/            # Clipboard history storage and routes
├── desktop-client/               # Silent Python Windows background client
└── web-frontend/                 # Static browser UI served by the backend
```

## Features

- Screenshot dashboard, preview, crop-to-copy, bulk actions, and archive restore/deletion.
- Cloudinary-backed screenshot archiving: dashboard images are archived after 30 minutes, when manually archived, or when the active-image limit is reached.
- Text snippet and screenshot-hotkey management, synchronized to the desktop client through Socket.IO.
- Clipboard history: copied plain text is uploaded automatically from the desktop client and displayed newest first in the web UI. The history retains up to 50 entries; individual entries or the entire history can be permanently deleted.
- Manual clipboard push: enter text in the Clipboard panel and select **Send to desktop** to place it on the connected desktop client's clipboard. Push-down text is not added to clipboard history.

## Backend API and realtime state

The backend serves the frontend at `http://localhost:3000`, exposes screenshot, archive, snippet, configuration, and health endpoints, and uses Socket.IO for realtime client state.

Clipboard endpoints:

- `GET /clipboard` — retrieve the current clipboard history.
- `POST /clipboard/push` — manually send plain text to the connected desktop client.
- `DELETE /clipboard/history/:id` — permanently delete one history entry.
- `DELETE /clipboard/history` — permanently clear clipboard history.

Screenshot metadata and JSON-backed application state are stored beneath `backend/uploads/`; this directory is intentionally ignored by Git.

## Run locally

### Start the backend

```cmd
cd backend
start_server.bat
```

Open [http://localhost:3000](http://localhost:3000).

### Start the desktop client

```cmd
cd desktop-client
install_and_run.bat
```

The default screenshot hotkey is `Win + Alt + C`. The client derives its Socket.IO endpoint from the upload endpoint unless a `[sync] endpoint` override is set in `%LOCALAPPDATA%\ScreenshotSync\config.ini`.

The desktop client is deliberately silent: it has no console window, tray icon, notification, dialog, or in-app quit control. Stop it with Task Manager (or the taskbar's process management controls) and start it again from the installed Startup entry or executable.

## Cloudinary archive storage

Set either a single connection URL:

```ini
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
CLOUDINARY_ARCHIVE_FOLDER=examhelper/archive
```

or separate values:

```ini
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Without Cloudinary configuration, new screenshots still upload to the dashboard, but archive actions are unavailable so local images are never silently discarded. `/health` reports whether archive storage is configured.

## Deploying to Render

The included [render.yaml](render.yaml) configures a Node web service with a persistent disk mounted at `backend/uploads`.

For a manual service, use:

- Build command: `npm install --prefix backend`
- Start command: `node backend/server.js`
- Root directory: repository root

Configure `MAX_SCREENSHOTS`, `MAX_FILE_SIZE_MB`, `STORAGE_DIR`, `WEB_DIR`, `CLOUDINARY_URL`, and optionally `CLOUDINARY_ARCHIVE_FOLDER`. Update the desktop client's `[upload] endpoint` to the deployed URL plus `/upload`.

## Build the silent Windows client

Install Python and Inno Setup 6, then run:

```cmd
cd desktop-client
build_installer.bat
```

This builds a windowed, one-file executable and the Inno Setup installer defined in [desktop-client/installer/Microphone.iss](desktop-client/installer/Microphone.iss). The installer places a Startup-folder shortcut so the client launches at user logon without a console or tray UI.
