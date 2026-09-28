const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { STORAGE_DIR, MAX_SCREENSHOTS, CLOUDINARY_CONFIGURED } = require("../config");
const { log } = require("../logger");
const { toPosix } = require("../jsonStore");
const { upload } = require("./upload");
const { readMetaById, writeMeta, listMetas, parseTags, hasUsableImageFile, hasUsableCloudinaryAsset } = require("./meta");
const { deleteScreenshotById, archiveScreenshotById, restoreScreenshotById, archiveExpiredScreenshots, enforceScreenshotLimit } = require("./archive");

function createScreenshotRouter() {
  const router = express.Router();

  router.post("/upload", (req, res, next) => {
    upload.single("screenshot")(req, res, async (error) => {
      if (error instanceof multer.MulterError) {
        log("WARN", "Multer error", error.message);
        return res.status(400).json({ error: error.message });
      }
      if (error) {
        log("WARN", "Upload error", error.message);
        return res.status(400).json({ error: error.message });
      }
      try {
        if (!req.file) return res.status(400).json({ error: "No screenshot file provided." });
        if (!hasUsableImageFile(req.file.path)) {
          if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: "The uploaded screenshot file was empty or unreadable." });
        }
        const id = req.body.id || path.parse(req.file.filename).name;
        const existingMeta = readMetaById(id);
        if (existingMeta) {
          if (hasUsableImageFile(existingMeta.filepath) || hasUsableCloudinaryAsset(existingMeta)) {
            fs.unlinkSync(req.file.path);
            log("INFO", `Duplicate upload ignored: ${id}`);
            return res.status(409).json({ status: "duplicate", id });
          }
          log("WARN", `Replacing stale metadata record for upload ${id}`);
          await deleteScreenshotById(id);
        }
        const savedSize = fs.statSync(req.file.path).size;
        const meta = writeMeta({
          id, device_id: req.body.device_id || "unknown-device", timestamp: req.body.timestamp || new Date().toISOString(),
          label: req.body.label || "screenshot", source: req.body.source || "", tags: req.body.tags || [],
          filename: req.file.filename, filepath: req.file.path, relative_path: toPosix(path.relative(STORAGE_DIR, req.file.path)),
          size_bytes: savedSize, mimetype: req.file.mimetype, received_at: new Date().toISOString(),
        });
        const archived = await enforceScreenshotLimit();
        if (archived.length > 0) log("INFO", `Screenshot limit archived ${archived.length} older screenshot(s)`);
        log("INFO", `Stored screenshot ${meta.filename}`, `(${(savedSize / 1024).toFixed(1)} KB, source=${meta.source})`);
        return res.status(201).json({ status: "stored", item: meta, archived: archived.map((item) => item.id) });
      } catch (handlerError) {
        log("ERROR", "Upload handler failed", handlerError.message);
        return next(handlerError);
      }
    });
  });

  router.get("/screenshots", async (req, res) => {
    try {
      await archiveExpiredScreenshots();
      const page = Math.max(Number.parseInt(req.query.page || "1", 10), 1);
      const limit = Math.min(Math.max(Number.parseInt(req.query.limit || "100", 10), 1), 200);
      const source = req.query.source ? String(req.query.source) : null;
      const tag = req.query.tag ? String(req.query.tag) : null;
      const allItems = listMetas().filter((item) => !item.archived_at).filter((item) => !source || item.source === source).filter((item) => !tag || item.tags.includes(tag)).sort((left, right) => new Date(right.received_at).getTime() - new Date(left.received_at).getTime());
      res.json({ total: allItems.length, page, limit, items: allItems.slice((page - 1) * limit, page * limit) });
    } catch (error) { log("ERROR", "Failed to list screenshots", error.message); res.status(500).json({ error: "Unable to list screenshots." }); }
  });

  router.get("/archive", async (req, res) => {
    try {
      await archiveExpiredScreenshots();
      const page = Math.max(Number.parseInt(req.query.page || "1", 10), 1);
      const limit = Math.min(Math.max(Number.parseInt(req.query.limit || "100", 10), 1), 200);
      const allItems = listMetas().filter((item) => item.archived_at).sort((left, right) => new Date(right.received_at).getTime() - new Date(left.received_at).getTime());
      res.json({ total: allItems.length, page, limit, items: allItems.slice((page - 1) * limit, page * limit) });
    } catch (error) { log("ERROR", "Failed to list archived screenshots", error.message); res.status(500).json({ error: "Unable to list archived screenshots." }); }
  });

  router.post("/screenshots/bulk-restore", async (req, res) => {
    try {
      const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids.map((id) => String(id)))] : [];
      if (ids.length === 0) return res.status(400).json({ error: "No screenshot ids were provided." });
      const restored = ids.filter((id) => readMetaById(id)?.archived_at).map(restoreScreenshotById).filter(Boolean);
      await enforceScreenshotLimit();
      res.json({ status: "restored", restored_count: restored.length, items: restored });
    } catch (error) { log("ERROR", "Failed to restore archived screenshots", error.message); res.status(500).json({ error: "Unable to restore selected screenshots." }); }
  });

  router.delete("/archive/bulk-delete", async (req, res) => {
    try {
      const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids.map((id) => String(id)))] : [];
      if (ids.length === 0) return res.status(400).json({ error: "No archived screenshot ids were provided." });
      const deleted = [];
      for (const id of ids) if (readMetaById(id)?.archived_at) { const removed = await deleteScreenshotById(id); if (removed) deleted.push(removed); }
      log("INFO", `Permanently deleted ${deleted.length} archived screenshot(s)`);
      res.json({ status: "deleted", deleted_count: deleted.length, items: deleted });
    } catch (error) { log("ERROR", "Failed to permanently delete archived screenshots", error.message); res.status(error.statusCode || 500).json({ error: error.message || "Unable to permanently delete selected screenshots." }); }
  });

  router.post("/archive/:id/restore", async (req, res) => {
    try {
      const current = readMetaById(req.params.id);
      if (!current?.archived_at) return res.status(404).json({ error: "Archived screenshot not found." });
      const item = restoreScreenshotById(req.params.id); await enforceScreenshotLimit();
      res.json({ status: "restored", item });
    } catch (error) { log("ERROR", `Failed to restore screenshot ${req.params.id}`, error.message); res.status(500).json({ error: "Unable to restore archived screenshot." }); }
  });

  router.delete("/archive/:id", async (req, res) => {
    try {
      const current = readMetaById(req.params.id);
      if (!current?.archived_at) return res.status(404).json({ error: "Archived screenshot not found." });
      const item = await deleteScreenshotById(req.params.id);
      res.json({ status: "deleted", item });
    } catch (error) { log("ERROR", `Failed to permanently delete screenshot ${req.params.id}`, error.message); res.status(error.statusCode || 500).json({ error: error.message || "Unable to permanently delete archived screenshot." }); }
  });

  router.patch("/screenshots/:id", (req, res) => {
    try {
      const current = readMetaById(req.params.id);
      if (!current) return res.status(404).json({ error: "Screenshot not found." });
      const updated = writeMeta({ ...current, tags: req.body.tags !== undefined ? parseTags(req.body.tags) : current.tags, source: typeof req.body.source === "string" ? req.body.source.trim() : current.source });
      res.json({ status: "updated", item: updated });
    } catch (error) { log("ERROR", `Failed to update screenshot ${req.params.id}`, error.message); res.status(500).json({ error: "Unable to update screenshot metadata." }); }
  });

  router.delete("/screenshots/:id", async (req, res) => {
    try {
      const archived = await archiveScreenshotById(req.params.id);
      if (!archived) return res.status(404).json({ error: "Screenshot not found." });
      log("INFO", `Archived screenshot ${archived.id}`);
      res.json({ status: "archived", item: archived });
    } catch (error) { log("ERROR", `Failed to archive screenshot ${req.params.id}`, error.message); res.status(error.statusCode || 500).json({ error: error.message || "Unable to archive screenshot." }); }
  });

  router.post("/screenshots/bulk-delete", async (req, res) => {
    try {
      const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids.map((id) => String(id)))] : [];
      if (ids.length === 0) return res.status(400).json({ error: "No screenshot ids were provided." });
      const archived = [];
      for (const id of ids) { const item = await archiveScreenshotById(id); if (item) archived.push(item); }
      log("INFO", `Archived ${archived.length} screenshot(s) from the dashboard`);
      res.json({ status: "archived", archived_count: archived.length, items: archived });
    } catch (error) { log("ERROR", "Failed to archive screenshots", error.message); res.status(error.statusCode || 500).json({ error: error.message || "Unable to archive selected screenshots." }); }
  });

  router.get("/stats", (req, res) => {
    try {
      const items = listMetas(); const activeItems = items.filter((item) => !item.archived_at);
      const totalBytes = activeItems.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0);
      const daysWithData = new Set(activeItems.map((item) => String(item.timestamp || item.received_at || "").slice(0, 10)).filter(Boolean));
      res.json({ total_screenshots: activeItems.length, archived_screenshots: items.length - activeItems.length, total_size_mb: (totalBytes / (1024 * 1024)).toFixed(2), days_with_data: daysWithData.size, storage_dir: STORAGE_DIR, max_screenshots: MAX_SCREENSHOTS });
    } catch (error) { log("ERROR", "Failed to build stats", error.message); res.status(500).json({ error: "Unable to calculate stats." }); }
  });

  return router;
}

module.exports = { createScreenshotRouter };
