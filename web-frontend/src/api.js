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
  async loadDashboard() {
    const [screenshots, stats, snippets, config] = await Promise.all([
      request("/screenshots?limit=100"),
      request("/stats"),
      request("/snippets"),
      request("/config"),
    ]);

    return { screenshots, stats, snippets, config };
  },

  async deleteScreenshot(id) {
    return request(`/screenshots/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async bulkDelete(ids) {
    return request("/screenshots/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
  },

  async updateTags(id, tags) {
    return request(`/screenshots/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ tags }),
    });
  },

  async extractText(ids) {
    return request("/extract-text", {
      method: "POST",
      body: JSON.stringify({ ids }),
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
};
