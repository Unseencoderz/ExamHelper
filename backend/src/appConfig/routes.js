const express = require("express");
const { readAppConfig, writeAppConfig, validateHotkey } = require("./store");

function createAppConfigRouter({ broadcastClientEvent, requireAdminSession }) {
  const router = express.Router();
  router.get("/config", requireAdminSession, async (req, res) => {
    try { res.json(await readAppConfig()); }
    catch (error) { res.status(error.statusCode || 500).json({ error: "Unable to load configuration." }); }
  });
  router.patch("/config", requireAdminSession, async (req, res) => {
    try {
      const currentConfig = await readAppConfig();
      const nextHotkey = req.body.screenshot_hotkey !== undefined ? validateHotkey(req.body.screenshot_hotkey) : currentConfig.screenshot_hotkey;
      if (!nextHotkey) return res.status(400).json({ error: "Screenshot hotkey must include modifiers and one key." });
      const nextConfig = await writeAppConfig({ ...currentConfig, screenshot_hotkey: nextHotkey });
      broadcastClientEvent("hotkey_changed", { screenshot_hotkey: nextConfig.screenshot_hotkey });
      res.json({ status: "updated", config: nextConfig });
    } catch (error) { res.status(error.statusCode || 500).json({ error: error.message || "Unable to update configuration." }); }
  });
  return router;
}

module.exports = { createAppConfigRouter };
