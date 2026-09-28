const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { STORAGE_DIR, META_DIR } = require("../config");
const { safeReadJson, toPosix } = require("../jsonStore");
const { log } = require("../logger");

function parseTags(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try { const parsed = JSON.parse(trimmed); if (Array.isArray(parsed)) return parsed.map((tag) => String(tag).trim()).filter(Boolean); } catch { /* comma-separated fallback */ }
  return trimmed.split(",").map((tag) => tag.trim()).filter(Boolean);
}
function createSource(meta) {
  if (meta.source && String(meta.source).trim()) return String(meta.source).trim();
  const parts = [meta.device_id, meta.label].filter(Boolean).map((value) => String(value).trim());
  return parts.join(" / ") || "desktop-client";
}
function listDayFolders() {
  return fs.readdirSync(STORAGE_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name)).map((entry) => entry.name);
}
function resolveRelativePath(meta) {
  const candidates = [];
  if (meta.relative_path) candidates.push(toPosix(meta.relative_path).replace(/^\/+/, ""));
  if (meta.filepath) {
    const normalizedPath = toPosix(meta.filepath);
    const uploadsIndex = normalizedPath.lastIndexOf("/uploads/");
    if (uploadsIndex !== -1) candidates.push(normalizedPath.slice(uploadsIndex + "/uploads/".length));
    const tailMatch = normalizedPath.match(/(\d{4}-\d{2}-\d{2}\/[^/]+)$/);
    if (tailMatch) candidates.push(tailMatch[1]);
  }
  if (meta.filename) {
    const day = String(meta.timestamp || meta.received_at || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) candidates.push(`${day}/${meta.filename}`);
  }
  for (const candidate of candidates) {
    const normalized = toPosix(candidate).replace(/^\/+/, "");
    if (fs.existsSync(path.join(STORAGE_DIR, ...normalized.split("/")))) return normalized;
  }
  if (!meta.filename) return null;
  for (const day of listDayFolders()) {
    const relativePath = `${day}/${meta.filename}`;
    if (fs.existsSync(path.join(STORAGE_DIR, day, meta.filename))) return relativePath;
  }
  return null;
}
function normalizeMeta(meta, metaFilePath) {
  const id = meta.id || path.parse(metaFilePath || "").name || crypto.randomUUID();
  const filename = meta.filename || (meta.filepath ? path.basename(meta.filepath) : null) || `${id}.jpeg`;
  const relativePath = resolveRelativePath({ ...meta, id, filename });
  const absolutePath = relativePath ? path.join(STORAGE_DIR, ...relativePath.split("/")) : meta.filepath && fs.existsSync(meta.filepath) ? meta.filepath : null;
  const receivedAt = meta.received_at || meta.timestamp || (metaFilePath && fs.existsSync(metaFilePath) ? fs.statSync(metaFilePath).mtime.toISOString() : new Date().toISOString());
  const cloudinaryAsset = meta.cloudinary && typeof meta.cloudinary === "object" ? meta.cloudinary : null;
  const cloudinaryUrl = cloudinaryAsset?.secure_url || cloudinaryAsset?.url || (typeof meta.cloudinary_url === "string" ? meta.cloudinary_url : null);
  return { ...meta, id, filename, timestamp: meta.timestamp || receivedAt, received_at: receivedAt, tags: parseTags(meta.tags), source: createSource(meta), relative_path: relativePath, filepath: absolutePath, cloudinary: cloudinaryAsset, image_url: cloudinaryUrl || (relativePath ? `/media/${relativePath}` : null) };
}
function metaFileFor(id) { return path.join(META_DIR, `${id}.json`); }
function writeMeta(meta) { const normalized = normalizeMeta(meta); fs.writeFileSync(metaFileFor(normalized.id), JSON.stringify(normalized, null, 2)); return normalized; }
function readMetaById(id) { const filePath = metaFileFor(id); if (!fs.existsSync(filePath)) return null; const raw = safeReadJson(filePath); return raw ? normalizeMeta(raw, filePath) : null; }
function hasUsableImageFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  try { const stat = fs.statSync(filePath); return stat.isFile() && stat.size > 0; } catch { return false; }
}
function hasUsableCloudinaryAsset(meta) { return Boolean(meta?.cloudinary?.secure_url || meta?.cloudinary?.url || meta?.cloudinary_url); }
function listMetas() {
  return fs.readdirSync(META_DIR).filter((name) => name.endsWith(".json")).flatMap((name) => {
    const filePath = path.join(META_DIR, name); const raw = safeReadJson(filePath); if (!raw) return [];
    const normalized = normalizeMeta(raw, filePath);
    if (hasUsableImageFile(normalized.filepath) || hasUsableCloudinaryAsset(normalized)) return [normalized];
    log("WARN", `Removing stale metadata without a usable image: ${normalized.id}`); fs.unlinkSync(filePath); return [];
  });
}
function cleanupEmptyDayDirs() { for (const day of listDayFolders()) { const dayDir = path.join(STORAGE_DIR, day); if (fs.readdirSync(dayDir).length === 0) fs.rmdirSync(dayDir); } }
function migrateMetaFiles() {
  for (const fileName of fs.readdirSync(META_DIR).filter((name) => name.endsWith(".json"))) {
    const filePath = path.join(META_DIR, fileName); const raw = safeReadJson(filePath);
    if (raw) fs.writeFileSync(filePath, JSON.stringify(normalizeMeta(raw, filePath), null, 2));
  }
}

module.exports = { normalizeMeta, writeMeta, readMetaById, listMetas, migrateMetaFiles, resolveRelativePath, listDayFolders, cleanupEmptyDayDirs, parseTags, createSource, hasUsableImageFile, hasUsableCloudinaryAsset, metaFileFor };
