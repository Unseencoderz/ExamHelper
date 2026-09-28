const express = require("express");
const { readAppConfig, writeAppConfig, validateHotkey } = require("./store");

function createAppConfigRouter({ broadcastClientEvent }) {
  const router = express.Router();
  router.get("/config", (req, res) => res.json(readAppConfig()));
  router.patch("/config", (req, res) => {
    const currentConfig = readAppConfig();
    const nextHotkey = req.body.screenshot_hotkey !== undefined ? validateHotkey(req.body.screenshot_hotkey) : currentConfig.screenshot_hotkey;
    if (!nextHotkey) return res.status(400).json({ error: "Screenshot hotkey must include modifiers and one key." });
    const nextConfig = { ...currentConfig, screenshot_hotkey: nextHotkey };
    writeAppConfig(nextConfig); broadcastClientEvent("hotkey_changed", { screenshot_hotkey: nextConfig.screenshot_hotkey });
    res.json({ status: "updated", config: nextConfig });
  });
  return router;
}

module.exports = { createAppConfigRouter };
