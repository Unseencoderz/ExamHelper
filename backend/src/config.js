const path = require("path");
const fs = require("fs");
const { v2: cloudinary } = require("cloudinary");

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(filePath);
      return;
    }
  } catch (error) {
    console.warn(`[WARN] Failed to load ${filePath} with process.loadEnvFile: ${error.message}`);
  }
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const rawKey = trimmed.slice(0, separatorIndex).trim();
    const key = rawKey.startsWith("export ") ? rawKey.slice("export ".length).trim() : rawKey;
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

loadLocalEnv(path.join(__dirname, "..", ".env"));

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const MAX_FILE_SIZE = Number.parseInt(process.env.MAX_FILE_SIZE_MB || "80", 10) * 1024 * 1024;
const MAX_SCREENSHOTS = Number.parseInt(process.env.MAX_SCREENSHOTS || "50", 10);
const ARCHIVE_AFTER_MS = 30 * 60 * 1000;
const WEB_DIR = process.env.WEB_DIR || path.resolve(__dirname, "..", "..", "web-app", "dist");
const DEFAULT_SCREENSHOT_HOTKEY = process.env.DEFAULT_SCREENSHOT_HOTKEY || "Win+Alt+C";
const CLOUDINARY_SCREENSHOT_FOLDER = (process.env.CLOUDINARY_SCREENSHOT_FOLDER || process.env.CLOUDINARY_ARCHIVE_FOLDER || "examhelper/screenshots").replace(/^\/+|\/+$/g, "") || "examhelper/screenshots";
const CLOUDINARY_CONFIGURED = Boolean(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET));
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "";
const ADMIN_SESSION_TTL_HOURS = Math.max(Number.parseInt(process.env.ADMIN_SESSION_TTL_HOURS || "24", 10) || 24, 1);
const ADMIN_SESSION_CONFIGURED = Boolean(ADMIN_SESSION_SECRET);

if (CLOUDINARY_CONFIGURED) {
  cloudinary.config(process.env.CLOUDINARY_URL ? { secure: true } : {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

module.exports = { loadLocalEnv, PORT, MAX_FILE_SIZE, MAX_SCREENSHOTS, ARCHIVE_AFTER_MS, WEB_DIR, DEFAULT_SCREENSHOT_HOTKEY, CLOUDINARY_SCREENSHOT_FOLDER, CLOUDINARY_CONFIGURED, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_CONFIGURED, ADMIN_SESSION_SECRET, ADMIN_SESSION_TTL_HOURS, ADMIN_SESSION_CONFIGURED, cloudinary };
