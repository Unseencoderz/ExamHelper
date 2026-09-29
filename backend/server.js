const http = require("http");
const { PORT, CLOUDINARY_CONFIGURED, CLOUDINARY_SCREENSHOT_FOLDER, SUPABASE_CONFIGURED } = require("./src/config");
const { log } = require("./src/logger");
const { createApp } = require("./src/app");
const { createRealtime } = require("./src/realtime");
const { runArchiveMaintenance } = require("./src/screenshots/archive");

let broadcastClientEvent = () => {};
let pushClipboard = () => false;
let getDesktopStatus = () => ({ connected: false });
const app = createApp({
  broadcastClientEvent: (...args) => broadcastClientEvent(...args),
  pushClipboard: (...args) => pushClipboard(...args),
  getDesktopStatus: () => getDesktopStatus(),
});
const server = http.createServer(app);
({ broadcastClientEvent, pushClipboard, getDesktopStatus } = createRealtime(server));

server.listen(PORT, () => {
  log("INFO", `ExamHelper backend running on http://localhost:${PORT}`);
  log("INFO", SUPABASE_CONFIGURED ? "Supabase persistence enabled." : "Supabase is not configured; persistence endpoints will return 503.");
  log("INFO", CLOUDINARY_CONFIGURED
    ? `Cloudinary screenshot storage enabled (folder: ${CLOUDINARY_SCREENSHOT_FOLDER})`
    : "Cloudinary is not configured; screenshot uploads will return 503.");
  log("INFO", "Endpoints ready: POST /upload, GET /screenshots, GET /archive, POST /screenshots/bulk-delete, POST /screenshots/bulk-restore, POST /archive/:id/restore, DELETE /archive/:id");
});

void runArchiveMaintenance("Startup");
setInterval(() => void runArchiveMaintenance("Scheduled"), 60 * 1000).unref();
