const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const { MAX_SCREENSHOTS } = require("../config");
const { log } = require("../logger");
const { upload } = require("./upload");
const { readMetaById, writeMeta, listMetas, parseTags } = require("./meta");
const { uploadScreenshotToCloudinary, deleteCloudinaryAsset, deleteScreenshotById, archiveScreenshotById, restoreScreenshotById, archiveExpiredScreenshots, enforceScreenshotLimit } = require("./archive");

function paginate(items, page, limit) {
  return items.slice((page - 1) * limit, page * limit);
}

function requestIds(value) {
  return Array.isArray(value) ? [...new Set(value.map((id) => String(id)))] : [];
}

function createScreenshotRouter({ requireAdminSession }) {
  const router = express.Router();

  router.post("/upload", (req, res, next) => {
    upload.single("screenshot")(req, res, async (error) => {
      if (error instanceof multer.MulterError) return res.status(400).json({ error: error.message });
      if (error) return res.status(400).json({ error: error.message });
      try {
        if (!req.file || !Buffer.isBuffer(req.file.buffer) || req.file.size <= 0) return res.status(400).json({ error: "The uploaded screenshot file was empty or unreadable." });
        const id = String(req.body.id || crypto.randomUUID());
        if (await readMetaById(id)) {
          log("INFO", `Duplicate upload ignored: ${id}`);
          return res.status(409).json({ status: "duplicate", id });
        }
        const receivedAt = new Date().toISOString();
        const baseMeta = {
          id,
          device_id: req.body.device_id || "unknown-device",
          timestamp: req.body.timestamp || receivedAt,
          label: req.body.label || "screenshot",
          source: req.body.source || "",
          tags: req.body.tags || [],
          filename: req.file.originalname || `${id}.jpg`,
          size_bytes: req.file.size,
          mimetype: req.file.mimetype,
          received_at: receivedAt,
          status: "active",
        };
        const cloudinaryAsset = await uploadScreenshotToCloudinary(req.file.buffer, baseMeta);
        let meta;
        try {
          meta = await writeMeta({ ...baseMeta, cloudinary: cloudinaryAsset, cloudinary_url: cloudinaryAsset.secure_url });
        } catch (databaseError) {
          await deleteCloudinaryAsset(cloudinaryAsset).catch(() => {});
          throw databaseError;
        }
        const archived = await enforceScreenshotLimit();
        if (archived.length > 0) log("INFO", `Screenshot limit archived ${archived.length} older screenshot(s)`);
        log("INFO", `Stored screenshot ${meta.filename}`, `(${(req.file.size / 1024).toFixed(1)} KB, source=${meta.source})`);
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
      const items = (await listMetas()).filter((item) => item.status === "active")
        .filter((item) => !source || item.source === source)
        .filter((item) => !tag || item.tags.includes(tag));
      res.json({ total: items.length, page, limit, items: paginate(items, page, limit) });
    } catch (error) { log("ERROR", "Failed to list screenshots", error.message); res.status(error.statusCode || 500).json({ error: "Unable to list screenshots." }); }
  });

  router.get("/archive", requireAdminSession, async (req, res) => {
    try {
      await archiveExpiredScreenshots();
      const page = Math.max(Number.parseInt(req.query.page || "1", 10), 1);
      const limit = Math.min(Math.max(Number.parseInt(req.query.limit || "100", 10), 1), 200);
      const items = (await listMetas()).filter((item) => item.status === "archived");
      res.json({ total: items.length, page, limit, items: paginate(items, page, limit) });
    } catch (error) { log("ERROR", "Failed to list archived screenshots", error.message); res.status(error.statusCode || 500).json({ error: "Unable to list archived screenshots." }); }
  });

  router.post("/screenshots/bulk-restore", requireAdminSession, async (req, res) => {
    try {
      const ids = requestIds(req.body.ids);
      if (ids.length === 0) return res.status(400).json({ error: "No screenshot ids were provided." });
      const restored = [];
      for (const id of ids) {
        const current = await readMetaById(id);
        if (current?.status === "archived") {
          const item = await restoreScreenshotById(id);
          if (item) restored.push(item);
        }
      }
      await enforceScreenshotLimit();
      res.json({ status: "restored", restored_count: restored.length, items: restored });
    } catch (error) { log("ERROR", "Failed to restore archived screenshots", error.message); res.status(error.statusCode || 500).json({ error: "Unable to restore selected screenshots." }); }
  });

  router.delete("/archive/bulk-delete", requireAdminSession, async (req, res) => {
    try {
      const ids = requestIds(req.body.ids);
      if (ids.length === 0) return res.status(400).json({ error: "No archived screenshot ids were provided." });
      const deleted = [];
      for (const id of ids) {
        const current = await readMetaById(id);
        if (current?.status === "archived") {
          const removed = await deleteScreenshotById(id);
          if (removed) deleted.push(removed);
        }
      }
      res.json({ status: "deleted", deleted_count: deleted.length, items: deleted });
    } catch (error) { log("ERROR", "Failed to permanently delete archived screenshots", error.message); res.status(error.statusCode || 500).json({ error: error.message || "Unable to permanently delete selected screenshots." }); }
  });

  router.post("/archive/:id/restore", requireAdminSession, async (req, res) => {
    try {
      const current = await readMetaById(req.params.id);
      if (current?.status !== "archived") return res.status(404).json({ error: "Archived screenshot not found." });
      const item = await restoreScreenshotById(req.params.id);
      await enforceScreenshotLimit();
      res.json({ status: "restored", item });
    } catch (error) { log("ERROR", `Failed to restore screenshot ${req.params.id}`, error.message); res.status(error.statusCode || 500).json({ error: "Unable to restore archived screenshot." }); }
  });

  router.delete("/archive/:id", requireAdminSession, async (req, res) => {
    try {
      const current = await readMetaById(req.params.id);
      if (current?.status !== "archived") return res.status(404).json({ error: "Archived screenshot not found." });
      const item = await deleteScreenshotById(req.params.id);
      res.json({ status: "deleted", item });
    } catch (error) { log("ERROR", `Failed to permanently delete screenshot ${req.params.id}`, error.message); res.status(error.statusCode || 500).json({ error: error.message || "Unable to permanently delete archived screenshot." }); }
  });

  router.patch("/screenshots/:id", async (req, res) => {
    try {
      const current = await readMetaById(req.params.id);
      if (!current) return res.status(404).json({ error: "Screenshot not found." });
      const updated = await writeMeta({ ...current, tags: req.body.tags !== undefined ? parseTags(req.body.tags) : current.tags, source: typeof req.body.source === "string" ? req.body.source.trim() : current.source });
      res.json({ status: "updated", item: updated });
    } catch (error) { log("ERROR", `Failed to update screenshot ${req.params.id}`, error.message); res.status(error.statusCode || 500).json({ error: "Unable to update screenshot metadata." }); }
  });

  router.delete("/screenshots/:id", async (req, res) => {
    try {
      const archived = await archiveScreenshotById(req.params.id);
      if (!archived) return res.status(404).json({ error: "Screenshot not found." });
      res.json({ status: "archived", item: archived });
    } catch (error) { log("ERROR", `Failed to archive screenshot ${req.params.id}`, error.message); res.status(error.statusCode || 500).json({ error: error.message || "Unable to archive screenshot." }); }
  });

  router.post("/screenshots/bulk-delete", async (req, res) => {
    try {
      const ids = requestIds(req.body.ids);
      if (ids.length === 0) return res.status(400).json({ error: "No screenshot ids were provided." });
      const archived = [];
      for (const id of ids) {
        const item = await archiveScreenshotById(id);
        if (item?.status === "archived") archived.push(item);
      }
      res.json({ status: "archived", archived_count: archived.length, items: archived });
    } catch (error) { log("ERROR", "Failed to archive screenshots", error.message); res.status(error.statusCode || 500).json({ error: error.message || "Unable to archive selected screenshots." }); }
  });

  router.get("/stats", async (req, res) => {
    try {
      const items = await listMetas();
      const activeItems = items.filter((item) => item.status === "active");
      const totalBytes = activeItems.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0);
      const daysWithData = new Set(activeItems.map((item) => String(item.timestamp || item.received_at || "").slice(0, 10)).filter(Boolean));
      res.json({ total_screenshots: activeItems.length, archived_screenshots: items.length - activeItems.length, total_size_mb: (totalBytes / (1024 * 1024)).toFixed(2), days_with_data: daysWithData.size, storage_dir: "cloudinary", max_screenshots: MAX_SCREENSHOTS });
    } catch (error) { log("ERROR", "Failed to build stats", error.message); res.status(error.statusCode || 500).json({ error: "Unable to calculate stats." }); }
  });

  return router;
}

module.exports = { createScreenshotRouter };
