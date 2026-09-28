const fs = require("fs");
const { log } = require("./logger");

function toPosix(value) { return String(value).replace(/\\/g, "/"); }
function safeReadJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch (error) { log("WARN", `Invalid JSON ignored: ${filePath}`, error.message); return null; }
}
function readJsonFile(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) return fallbackValue;
  const value = safeReadJson(filePath);
  return value === null ? fallbackValue : value;
}
function writeJsonFile(filePath, value) { fs.writeFileSync(filePath, JSON.stringify(value, null, 2)); }

module.exports = { safeReadJson, readJsonFile, writeJsonFile, toPosix };
