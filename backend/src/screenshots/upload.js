const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { STORAGE_DIR, MAX_FILE_SIZE } = require("../config");

const storage = multer.diskStorage({
  destination: (req, file, callback) => { const dayDir = path.join(STORAGE_DIR, new Date().toISOString().slice(0, 10)); fs.mkdirSync(dayDir, { recursive: true }); callback(null, dayDir); },
  filename: (req, file, callback) => { const id = req.body.id || crypto.randomUUID(); callback(null, `${id}${path.extname(file.originalname) || ".jpg"}`); },
});
const upload = multer({
  storage, limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, callback) => new Set(["image/jpeg", "image/png", "image/webp"]).has(file.mimetype) ? callback(null, true) : callback(new Error(`Unsupported MIME type: ${file.mimetype}`)),
});

module.exports = { storage, upload };
