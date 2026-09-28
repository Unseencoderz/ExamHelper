const http = require("http");
const { PORT, STORAGE_DIR, CLOUDINARY_CONFIGURED, CLOUDINARY_ARCHIVE_FOLDER } = require("./src/config");
const { log } = require("./src/logger");
const { createApp } = require("./src/app");
const { createRealtime } = require("./src/realtime");
const { migrateMetaFiles, listMetas } = require("./src/screenshots/meta");
const { runArchiveMaintenance } = require("./src/screenshots/archive");

let broadcastClientEvent = () => {};
let pushClipboard = () => false;
const app = createApp({
  broadcastClientEvent: (...args) => broadcastClientEvent(...args),
  pushClipboard: (...args) => pushClipboard(...args),
});
const server = http.createServer(app);
({ broadcastClientEvent, pushClipboard } = createRealtime(server));

migrateMetaFiles();
listMetas();

server.listen(PORT, () => {
  log("INFO", `ExamHelper backend running on http://localhost:${PORT}`);
  log("INFO", `Storage directory: ${STORAGE_DIR}`);
  log("INFO", CLOUDINARY_CONFIGURED
    ? `Cloudinary archive enabled (folder: ${CLOUDINARY_ARCHIVE_FOLDER})`
    : "Cloudinary archive is not configured; dashboard images will remain local until it is configured.");
  log("INFO", "Endpoints ready: POST /upload, GET /screenshots, GET /archive, POST /screenshots/bulk-delete, POST /screenshots/bulk-restore, POST /archive/:id/restore, DELETE /archive/:id");
});

void runArchiveMaintenance("Startup");
setInterval(() => void runArchiveMaintenance("Scheduled"), 60 * 1000).unref();
