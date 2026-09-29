const express = require("express");
const { readClipboard, deleteClipboardEntry, clearClipboardHistory } = require("./store");

function contentFrom(payload) {
  if (typeof payload?.content !== "string") {
    const error = new Error("Clipboard content must be plain text.");
    error.statusCode = 400;
    throw error;
  }
  return payload.content;
}

function createClipboardRouter({ broadcastClientEvent, pushClipboard }) {
  const router = express.Router();

  router.get("/clipboard", async (req, res) => {
    try { res.json(await readClipboard()); }
    catch (error) { res.status(error.statusCode || 500).json({ error: "Unable to load clipboard history." }); }
  });
  router.post("/clipboard/push", (req, res) => {
    try {
      const content = contentFrom(req.body);
      res.json({ status: "pushed", delivered: pushClipboard(content) });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message || "Unable to push clipboard content." });
    }
  });

  router.delete("/clipboard/history", async (req, res) => {
    try {
      const clipboard = await clearClipboardHistory();
      broadcastClientEvent("clipboard_updated", clipboard);
      res.json(clipboard);
    } catch (error) { res.status(error.statusCode || 500).json({ error: "Unable to clear clipboard history." }); }
  });

  router.delete("/clipboard/history/:id", async (req, res) => {
    try {
      const clipboard = await deleteClipboardEntry(req.params.id);
      if (!clipboard.removed) return res.status(404).json({ error: "Clipboard history entry not found." });
      broadcastClientEvent("clipboard_updated", { history: clipboard.history });
      return res.json({ history: clipboard.history });
    } catch (error) { return res.status(error.statusCode || 500).json({ error: "Unable to delete clipboard history entry." }); }
  });

  return router;
}

module.exports = { createClipboardRouter, contentFrom };
