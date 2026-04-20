# ExamHelper Screenshot AI System

ExamHelper now uses a cleaner three-part layout:

```text
ExamHelper/
├── backend/          # Express API, screenshot storage, Gemini extraction, web host
├── desktop-client/   # Python Windows tray app that captures and uploads screenshots
└── web-frontend/     # Static browser UI served by the backend
```

## What the web frontend supports

- Screenshot gallery with grid and list layouts
- Metadata display for each capture: timestamp, source, size, filename, and tags
- Single and bulk selection workflows
- Single delete and bulk delete
- Automatic FIFO cleanup when stored screenshots exceed `50`
- Copy one screenshot directly to the clipboard
- Copy multiple screenshots with a browser-friendly fallback contact sheet
- Predefined AI prompts for code generation, problem solving, and direct answers
- Gemini-powered text extraction for one or more selected screenshots
- Copy extracted text back to the clipboard

## Backend capabilities

The backend now provides:

- `POST /upload`
- `GET /screenshots`
- `PATCH /screenshots/:id`
- `DELETE /screenshots/:id`
- `POST /screenshots/bulk-delete`
- `POST /extract-text`
- `GET /stats`
- `GET /health`
- Static frontend hosting at `http://localhost:3000`

Existing metadata is normalized on startup so older screenshot records still work after the folder move into `backend/uploads`.

## Run the system

### 1. Start the backend

```cmd
cd backend
start_server.bat
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Start the desktop screenshot client

```cmd
cd desktop-client
install_and_run.bat
```

Default hotkey: `Win + Alt + C`

### 3. Optional Gemini setup

To enable the **Extract text** button, configure the backend with a Gemini API key.

1. Copy `backend/.env.example` to `backend/.env` or set environment variables another way.
2. Set `GEMINI_API_KEY`.
3. Optionally change `GEMINI_MODEL` or `MAX_SCREENSHOTS`.

The backend auto-loads `backend/.env` on startup.

Example environment values:

```ini
PORT=3000
MAX_SCREENSHOTS=50
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

## Notes

- Screenshots are stored in `backend/uploads/`.
- Metadata lives in `backend/uploads/.meta/`.
- The backend serves image files under `/media/...` for the browser UI.
- The frontend is static and dependency-free, so it ships directly from the repo without a separate build step.

## Deploying to Render

You can deploy this project to Render, but there are two important details:

1. The service needs access to both `backend/` and `web-frontend/`, so do not point a manual Render service at `backend/` as its root directory unless you also move the frontend into that folder.
2. Screenshot files are written to disk. Render services use an ephemeral filesystem by default, so uploads will disappear on restart or redeploy unless you attach a persistent disk or switch to external storage.

This repo now includes a starter [render.yaml](render.yaml) that configures:

- a Node web service
- repo-root deployment with `node backend/server.js`
- `/health` as the health check path
- a persistent disk mounted at `backend/uploads`
- secret prompting for `GEMINI_API_KEY`

### Recommended Render flow

1. Create a Git repository and push the whole codebase.
2. In Render, create a new Blueprint from the repo, or create a Web Service manually.
3. If creating it manually, use:
   - Build command: `npm install --prefix backend`
   - Start command: `node backend/server.js`
   - Root directory: repo root
4. Add environment variables:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL`
   - `MAX_SCREENSHOTS`
   - `MAX_FILE_SIZE_MB`
   - `STORAGE_DIR`
   - `WEB_DIR`
5. Attach a persistent disk if you want uploads to survive deploys.
6. Deploy.

### Render caveat for the desktop client

After deployment, the Windows client must upload to your Render URL instead of localhost.

Update the local config at:

```text
%LOCALAPPDATA%\ScreenshotSync\config.ini
```

Set:

```ini
[upload]
endpoint = https://your-render-service.onrender.com/upload
```

## Building a silent Windows executable

The desktop client is a background tray app, so the best packaging path is:

1. Build a windowless executable with PyInstaller.
2. Wrap it in an installer that copies it into the user profile, registers startup, and launches it silently after install.

This repo now includes:

- [desktop-client/build_exe.bat](desktop-client/build_exe.bat) to build the executable with PyInstaller
- [desktop-client/build_installer.bat](desktop-client/build_installer.bat) to build the installer
- [desktop-client/installer/ExamHelperClient.iss](desktop-client/installer/ExamHelperClient.iss) as the Inno Setup installer script

### Build steps

1. Install Python on Windows.
2. Install Inno Setup 6.
3. Run:

```cmd
cd desktop-client
build_installer.bat
```

The result is a Windows installer EXE that:

- installs the packaged tray client under `%LOCALAPPDATA%\ExamHelper\desktop-client`
- adds a Windows `Run` registry entry so it starts automatically at login
- launches the tray app after install

### Why the build uses PyInstaller `--onedir`

For a background app, `--onedir --windowed` is more reliable than a hidden `--onefile` build because it avoids per-launch unpacking and is a better fit for something that should stay running quietly in the background.
