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

  router.get("/clipboard", (req, res) => res.json(readClipboard()));
  router.post("/clipboard/push", (req, res) => {
    try {
      const content = contentFrom(req.body);
      res.json({ status: "pushed", delivered: pushClipboard(content) });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message || "Unable to push clipboard content." });
    }
  });

  router.delete("/clipboard/history", (req, res) => {
    const clipboard = clearClipboardHistory();
    broadcastClientEvent("clipboard_updated", clipboard);
    res.json(clipboard);
  });

  router.delete("/clipboard/history/:id", (req, res) => {
    const clipboard = deleteClipboardEntry(req.params.id);
    if (!clipboard.removed) return res.status(404).json({ error: "Clipboard history entry not found." });
    broadcastClientEvent("clipboard_updated", { history: clipboard.history });
    return res.json({ history: clipboard.history });
  });

  return router;
}

module.exports = { createClipboardRouter, contentFrom };
