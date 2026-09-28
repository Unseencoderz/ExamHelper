const { CONFIG_FILE, DEFAULT_SCREENSHOT_HOTKEY } = require("../config");
const { readJsonFile, writeJsonFile } = require("../jsonStore");

function normalizeHotkey(value) { return String(value || "").split("+").map((part) => part.trim()).filter(Boolean).join("+"); }
function validateHotkey(value) {
  const hotkey = normalizeHotkey(value);
  const tokens = hotkey.toLowerCase().split("+").filter(Boolean);
  const modifiers = new Set(["ctrl", "control", "shift", "alt", "win", "windows", "cmd"]);
  if (tokens.length < 2 || tokens.filter((token) => !modifiers.has(token)).length !== 1) return null;
  return hotkey;
}
function readAppConfig() {
  const config = readJsonFile(CONFIG_FILE, {});
  return { screenshot_hotkey: validateHotkey(config.screenshot_hotkey) || DEFAULT_SCREENSHOT_HOTKEY };
}
function writeAppConfig(config) { writeJsonFile(CONFIG_FILE, config); }

module.exports = { normalizeHotkey, validateHotkey, readAppConfig, writeAppConfig };
