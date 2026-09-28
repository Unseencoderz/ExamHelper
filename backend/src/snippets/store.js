const { SNIPPETS_FILE } = require("../config");
const { readJsonFile, writeJsonFile } = require("../jsonStore");

function sanitizeSnippetPayload(payload, existing = {}) {
  const shortcut = String(payload.shortcut ?? existing.shortcut ?? "").trim();
  const text = String(payload.text ?? existing.text ?? "");
  if (!shortcut || shortcut.length > 40) {
    const error = new Error("Shortcut is required and must be 40 characters or fewer.");
    error.statusCode = 400;
    throw error;
  }
  if (/\s/.test(shortcut)) {
    const error = new Error("Shortcut cannot contain whitespace.");
    error.statusCode = 400;
    throw error;
  }
  if (text.length > 8000) {
    const error = new Error("Snippet text must be 8000 characters or fewer.");
    error.statusCode = 400;
    throw error;
  }
  return { shortcut, text };
}
function readSnippets() {
  const snippets = readJsonFile(SNIPPETS_FILE, []);
  return Array.isArray(snippets) ? snippets : [];
}
function writeSnippets(snippets) { writeJsonFile(SNIPPETS_FILE, snippets); }

module.exports = { readSnippets, writeSnippets, sanitizeSnippetPayload };
