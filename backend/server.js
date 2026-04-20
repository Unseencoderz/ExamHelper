/**
 * ExamHelper backend server.
 * Handles screenshot storage, cleanup, metadata management, and Gemini extraction.
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const ENV_FILE = path.join(__dirname, ".env");
loadLocalEnv(ENV_FILE);

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  try {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(filePath);
      return;
    }
  } catch (error) {
    console.warn(`[WARN] Failed to load ${filePath} with process.loadEnvFile: ${error.message}`);
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const rawKey = trimmed.slice(0, separatorIndex).trim();
    const key = rawKey.startsWith("export ") ? rawKey.slice("export ".length).trim() : rawKey;
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    const hasDoubleQuotes = value.startsWith('"') && value.endsWith('"');
    const hasSingleQuotes = value.startsWith("'") && value.endsWith("'");
    if (hasDoubleQuotes || hasSingleQuotes) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, "uploads");
const META_DIR = path.join(STORAGE_DIR, ".meta");
const LOG_FILE = path.join(__dirname, "server.log");
const MAX_FILE_SIZE = Number.parseInt(process.env.MAX_FILE_SIZE_MB || "80", 10) * 1024 * 1024;
const MAX_SCREENSHOTS = Number.parseInt(process.env.MAX_SCREENSHOTS || "50", 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
  GEMINI_MODEL
)}:generateContent`;
const WEB_DIR = process.env.WEB_DIR || path.resolve(__dirname, "..", "web-frontend");

[STORAGE_DIR, META_DIR].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

function log(level, message, extra = "") {
  const line = `${new Date().toISOString()} [${level}] ${message} ${extra}`.trimEnd() + "\n";
  process.stdout.write(line);
  fs.appendFileSync(LOG_FILE, line);
}

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    log("WARN", `Invalid JSON ignored: ${filePath}`, error.message);
    return null;
  }
}

function parseTags(value) {
  if (Array.isArray(value)) {
    return value
      .map((tag) => String(tag).trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((tag) => String(tag).trim()).filter(Boolean);
      }
    } catch {
      // Fall back to comma-separated parsing.
    }

    return trimmed
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function createSource(meta) {
  if (meta.source && String(meta.source).trim()) {
    return String(meta.source).trim();
  }

  const parts = [meta.device_id, meta.label].filter(Boolean).map((value) => String(value).trim());
  return parts.join(" / ") || "desktop-client";
}

function listDayFolders() {
  return fs
    .readdirSync(STORAGE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name);
}

function resolveRelativePath(meta) {
  const candidates = [];

  if (meta.relative_path) {
    candidates.push(toPosix(meta.relative_path).replace(/^\/+/, ""));
  }

  if (meta.filepath) {
    const normalizedPath = toPosix(meta.filepath);
    const uploadsMarker = "/uploads/";
    const uploadsIndex = normalizedPath.lastIndexOf(uploadsMarker);
    if (uploadsIndex !== -1) {
      candidates.push(normalizedPath.slice(uploadsIndex + uploadsMarker.length));
    }

    const tailMatch = normalizedPath.match(/(\d{4}-\d{2}-\d{2}\/[^/]+)$/);
    if (tailMatch) {
      candidates.push(tailMatch[1]);
    }
  }

  if (meta.filename) {
    const day = String(meta.timestamp || meta.received_at || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      candidates.push(`${day}/${meta.filename}`);
    }
  }

  for (const candidate of candidates) {
    const normalized = toPosix(candidate).replace(/^\/+/, "");
    const absolutePath = path.join(STORAGE_DIR, ...normalized.split("/"));
    if (fs.existsSync(absolutePath)) {
      return normalized;
    }
  }

  if (!meta.filename) {
    return null;
  }

  for (const day of listDayFolders()) {
    const relativePath = `${day}/${meta.filename}`;
    const absolutePath = path.join(STORAGE_DIR, day, meta.filename);
    if (fs.existsSync(absolutePath)) {
      return relativePath;
    }
  }

  return null;
}

function normalizeMeta(meta, metaFilePath) {
  const id = meta.id || path.parse(metaFilePath || "").name || crypto.randomUUID();
  const filename = meta.filename || (meta.filepath ? path.basename(meta.filepath) : null) || `${id}.jpeg`;
  const relativePath = resolveRelativePath({ ...meta, id, filename });
  const absolutePath = relativePath
    ? path.join(STORAGE_DIR, ...relativePath.split("/"))
    : meta.filepath && fs.existsSync(meta.filepath)
      ? meta.filepath
      : null;
  const receivedAt =
    meta.received_at ||
    meta.timestamp ||
    (metaFilePath && fs.existsSync(metaFilePath)
      ? fs.statSync(metaFilePath).mtime.toISOString()
      : new Date().toISOString());

  return {
    ...meta,
    id,
    filename,
    timestamp: meta.timestamp || receivedAt,
    received_at: receivedAt,
    tags: parseTags(meta.tags),
    source: createSource(meta),
    relative_path: relativePath,
    filepath: absolutePath,
    image_url: relativePath ? `/media/${relativePath}` : null,
  };
}

function metaFileFor(id) {
  return path.join(META_DIR, `${id}.json`);
}

function writeMeta(meta) {
  const normalized = normalizeMeta(meta);
  fs.writeFileSync(metaFileFor(normalized.id), JSON.stringify(normalized, null, 2));
  return normalized;
}

function readMetaById(id) {
  const filePath = metaFileFor(id);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = safeReadJson(filePath);
  return raw ? normalizeMeta(raw, filePath) : null;
}

function hasUsableImageFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return false;
  }

  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function listMetas() {
  return fs
    .readdirSync(META_DIR)
    .filter((name) => name.endsWith(".json"))
    .flatMap((name) => {
      const filePath = path.join(META_DIR, name);
      const raw = safeReadJson(filePath);
      if (!raw) {
        return [];
      }

      const normalized = normalizeMeta(raw, filePath);
      if (hasUsableImageFile(normalized.filepath)) {
        return [normalized];
      }

      log("WARN", `Removing stale metadata without a usable image: ${normalized.id}`);
      fs.unlinkSync(filePath);
      return [];
    })
}

function cleanupEmptyDayDirs() {
  for (const day of listDayFolders()) {
    const dayDir = path.join(STORAGE_DIR, day);
    if (fs.readdirSync(dayDir).length === 0) {
      fs.rmdirSync(dayDir);
    }
  }
}

function deleteScreenshotById(id) {
  const meta = readMetaById(id);
  if (!meta) {
    return null;
  }

  if (meta.filepath && fs.existsSync(meta.filepath)) {
    fs.unlinkSync(meta.filepath);
  }

  const metaPath = metaFileFor(id);
  if (fs.existsSync(metaPath)) {
    fs.unlinkSync(metaPath);
  }

  cleanupEmptyDayDirs();
  return meta;
}

function enforceScreenshotLimit() {
  const metas = listMetas().sort(
    (left, right) => new Date(left.received_at).getTime() - new Date(right.received_at).getTime()
  );

  if (metas.length <= MAX_SCREENSHOTS) {
    return [];
  }

  const overflow = metas.length - MAX_SCREENSHOTS;
  const deleted = [];

  for (const meta of metas.slice(0, overflow)) {
    const removed = deleteScreenshotById(meta.id);
    if (removed) {
      deleted.push(removed);
    }
  }

  return deleted;
}

function migrateMetaFiles() {
  const metaFiles = fs.readdirSync(META_DIR).filter((name) => name.endsWith(".json"));

  for (const fileName of metaFiles) {
    const filePath = path.join(META_DIR, fileName);
    const raw = safeReadJson(filePath);
    if (!raw) {
      continue;
    }

    const normalized = normalizeMeta(raw, filePath);
    fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2));
  }
}

function detectMimeType(filename = "") {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".webp") {
    return "image/webp";
  }
  return "image/jpeg";
}

async function extractTextWithGemini(items) {
  if (!GEMINI_API_KEY) {
    const error = new Error("GEMINI_API_KEY is not configured on the backend.");
    error.statusCode = 503;
    throw error;
  }

  const totalBytes = items.reduce((sum, item) => sum + item.image.length, 0);
  if (totalBytes > 18 * 1024 * 1024) {
    const error = new Error("Selected images are too large for inline Gemini processing. Try fewer screenshots.");
    error.statusCode = 413;
    throw error;
  }

  const prompt =
    "Extract all readable text from these screenshots. " +
    "Preserve the order of the screenshots, keep the content clean and faithful, " +
    "and add a short heading like 'Screenshot 1', 'Screenshot 2' before each section.";

  const parts = [{ text: prompt }];
  items.forEach((item, index) => {
    parts.push({
      text: `Screenshot ${index + 1} (${item.label || item.filename || item.id})`,
    });
    parts.push({
      inline_data: {
        mime_type: item.mimetype || detectMimeType(item.filename),
        data: item.image.toString("base64"),
      },
    });
  });

  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      payload.error?.message || `Gemini request failed with status ${response.status}.`
    );
    error.statusCode = 502;
    throw error;
  }

  const text = (payload.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (!text) {
    const error = new Error("Gemini returned an empty response for the selected screenshots.");
    error.statusCode = 502;
    throw error;
  }

  return text;
}

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    const day = new Date().toISOString().slice(0, 10);
    const dayDir = path.join(STORAGE_DIR, day);
    fs.mkdirSync(dayDir, { recursive: true });
    callback(null, dayDir);
  },
  filename: (req, file, callback) => {
    const id = req.body.id || crypto.randomUUID();
    const ext = path.extname(file.originalname) || ".jpg";
    callback(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, callback) => {
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (allowedTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Unsupported MIME type: ${file.mimetype}`));
  },
});

const app = express();
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  "/media",
  express.static(STORAGE_DIR, {
    dotfiles: "deny",
    maxAge: "1h",
  })
);

if (fs.existsSync(WEB_DIR)) {
  app.use(
    express.static(WEB_DIR, {
      index: false,
      extensions: ["html"],
    })
  );
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    max_screenshots: MAX_SCREENSHOTS,
  });
});

app.post("/upload", (req, res, next) => {
  upload.single("screenshot")(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      log("WARN", "Multer error", error.message);
      return res.status(400).json({ error: error.message });
    }

    if (error) {
      log("WARN", "Upload error", error.message);
      return res.status(400).json({ error: error.message });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No screenshot file provided." });
      }

      if (!hasUsableImageFile(req.file.path)) {
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ error: "The uploaded screenshot file was empty or unreadable." });
      }

      const id = req.body.id || path.parse(req.file.filename).name;
      const existingMeta = readMetaById(id);
      if (existingMeta) {
        if (hasUsableImageFile(existingMeta.filepath)) {
          fs.unlinkSync(req.file.path);
          log("INFO", `Duplicate upload ignored: ${id}`);
          return res.status(409).json({ status: "duplicate", id });
        }

        log("WARN", `Replacing stale metadata record for upload ${id}`);
        deleteScreenshotById(id);
      }

      const savedSize = fs.statSync(req.file.path).size;

      const meta = writeMeta({
        id,
        device_id: req.body.device_id || "unknown-device",
        timestamp: req.body.timestamp || new Date().toISOString(),
        label: req.body.label || "screenshot",
        source: req.body.source || "",
        tags: req.body.tags || [],
        filename: req.file.filename,
        filepath: req.file.path,
        relative_path: toPosix(path.relative(STORAGE_DIR, req.file.path)),
        size_bytes: savedSize,
        mimetype: req.file.mimetype,
        received_at: new Date().toISOString(),
      });

      const trimmed = enforceScreenshotLimit();
      if (trimmed.length > 0) {
        log("INFO", `FIFO cleanup removed ${trimmed.length} screenshot(s)`);
      }

      log(
        "INFO",
        `Stored screenshot ${meta.filename}`,
        `(${(savedSize / 1024).toFixed(1)} KB, source=${meta.source})`
      );

      return res.status(201).json({
        status: "stored",
        item: meta,
        trimmed: trimmed.map((item) => item.id),
      });
    } catch (handlerError) {
      log("ERROR", "Upload handler failed", handlerError.message);
      return next(handlerError);
    }
  });
});

app.get("/screenshots", (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit || "100", 10), 1), 200);
    const source = req.query.source ? String(req.query.source) : null;
    const tag = req.query.tag ? String(req.query.tag) : null;

    const allItems = listMetas()
      .filter((item) => !source || item.source === source)
      .filter((item) => !tag || item.tags.includes(tag))
      .sort((left, right) => new Date(right.received_at).getTime() - new Date(left.received_at).getTime());

    const items = allItems.slice((page - 1) * limit, page * limit);
    res.json({
      total: allItems.length,
      page,
      limit,
      items,
    });
  } catch (error) {
    log("ERROR", "Failed to list screenshots", error.message);
    res.status(500).json({ error: "Unable to list screenshots." });
  }
});

app.patch("/screenshots/:id", (req, res) => {
  try {
    const current = readMetaById(req.params.id);
    if (!current) {
      return res.status(404).json({ error: "Screenshot not found." });
    }

    const updated = writeMeta({
      ...current,
      tags: req.body.tags !== undefined ? parseTags(req.body.tags) : current.tags,
      source: typeof req.body.source === "string" ? req.body.source.trim() : current.source,
    });

    res.json({ status: "updated", item: updated });
  } catch (error) {
    log("ERROR", `Failed to update screenshot ${req.params.id}`, error.message);
    res.status(500).json({ error: "Unable to update screenshot metadata." });
  }
});

app.delete("/screenshots/:id", (req, res) => {
  try {
    const removed = deleteScreenshotById(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: "Screenshot not found." });
    }

    log("INFO", `Deleted screenshot ${removed.id}`);
    res.json({ status: "deleted", item: removed });
  } catch (error) {
    log("ERROR", `Failed to delete screenshot ${req.params.id}`, error.message);
    res.status(500).json({ error: "Unable to delete screenshot." });
  }
});

app.post("/screenshots/bulk-delete", (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids.map((id) => String(id)))] : [];
    if (ids.length === 0) {
      return res.status(400).json({ error: "No screenshot ids were provided." });
    }

    const deleted = ids.map(deleteScreenshotById).filter(Boolean);
    log("INFO", `Bulk deleted ${deleted.length} screenshot(s)`);
    res.json({
      status: "deleted",
      deleted_count: deleted.length,
      items: deleted,
    });
  } catch (error) {
    log("ERROR", "Failed bulk delete", error.message);
    res.status(500).json({ error: "Unable to delete selected screenshots." });
  }
});

app.post("/extract-text", async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids.map((id) => String(id)))] : [];
    if (ids.length === 0) {
      return res.status(400).json({ error: "Select at least one screenshot first." });
    }

    const metas = ids.map(readMetaById).filter(Boolean);
    if (metas.length !== ids.length) {
      return res.status(404).json({ error: "One or more selected screenshots could not be found." });
    }

    const extractionItems = metas.map((meta) => {
      if (!meta.filepath || !fs.existsSync(meta.filepath)) {
        const error = new Error(`Missing image file for screenshot ${meta.id}.`);
        error.statusCode = 404;
        throw error;
      }

      return {
        ...meta,
        image: fs.readFileSync(meta.filepath),
      };
    });

    const text = await extractTextWithGemini(extractionItems);
    res.json({
      status: "ok",
      text,
      items: metas.map(({ id, label, filename, source, timestamp }) => ({
        id,
        label,
        filename,
        source,
        timestamp,
      })),
    });
  } catch (error) {
    log("ERROR", "Text extraction failed", error.message);
    res.status(error.statusCode || 500).json({ error: error.message || "Text extraction failed." });
  }
});

app.get("/stats", (req, res) => {
  try {
    const items = listMetas();
    const totalBytes = items.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0);
    const daysWithData = new Set(
      items.map((item) => String(item.timestamp || item.received_at || "").slice(0, 10)).filter(Boolean)
    );

    res.json({
      total_screenshots: items.length,
      total_size_mb: (totalBytes / (1024 * 1024)).toFixed(2),
      days_with_data: daysWithData.size,
      storage_dir: STORAGE_DIR,
      max_screenshots: MAX_SCREENSHOTS,
    });
  } catch (error) {
    log("ERROR", "Failed to build stats", error.message);
    res.status(500).json({ error: "Unable to calculate stats." });
  }
});

app.get("/", (req, res) => {
  if (!fs.existsSync(path.join(WEB_DIR, "index.html"))) {
    return res.status(404).send("web-frontend/index.html is missing.");
  }

  return res.sendFile(path.join(WEB_DIR, "index.html"));
});

app.use((error, req, res, next) => {
  log("ERROR", "Unhandled server error", error.message);
  res.status(500).json({ error: "Internal server error." });
});

migrateMetaFiles();
listMetas();
const startupTrimmed = enforceScreenshotLimit();
if (startupTrimmed.length > 0) {
  log("INFO", `Startup cleanup removed ${startupTrimmed.length} screenshot(s)`);
}

app.listen(PORT, () => {
  log("INFO", `ExamHelper backend running on http://localhost:${PORT}`);
  log("INFO", `Storage directory: ${STORAGE_DIR}`);
  log(
    "INFO",
    "Endpoints ready: POST /upload, GET /screenshots, DELETE /screenshots/:id, POST /extract-text"
  );
});
