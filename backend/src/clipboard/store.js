const { CLIPBOARD_FILE } = require("../config");
const { readJsonFile, writeJsonFile } = require("../jsonStore");
const crypto = require("crypto");

const MAX_CLIPBOARD_HISTORY = 50;

function validEntry(entry) {
  return entry && typeof entry.content === "string" && typeof entry.updatedAt === "string";
}

function readClipboardHistory() {
  const saved = readJsonFile(CLIPBOARD_FILE, []);
  // Preserve legacy single-value data and assign IDs to history created before deletion support.
  const rawHistory = Array.isArray(saved) ? saved : validEntry(saved) ? [saved] : [];
  const history = rawHistory
    .filter(validEntry)
    .slice(0, MAX_CLIPBOARD_HISTORY)
    .map((entry) => ({ ...entry, id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID() }));
  const needsMigration = !Array.isArray(saved)
    ? history.length > 0
    : history.length !== saved.length || history.some((entry, index) => entry.id !== saved[index]?.id);
  if (needsMigration) writeJsonFile(CLIPBOARD_FILE, history);
  return history;
}

function readClipboard() {
  return { history: readClipboardHistory() };
}

function appendClipboard(content) {
  const history = readClipboardHistory();
  if (history[0]?.content === content) return { history, added: false };

  const nextHistory = [
    { id: crypto.randomUUID(), content: String(content), updatedAt: new Date().toISOString() },
    ...history,
  ].slice(0, MAX_CLIPBOARD_HISTORY);
  writeJsonFile(CLIPBOARD_FILE, nextHistory);
  return { history: nextHistory, added: true };
}

function deleteClipboardEntry(id) {
  const history = readClipboardHistory();
  const nextHistory = history.filter((entry) => entry.id !== id);
  if (nextHistory.length === history.length) return { history, removed: false };
  writeJsonFile(CLIPBOARD_FILE, nextHistory);
  return { history: nextHistory, removed: true };
}

function clearClipboardHistory() {
  writeJsonFile(CLIPBOARD_FILE, []);
  return { history: [] };
}

module.exports = { MAX_CLIPBOARD_HISTORY, readClipboard, appendClipboard, deleteClipboardEntry, clearClipboardHistory };
