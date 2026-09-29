# ExamHelper

ExamHelper is a Windows screenshot companion with a browser dashboard, realtime text snippets and hotkey configuration, Cloudinary-backed screenshots, Supabase-backed application data, and two-way plain-text clipboard sync.

## Project structure

```text
ExamHelper/
├── backend/
│   ├── server.js                 # HTTP/Socket.IO entry point
│   └── src/
│       ├── app.js                # Express application and routes
│       ├── config.js             # Environment configuration
│       ├── logger.js             # Server logging
│       ├── supabase.js           # Plain Supabase client
│       ├── realtime.js           # Socket.IO state and events
│       ├── adminAuth.js          # Session-cookie authentication
│       ├── screenshots/          # Upload, metadata, and archive workflows
│       ├── snippets/             # Snippet storage and routes
│       ├── appConfig/            # Screenshot-hotkey storage and routes
│       └── clipboard/            # Clipboard history storage and routes
├── web-app/                      # React + Vite + Tailwind CSS frontend
│   ├── src/
│   │   ├── App.tsx               # Root application component and view routing
│   │   ├── api.ts                # Typed fetch wrapper for all backend endpoints
│   │   ├── types.ts              # Shared TypeScript type definitions
│   │   ├── index.css             # Tailwind v4 @theme tokens and global styles
│   │   └── components/           # Sidebar, ScreenshotGrid, panels, dialogs, toasts
│   ├── index.html
│   ├── vite.config.ts            # Vite build + dev-proxy configuration
│   └── package.json
├── desktop-client/               # Silent Python Windows background client
└── docs/                         # API reference and schema
```

## Features

- Screenshot dashboard, preview, crop-to-copy, bulk actions, and archive restore/deletion.
- Every screenshot is streamed directly to Cloudinary on upload. Dashboard images are archived after 30 minutes, when manually archived, or when the active-image limit is reached.
- Text snippet and screenshot-hotkey management, synchronized to the desktop client through Socket.IO.
- Clipboard history: copied plain text is uploaded automatically from the desktop client and displayed newest first in the web UI. The history retains up to 50 entries; individual entries or the entire history can be permanently deleted.
- Manual clipboard push: enter text in the Clipboard panel and select **Send to desktop** to place it on the connected desktop client's clipboard. Push-down text is not added to clipboard history.
- Password-protected Archive Vault and Settings area: logging in as admin unlocks archive listing, restore, permanent deletion, and hotkey configuration.
- Collapsible sidebar with icon-only rail (default) or expanded labeled rail; per-section unread notification badges for Screenshots and Clipboard; live desktop connection status indicator.

## Backend API and realtime state

The backend serves the frontend at `http://localhost:3000`, exposes screenshot, archive, snippet, configuration, and health endpoints, and uses Socket.IO for realtime client state. See [docs/API.md](docs/API.md) for the complete reference.

## Run locally

### Run the web frontend in development

```cmd
cd web-app
npm install
npm run dev
```

Vite serves the React frontend at `http://localhost:5173` and proxies all API calls and Socket.IO traffic to the backend at `http://localhost:3000`. Both servers must be running at the same time during development. Hot module replacement is fully active; no build step is required.

### Start the backend

```cmd
cd backend
start_server.bat
```

Open [http://localhost:5173](http://localhost:5173) for development or [http://localhost:3000](http://localhost:3000) for the production build.

### Build the frontend for production

```cmd
cd web-app
npm run build
```

Output lands in `web-app/dist`. The backend serves that directory when `WEB_DIR` points to it (the default when running from the repo root).

### Start the desktop client

```cmd
cd desktop-client
install_and_run.bat
```

The default screenshot hotkey is `Win + Alt + C`. The client derives its Socket.IO endpoint from the upload endpoint unless a `[sync] endpoint` override is set in `%LOCALAPPDATA%\ScreenshotSync\config.ini`.

The desktop client is deliberately silent: it has no console window, tray icon, notification, dialog, or in-app quit control. Stop it with Task Manager and start it again from the installed Startup entry or executable.

## Supabase and Cloudinary storage

Run [docs/supabase-schema.sql](docs/supabase-schema.sql) in the Supabase SQL editor, then configure the backend with its project URL and server-only service-role key:

```ini
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_SESSION_SECRET=replace_with_a_long_random_secret
```

Configure Cloudinary for every screenshot image:

Set either a single connection URL:

```ini
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
CLOUDINARY_SCREENSHOT_FOLDER=examhelper/screenshots
```

or separate values:

```ini
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Both Supabase and Cloudinary are required for persistence. If either is absent, the affected endpoints return `503` rather than falling back to local files. `/health` reports both configuration states.

## Admin access

The only login username is `admin`. Create or change its bcrypt password hash in the Supabase SQL editor with the statement at the end of [docs/supabase-schema.sql](docs/supabase-schema.sql). The backend also requires `ADMIN_SESSION_SECRET`, a long random value used to sign its HTTP-only session cookie (`examhelper_admin_session`).

The Archive and Settings views in the web UI display a login screen when no admin session is active. Active screenshots, snippets, clipboard history, and moving an active screenshot to the archive remain public. `GET /archive`, restore and permanent archive-deletion endpoints, and both `/config` endpoints require an admin session. `GET /desktop-status` is public and Socket.IO broadcasts `desktop_status_changed` whenever the desktop client connects or disconnects.

To authenticate, send `POST /auth/login` with `{"username":"admin","password":"..."}`. A successful `200` response sets the HTTP-only `examhelper_admin_session` cookie. `GET /auth/session` reports whether the session is valid and `POST /auth/logout` clears it.

## Deploying to Render

The included [render.yaml](render.yaml) configures a Node web service without a persistent disk.

For a manual service, use:

- **Root directory:** repository root
- **Build command:** `npm install --prefix backend && npm install --prefix web-app && npm run build --prefix web-app`
- **Start command:** `node backend/server.js`

Set the `WEB_DIR` environment variable to the absolute path of the built frontend:

```
WEB_DIR=/opt/render/project/src/web-app/dist
```

Also configure `MAX_SCREENSHOTS`, `MAX_FILE_SIZE_MB`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SESSION_SECRET`, `CLOUDINARY_URL`, and optionally `CLOUDINARY_SCREENSHOT_FOLDER`.

After deploying, update the desktop client's `[upload] endpoint` in `config.ini` to the deployed URL plus `/upload`.

## Build the silent Windows client

Install Python and Inno Setup 6, then run:

```cmd
cd desktop-client
build_installer.bat
```

This builds a windowed, one-file executable and the Inno Setup installer defined in [desktop-client/installer/Microphone.iss](desktop-client/installer/Microphone.iss). The installer places a Startup-folder shortcut so the client launches at user logon without a console or tray UI.
