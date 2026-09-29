const { DEFAULT_SCREENSHOT_HOTKEY } = require("../config");
const { requireSupabase, throwIfDatabaseError } = require("../supabase");

function normalizeHotkey(value) { return String(value || "").split("+").map((part) => part.trim()).filter(Boolean).join("+"); }
function validateHotkey(value) {
  const hotkey = normalizeHotkey(value);
  const tokens = hotkey.toLowerCase().split("+").filter(Boolean);
  const modifiers = new Set(["ctrl", "control", "shift", "alt", "win", "windows", "cmd"]);
  if (tokens.length < 2 || tokens.filter((token) => !modifiers.has(token)).length !== 1) return null;
  return hotkey;
}
async function readAppConfig() {
  const { data, error } = await requireSupabase().from("app_config").select("*").eq("id", true).maybeSingle();
  throwIfDatabaseError(error, "read app config");
  return { screenshot_hotkey: validateHotkey(data?.screenshot_hotkey) || DEFAULT_SCREENSHOT_HOTKEY };
}
async function writeAppConfig(config) {
  const { data, error } = await requireSupabase().from("app_config").upsert({ id: true, screenshot_hotkey: config.screenshot_hotkey, updated_at: new Date().toISOString() }, { onConflict: "id" }).select().single();
  throwIfDatabaseError(error, "save app config");
  return { screenshot_hotkey: data.screenshot_hotkey };
}

module.exports = { normalizeHotkey, validateHotkey, readAppConfig, writeAppConfig };
