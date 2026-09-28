const express = require("express");
const fs = require("fs");
const path = require("path");
const { STORAGE_DIR, WEB_DIR, MAX_SCREENSHOTS, CLOUDINARY_CONFIGURED } = require("./config");
const { log } = require("./logger");
const { getClientState } = require("./realtime");
const { createScreenshotRouter } = require("./screenshots/routes");
const { createSnippetRouter } = require("./snippets/routes");
const { createAppConfigRouter } = require("./appConfig/routes");
const { createClipboardRouter } = require("./clipboard/routes");

function createApp({ broadcastClientEvent, pushClipboard }) {
  const app = express();
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use("/media", express.static(STORAGE_DIR, { dotfiles: "deny", maxAge: "1h" }));
  if (fs.existsSync(WEB_DIR)) app.use(express.static(WEB_DIR, { index: false, extensions: ["html"] }));

  app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString(), max_screenshots: MAX_SCREENSHOTS, cloudinary_archive_configured: CLOUDINARY_CONFIGURED }));
  app.get("/client-state", (req, res) => res.json(getClientState()));
  app.use(createScreenshotRouter());
  app.use(createSnippetRouter({ broadcastClientEvent }));
  app.use(createAppConfigRouter({ broadcastClientEvent }));
  app.use(createClipboardRouter({ broadcastClientEvent, pushClipboard }));
  app.get("/", (req, res) => {
    if (!fs.existsSync(path.join(WEB_DIR, "index.html"))) return res.status(404).send("web-frontend/index.html is missing.");
    return res.sendFile(path.join(WEB_DIR, "index.html"));
  });
  app.use((error, req, res, next) => {
    log("ERROR", "Unhandled server error", error.message);
    res.status(500).json({ error: "Internal server error." });
  });
  return app;
}

module.exports = { createApp };
