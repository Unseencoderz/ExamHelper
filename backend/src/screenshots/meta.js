const { requireSupabase, throwIfDatabaseError } = require("../supabase");

function parseTags(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map((tag) => String(tag).trim()).filter(Boolean);
  } catch { /* comma-separated fallback */ }
  return trimmed.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function createSource(meta) {
  if (meta.source && String(meta.source).trim()) return String(meta.source).trim();
  const parts = [meta.device_id, meta.label].filter(Boolean).map((value) => String(value).trim());
  return parts.join(" / ") || "desktop-client";
}

function normalizeMeta(meta) {
  const cloudinaryAsset = meta.cloudinary_asset || meta.cloudinary || null;
  const cloudinaryUrl = meta.cloudinary_url || cloudinaryAsset?.secure_url || cloudinaryAsset?.url || null;
  const status = meta.status || (meta.archived_at ? "archived" : "active");
  const receivedAt = meta.received_at || meta.timestamp || meta.created_at || new Date().toISOString();
  return {
    ...meta,
    id: String(meta.id),
    filename: meta.filename || `${meta.id}.jpg`,
    timestamp: meta.timestamp || receivedAt,
    received_at: receivedAt,
    tags: parseTags(meta.tags),
    source: createSource(meta),
    status,
    archived_at: status === "archived" ? (meta.archived_at || receivedAt) : null,
    cloudinary: cloudinaryAsset,
    cloudinary_url: cloudinaryUrl,
    image_url: cloudinaryUrl,
  };
}

function metaToRow(meta) {
  const normalized = normalizeMeta(meta);
  return {
    id: normalized.id,
    cloudinary_url: normalized.cloudinary_url,
    cloudinary_public_id: normalized.cloudinary?.public_id || normalized.cloudinary_public_id || null,
    cloudinary_asset: normalized.cloudinary,
    status: normalized.status,
    source: normalized.source,
    tags: normalized.tags,
    device_id: normalized.device_id || "unknown-device",
    timestamp: normalized.timestamp,
    label: normalized.label || "screenshot",
    filename: normalized.filename,
    size_bytes: Number(normalized.size_bytes || 0),
    mimetype: normalized.mimetype || null,
    received_at: normalized.received_at,
    dashboard_since: normalized.dashboard_since || null,
    archived_at: normalized.archived_at,
  };
}

async function readMetaById(id) {
  const { data, error } = await requireSupabase().from("screenshots").select("*").eq("id", String(id)).maybeSingle();
  throwIfDatabaseError(error, "read screenshot");
  return data ? normalizeMeta(data) : null;
}

async function writeMeta(meta) {
  const { data, error } = await requireSupabase().from("screenshots").upsert(metaToRow(meta), { onConflict: "id" }).select().single();
  throwIfDatabaseError(error, "save screenshot");
  return normalizeMeta(data);
}

async function deleteMetaById(id) {
  const { data, error } = await requireSupabase().from("screenshots").delete().eq("id", String(id)).select().maybeSingle();
  throwIfDatabaseError(error, "delete screenshot");
  return data ? normalizeMeta(data) : null;
}

async function listMetas() {
  const { data, error } = await requireSupabase().from("screenshots").select("*").order("received_at", { ascending: false });
  throwIfDatabaseError(error, "list screenshots");
  return (data || []).map(normalizeMeta);
}

function hasUsableCloudinaryAsset(meta) {
  return Boolean(meta?.cloudinary?.secure_url || meta?.cloudinary?.url || meta?.cloudinary_url);
}

module.exports = { normalizeMeta, writeMeta, readMetaById, deleteMetaById, listMetas, parseTags, createSource, hasUsableCloudinaryAsset };
