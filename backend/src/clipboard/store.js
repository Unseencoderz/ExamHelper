const crypto = require("crypto");
const { requireSupabase, throwIfDatabaseError } = require("../supabase");

const MAX_CLIPBOARD_HISTORY = 50;

function toEntry(row) {
  return { id: row.id, content: row.content, updatedAt: row.created_at };
}

async function readClipboardHistory() {
  const { data, error } = await requireSupabase().from("clipboard_history").select("*").order("created_at", { ascending: false }).limit(MAX_CLIPBOARD_HISTORY);
  throwIfDatabaseError(error, "read clipboard history");
  return (data || []).map(toEntry);
}

async function readClipboard() {
  return { history: await readClipboardHistory() };
}

async function appendClipboard(content) {
  const history = await readClipboardHistory();
  if (history[0]?.content === content) return { history, added: false };
  const { error } = await requireSupabase().from("clipboard_history").insert({ id: crypto.randomUUID(), content: String(content) });
  throwIfDatabaseError(error, "append clipboard history");
  const { data: overflow, error: overflowError } = await requireSupabase().from("clipboard_history").select("id").order("created_at", { ascending: false }).range(MAX_CLIPBOARD_HISTORY, 10000);
  throwIfDatabaseError(overflowError, "trim clipboard history");
  for (const entry of overflow || []) {
    const { error: deleteError } = await requireSupabase().from("clipboard_history").delete().eq("id", entry.id);
    throwIfDatabaseError(deleteError, "trim clipboard history");
  }
  return { history: await readClipboardHistory(), added: true };
}

async function deleteClipboardEntry(id) {
  const { data, error } = await requireSupabase().from("clipboard_history").delete().eq("id", String(id)).select("id");
  throwIfDatabaseError(error, "delete clipboard history entry");
  return { history: await readClipboardHistory(), removed: (data || []).length > 0 };
}

async function clearClipboardHistory() {
  const { error } = await requireSupabase().from("clipboard_history").delete().gte("created_at", "1970-01-01T00:00:00.000Z");
  throwIfDatabaseError(error, "clear clipboard history");
  return { history: [] };
}

module.exports = { MAX_CLIPBOARD_HISTORY, readClipboard, appendClipboard, deleteClipboardEntry, clearClipboardHistory };
