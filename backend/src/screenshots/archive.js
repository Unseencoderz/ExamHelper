const fs = require("fs");
const { cloudinary, CLOUDINARY_CONFIGURED, CLOUDINARY_ARCHIVE_FOLDER, ARCHIVE_AFTER_MS, MAX_SCREENSHOTS } = require("../config");
const { log } = require("../logger");
const { readMetaById, writeMeta, listMetas, metaFileFor, cleanupEmptyDayDirs, hasUsableImageFile, hasUsableCloudinaryAsset } = require("./meta");

function requireCloudinaryArchive() {
  if (CLOUDINARY_CONFIGURED) return;
  const error = new Error("Cloudinary archive storage is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
  error.statusCode = 503; throw error;
}
async function uploadArchiveToCloudinary(meta) {
  if (hasUsableCloudinaryAsset(meta)) return meta.cloudinary;
  requireCloudinaryArchive();
  if (!hasUsableImageFile(meta.filepath)) { const error = new Error(`Cannot archive ${meta.id}: its local image file is unavailable.`); error.statusCode = 404; throw error; }
  try {
    const uploaded = await cloudinary.uploader.upload(meta.filepath, { resource_type: "image", folder: CLOUDINARY_ARCHIVE_FOLDER, public_id: meta.id, overwrite: true, unique_filename: false, use_filename: false, context: { examhelper_id: meta.id, source: meta.source || "desktop-client" } });
    return { asset_id: uploaded.asset_id, public_id: uploaded.public_id, secure_url: uploaded.secure_url, bytes: uploaded.bytes, format: uploaded.format, uploaded_at: new Date().toISOString() };
  } catch (cause) { const error = new Error(`Cloudinary archive upload failed: ${cause.message}`); error.statusCode = 502; throw error; }
}
async function deleteScreenshotById(id) {
  const meta = readMetaById(id); if (!meta) return null;
  if (meta.cloudinary?.public_id) {
    if (!CLOUDINARY_CONFIGURED) { const error = new Error("Cloudinary is not configured, so the archived image cannot be deleted safely."); error.statusCode = 503; throw error; }
    const result = await cloudinary.uploader.destroy(meta.cloudinary.public_id, { resource_type: "image", invalidate: true });
    if (result.result !== "ok" && result.result !== "not found") { const error = new Error("Cloudinary could not delete the archived image."); error.statusCode = 502; throw error; }
  }
  if (meta.filepath && fs.existsSync(meta.filepath)) fs.unlinkSync(meta.filepath);
  const metaPath = metaFileFor(id); if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  cleanupEmptyDayDirs(); return meta;
}
async function archiveScreenshotById(id) {
  const meta = readMetaById(id); if (!meta || meta.archived_at) return meta;
  const cloudinaryAsset = await uploadArchiveToCloudinary(meta);
  const archived = writeMeta({ ...meta, cloudinary: cloudinaryAsset, archived_at: new Date().toISOString() });
  if (meta.filepath && fs.existsSync(meta.filepath)) fs.unlinkSync(meta.filepath);
  cleanupEmptyDayDirs(); return writeMeta({ ...archived, filepath: null, relative_path: null, cloudinary: cloudinaryAsset });
}
function restoreScreenshotById(id) { const meta = readMetaById(id); return !meta || !meta.archived_at ? meta : writeMeta({ ...meta, archived_at: null, dashboard_since: new Date().toISOString() }); }
async function archiveExpiredScreenshots() {
  if (!CLOUDINARY_CONFIGURED) return [];
  const now = Date.now(); const archived = [];
  for (const meta of listMetas().filter((item) => { const dashboardSince = Date.parse(item.dashboard_since || item.received_at); return !item.archived_at && Number.isFinite(dashboardSince) && now - dashboardSince >= ARCHIVE_AFTER_MS; })) archived.push(await archiveScreenshotById(meta.id));
  return archived.filter(Boolean);
}
async function enforceScreenshotLimit() {
  const metas = listMetas().filter((meta) => !meta.archived_at).sort((left, right) => Date.parse(left.dashboard_since || left.received_at) - Date.parse(right.dashboard_since || right.received_at));
  if (metas.length <= MAX_SCREENSHOTS) return [];
  if (!CLOUDINARY_CONFIGURED) { log("WARN", "Screenshot limit reached but Cloudinary archive storage is not configured."); return []; }
  const archived = [];
  for (const meta of metas.slice(0, metas.length - MAX_SCREENSHOTS)) { const moved = await archiveScreenshotById(meta.id); if (moved) archived.push(moved); }
  return archived;
}
async function migrateArchivedScreenshotsToCloudinary() {
  if (!CLOUDINARY_CONFIGURED) return [];
  const migrated = [];
  for (const meta of listMetas().filter((item) => item.archived_at && !hasUsableCloudinaryAsset(item))) {
    try { const cloudinaryAsset = await uploadArchiveToCloudinary(meta); const saved = writeMeta({ ...meta, cloudinary: cloudinaryAsset }); if (meta.filepath && fs.existsSync(meta.filepath)) fs.unlinkSync(meta.filepath); migrated.push(writeMeta({ ...saved, filepath: null, relative_path: null, cloudinary: cloudinaryAsset })); }
    catch (error) { log("WARN", `Could not migrate archived screenshot ${meta.id} to Cloudinary`, error.message); }
  }
  cleanupEmptyDayDirs(); return migrated;
}
async function runArchiveMaintenance(reason) {
  try {
    const migrated = await migrateArchivedScreenshotsToCloudinary(); if (migrated.length > 0) log("INFO", `${reason} migrated ${migrated.length} archived screenshot(s) to Cloudinary`);
    const archived = await archiveExpiredScreenshots(); if (archived.length > 0) log("INFO", `${reason} auto-archived ${archived.length} screenshot(s)`);
    const limitArchived = await enforceScreenshotLimit(); if (limitArchived.length > 0) log("INFO", `${reason} screenshot limit archived ${limitArchived.length} screenshot(s)`);
  } catch (error) { log("WARN", `${reason} archive maintenance paused`, error.message); }
}

module.exports = { requireCloudinaryArchive, uploadArchiveToCloudinary, archiveScreenshotById, restoreScreenshotById, deleteScreenshotById, archiveExpiredScreenshots, enforceScreenshotLimit, migrateArchivedScreenshotsToCloudinary, runArchiveMaintenance };
