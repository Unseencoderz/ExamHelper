async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}.`);
  }

  return payload;
}

export const api = {
  async loadDashboard(archivePage = 1) {
    const [screenshots, archive, stats, snippets, config, clipboard] = await Promise.all([
      request("/screenshots?limit=100"),
      request(`/archive?page=${archivePage}&limit=100`),
      request("/stats"),
      request("/snippets"),
      request("/config"),
      request("/clipboard"),
    ]);

    return { screenshots, archive, stats, snippets, config, clipboard };
  },

  async archiveScreenshots(ids) {
    return request("/screenshots/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
  },

  async archiveScreenshot(id) {
    return request(`/screenshots/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async restoreScreenshot(id) {
    return request(`/archive/${encodeURIComponent(id)}/restore`, {
      method: "POST",
    });
  },

  async restoreScreenshots(ids) {
    return request("/screenshots/bulk-restore", {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
  },

  async permanentlyDeleteScreenshot(id) {
    return request(`/archive/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async permanentlyDeleteScreenshots(ids) {
    return request("/archive/bulk-delete", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
  },

  async updateTags(id, tags) {
    return request(`/screenshots/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ tags }),
    });
  },

  async createSnippet(snippet) {
    return request("/snippets", {
      method: "POST",
      body: JSON.stringify(snippet),
    });
  },

  async updateSnippet(id, snippet) {
    return request(`/snippets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(snippet),
    });
  },

  async deleteSnippet(id) {
    return request(`/snippets/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async updateConfig(config) {
    return request("/config", {
      method: "PATCH",
      body: JSON.stringify(config),
    });
  },

  async pushClipboard(content) {
    return request("/clipboard/push", {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  },

  async deleteClipboardHistoryEntry(id) {
    return request(`/clipboard/history/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  async clearClipboardHistory() {
    return request("/clipboard/history", { method: "DELETE" });
  },
};
