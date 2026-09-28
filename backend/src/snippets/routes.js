const express = require("express");
const crypto = require("crypto");
const { log } = require("../logger");
const { readSnippets, writeSnippets, sanitizeSnippetPayload } = require("./store");

function createSnippetRouter({ broadcastClientEvent }) {
  const router = express.Router();
  router.get("/snippets", (req, res) => res.json({ items: readSnippets() }));
  router.post("/snippets", (req, res) => {
    try {
      const snippetData = sanitizeSnippetPayload(req.body);
      const snippets = readSnippets();
      if (snippets.find((snippet) => snippet.shortcut.toLowerCase() === snippetData.shortcut.toLowerCase())) return res.status(409).json({ error: "A snippet with this shortcut already exists." });
      const now = new Date().toISOString();
      const snippet = { id: crypto.randomUUID(), ...snippetData, createdAt: now, updatedAt: now };
      snippets.push(snippet); writeSnippets(snippets); broadcastClientEvent("snippet_created", snippet);
      res.status(201).json({ status: "created", item: snippet });
    } catch (error) { res.status(error.statusCode || 500).json({ error: error.message || "Unable to create snippet." }); }
  });
  router.patch("/snippets/:id", (req, res) => {
    try {
      const snippets = readSnippets(); const index = snippets.findIndex((snippet) => snippet.id === req.params.id);
      if (index === -1) return res.status(404).json({ error: "Snippet not found." });
      const snippetData = sanitizeSnippetPayload(req.body, snippets[index]);
      if (snippets.find((snippet) => snippet.id !== req.params.id && snippet.shortcut.toLowerCase() === snippetData.shortcut.toLowerCase())) return res.status(409).json({ error: "A snippet with this shortcut already exists." });
      const updated = { ...snippets[index], ...snippetData, updatedAt: new Date().toISOString() };
      snippets[index] = updated; writeSnippets(snippets); broadcastClientEvent("snippet_updated", updated);
      res.json({ status: "updated", item: updated });
    } catch (error) { res.status(error.statusCode || 500).json({ error: error.message || "Unable to update snippet." }); }
  });
  router.delete("/snippets/:id", (req, res) => {
    try {
      const snippets = readSnippets(); const index = snippets.findIndex((snippet) => snippet.id === req.params.id);
      if (index === -1) return res.status(404).json({ error: "Snippet not found." });
      const [removed] = snippets.splice(index, 1); writeSnippets(snippets);
      broadcastClientEvent("snippet_deleted", { id: removed.id, shortcut: removed.shortcut });
      res.json({ status: "deleted", item: removed });
    } catch (error) { log("ERROR", `Failed to delete snippet ${req.params.id}`, error.message); res.status(500).json({ error: "Unable to delete snippet." }); }
  });
  return router;
}

module.exports = { createSnippetRouter };
