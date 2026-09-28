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
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, "..", "uploads");
const META_DIR = path.join(STORAGE_DIR, ".meta");
const APP_STATE_DIR = path.join(STORAGE_DIR, ".app-state");
const SNIPPETS_FILE = path.join(APP_STATE_DIR, "snippets.json");
const CONFIG_FILE = path.join(APP_STATE_DIR, "config.json");
const CLIPBOARD_FILE = path.join(APP_STATE_DIR, "clipboard.json");
const LOG_FILE = path.join(__dirname, "..", "server.log");
const MAX_FILE_SIZE = Number.parseInt(process.env.MAX_FILE_SIZE_MB || "80", 10) * 1024 * 1024;
const MAX_SCREENSHOTS = Number.parseInt(process.env.MAX_SCREENSHOTS || "50", 10);
const ARCHIVE_AFTER_MS = 30 * 60 * 1000;
const WEB_DIR = process.env.WEB_DIR || path.resolve(__dirname, "..", "..", "web-frontend");
const DEFAULT_SCREENSHOT_HOTKEY = process.env.DEFAULT_SCREENSHOT_HOTKEY || "Win+Alt+C";
const CLOUDINARY_ARCHIVE_FOLDER = (process.env.CLOUDINARY_ARCHIVE_FOLDER || "examhelper/archive").replace(/^\/+|\/+$/g, "") || "examhelper/archive";
const CLOUDINARY_CONFIGURED = Boolean(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET));

if (CLOUDINARY_CONFIGURED) {
  cloudinary.config(process.env.CLOUDINARY_URL ? { secure: true } : {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

[STORAGE_DIR, META_DIR, APP_STATE_DIR].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

module.exports = { loadLocalEnv, PORT, STORAGE_DIR, META_DIR, APP_STATE_DIR, SNIPPETS_FILE, CONFIG_FILE, CLIPBOARD_FILE, LOG_FILE, MAX_FILE_SIZE, MAX_SCREENSHOTS, ARCHIVE_AFTER_MS, WEB_DIR, DEFAULT_SCREENSHOT_HOTKEY, CLOUDINARY_ARCHIVE_FOLDER, CLOUDINARY_CONFIGURED, cloudinary };
