const { requireSupabase, throwIfDatabaseError } = require("../supabase");

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

function toSnippet(row) {
  return { id: row.id, shortcut: row.shortcut, text: row.text, createdAt: row.created_at, updatedAt: row.updated_at };
}

async function readSnippets() {
  const { data, error } = await requireSupabase().from("snippets").select("*").order("created_at", { ascending: true });
  throwIfDatabaseError(error, "read snippets");
  return (data || []).map(toSnippet);
}

async function writeSnippets(snippets) {
  const supabase = requireSupabase();
  const existing = await readSnippets();
  const ids = new Set(snippets.map((snippet) => snippet.id));
  for (const snippet of existing) {
    if (!ids.has(snippet.id)) {
      const { error } = await supabase.from("snippets").delete().eq("id", snippet.id);
      throwIfDatabaseError(error, "delete snippet");
    }
  }
  if (snippets.length === 0) return [];
  const rows = snippets.map((snippet) => ({
    id: snippet.id,
    shortcut: snippet.shortcut,
    text: snippet.text,
    created_at: snippet.createdAt,
    updated_at: snippet.updatedAt,
  }));
  const { data, error } = await supabase.from("snippets").upsert(rows, { onConflict: "id" }).select();
  throwIfDatabaseError(error, "save snippets");
  return (data || []).map(toSnippet);
}

module.exports = { readSnippets, writeSnippets, sanitizeSnippetPayload };
