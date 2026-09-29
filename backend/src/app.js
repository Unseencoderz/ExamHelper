const express = require("express");
const fs = require("fs");
const path = require("path");
const { WEB_DIR, MAX_SCREENSHOTS, CLOUDINARY_CONFIGURED, SUPABASE_CONFIGURED, ADMIN_SESSION_CONFIGURED } = require("./config");
const { log } = require("./logger");
const { getClientState } = require("./realtime");
const { createAdminAuthRouter, requireAdminSession } = require("./adminAuth");
const { createScreenshotRouter } = require("./screenshots/routes");
const { createSnippetRouter } = require("./snippets/routes");
const { createAppConfigRouter } = require("./appConfig/routes");
const { createClipboardRouter } = require("./clipboard/routes");

function createApp({ broadcastClientEvent, pushClipboard, getDesktopStatus = () => ({ connected: false }) }) {
  const app = express();
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ extended: true }));
  if (fs.existsSync(WEB_DIR)) app.use(express.static(WEB_DIR, { index: false, extensions: ["html"] }));

  app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString(), max_screenshots: MAX_SCREENSHOTS, cloudinary_archive_configured: CLOUDINARY_CONFIGURED, supabase_configured: SUPABASE_CONFIGURED, admin_session_configured: ADMIN_SESSION_CONFIGURED }));
  app.use(createAdminAuthRouter());
  app.get("/desktop-status", (req, res) => res.json(getDesktopStatus()));
  app.get("/client-state", async (req, res) => {
    try { res.json(await getClientState()); }
    catch (error) { res.status(error.statusCode || 500).json({ error: "Unable to load client state." }); }
  });
  app.use(createScreenshotRouter({ requireAdminSession }));
  app.use(createSnippetRouter({ broadcastClientEvent }));
  app.use(createAppConfigRouter({ broadcastClientEvent, requireAdminSession }));
  app.use(createClipboardRouter({ broadcastClientEvent, pushClipboard }));
  app.get("/", (req, res) => {
    if (!fs.existsSync(path.join(WEB_DIR, "index.html"))) return res.status(404).send("web-frontend/index.html is missing.");
    return res.sendFile(path.join(WEB_DIR, "index.html"));
  });
  app.use((error, req, res, next) => {
    log("ERROR", "Unhandled server error", error.message);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "Internal server error." });
  });
  return app;
}

module.exports = { createApp };
