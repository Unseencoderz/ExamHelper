const { cloudinary, CLOUDINARY_CONFIGURED, CLOUDINARY_SCREENSHOT_FOLDER, ARCHIVE_AFTER_MS, MAX_SCREENSHOTS } = require("../config");
const { log } = require("../logger");
const { readMetaById, writeMeta, deleteMetaById, listMetas } = require("./meta");

function requireCloudinary() {
  if (CLOUDINARY_CONFIGURED) return;
  const error = new Error("Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
  error.statusCode = 503;
  throw error;
}

function uploadScreenshotToCloudinary(buffer, meta) {
  requireCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      resource_type: "image",
      folder: CLOUDINARY_SCREENSHOT_FOLDER,
      public_id: meta.id,
      overwrite: false,
      unique_filename: false,
      use_filename: false,
      context: { examhelper_id: meta.id, source: meta.source || "desktop-client" },
    }, (error, uploaded) => {
      if (error) {
        const wrapped = new Error(`Cloudinary upload failed: ${error.message}`);
        wrapped.statusCode = 502;
        reject(wrapped);
        return;
      }
      resolve({
        asset_id: uploaded.asset_id,
        public_id: uploaded.public_id,
        secure_url: uploaded.secure_url,
        bytes: uploaded.bytes,
        format: uploaded.format,
        uploaded_at: new Date().toISOString(),
      });
    });
    stream.end(buffer);
  });
}

async function deleteScreenshotById(id) {
  const meta = await readMetaById(id);
  if (!meta) return null;
  requireCloudinary();
  const publicId = meta.cloudinary?.public_id || meta.cloudinary_public_id;
  if (!publicId) {
    const error = new Error(`Screenshot ${id} has no Cloudinary public ID.`);
    error.statusCode = 500;
    throw error;
  }
  await deleteCloudinaryAsset({ public_id: publicId });
  return deleteMetaById(id);
}

async function deleteCloudinaryAsset(asset) {
  requireCloudinary();
  const result = await cloudinary.uploader.destroy(asset.public_id, { resource_type: "image", invalidate: true });
  if (result.result !== "ok" && result.result !== "not found") {
    const error = new Error("Cloudinary could not delete the screenshot image.");
    error.statusCode = 502;
    throw error;
  }
}

async function archiveScreenshotById(id) {
  const meta = await readMetaById(id);
  if (!meta || meta.status === "archived") return meta;
  return writeMeta({ ...meta, status: "archived", archived_at: new Date().toISOString() });
}

async function restoreScreenshotById(id) {
  const meta = await readMetaById(id);
  if (!meta || meta.status !== "archived") return meta;
  return writeMeta({ ...meta, status: "active", archived_at: null, dashboard_since: new Date().toISOString() });
}

async function archiveExpiredScreenshots() {
  const now = Date.now();
  const metas = await listMetas();
  const archived = [];
  for (const meta of metas.filter((item) => {
    const dashboardSince = Date.parse(item.dashboard_since || item.received_at);
    return item.status === "active" && Number.isFinite(dashboardSince) && now - dashboardSince >= ARCHIVE_AFTER_MS;
  })) archived.push(await archiveScreenshotById(meta.id));
  return archived.filter(Boolean);
}

async function enforceScreenshotLimit() {
  const metas = (await listMetas()).filter((meta) => meta.status === "active")
    .sort((left, right) => Date.parse(left.dashboard_since || left.received_at) - Date.parse(right.dashboard_since || right.received_at));
  if (metas.length <= MAX_SCREENSHOTS) return [];
  const archived = [];
  for (const meta of metas.slice(0, metas.length - MAX_SCREENSHOTS)) {
    const moved = await archiveScreenshotById(meta.id);
    if (moved) archived.push(moved);
  }
  return archived;
}

async function runArchiveMaintenance(reason) {
  try {
    const archived = await archiveExpiredScreenshots();
    if (archived.length > 0) log("INFO", `${reason} auto-archived ${archived.length} screenshot(s)`);
    const limitArchived = await enforceScreenshotLimit();
    if (limitArchived.length > 0) log("INFO", `${reason} screenshot limit archived ${limitArchived.length} screenshot(s)`);
  } catch (error) {
    log("WARN", `${reason} archive maintenance paused`, error.message);
  }
}

module.exports = { requireCloudinary, uploadScreenshotToCloudinary, deleteCloudinaryAsset, archiveScreenshotById, restoreScreenshotById, deleteScreenshotById, archiveExpiredScreenshots, enforceScreenshotLimit, runArchiveMaintenance };
