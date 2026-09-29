const multer = require("multer");
const { MAX_FILE_SIZE } = require("../config");

// Multer keeps the multipart payload in memory only; Cloudinary receives this
// buffer directly and no screenshot file is ever written by the backend.
const upload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, callback) => new Set(["image/jpeg", "image/png", "image/webp"]).has(file.mimetype) ? callback(null, true) : callback(new Error(`Unsupported MIME type: ${file.mimetype}`)),
});

module.exports = { upload };
