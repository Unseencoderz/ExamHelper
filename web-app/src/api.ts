import {
  ScreenshotItem,
  Snippet,
  ClipboardEntry,
  Stats,
  AppConfig,
  Session,
  DesktopStatus,
} from './types';

// ---------------------------------------------------------------------------
// Core fetch wrapper — same-origin credentials, JSON in/out
// ---------------------------------------------------------------------------
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    const err: any = new Error(payload?.error || `Request failed with status ${response.status}.`);
    err.status = response.status;
    throw err;
  }
  return payload as T;
}

// ---------------------------------------------------------------------------
// Public API surface — mirrors the existing backend routes exactly
// ---------------------------------------------------------------------------
export const api = {
  request,

  getActive(): Promise<{ items: ScreenshotItem[] }> {
    return request<{ items: ScreenshotItem[] }>('/screenshots?limit=100');
  },

  getStats(): Promise<Stats> {
    return request<Stats>('/stats');
  },

  getSnippets(): Promise<{ items: Snippet[] }> {
    return request<{ items: Snippet[] }>('/snippets');
  },

  getClipboard(): Promise<{ history: ClipboardEntry[] }> {
    return request<{ history: ClipboardEntry[] }>('/clipboard');
  },

  getDesktopStatus(): Promise<DesktopStatus> {
    return request<DesktopStatus>('/desktop-status');
  },

  getArchive(page: number = 1): Promise<{ items: ScreenshotItem[]; total: number; page: number; limit: number }> {
    return request(`/archive?page=${page}&limit=100`);
  },

  getConfig(): Promise<AppConfig> {
    return request<AppConfig>('/config');
  },

  getSession(): Promise<Session> {
    return request<Session>('/auth/session');
  },

  login(username: string = 'admin', password: string): Promise<Session> {
    return request<Session>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  async logout(): Promise<{ success: boolean }> {
    await request('/auth/logout', { method: 'POST' });
    return { success: true };
  },

  archiveScreenshot(id: string): Promise<{ success: boolean }> {
    return request(`/screenshots/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  archiveScreenshots(ids: string[]): Promise<{ count: number }> {
    return request('/screenshots/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
  },

  restoreScreenshot(id: string): Promise<{ success: boolean }> {
    return request(`/archive/${encodeURIComponent(id)}/restore`, { method: 'POST' });
  },

  restoreScreenshots(ids: string[]): Promise<{ count: number }> {
    return request('/screenshots/bulk-restore', { method: 'POST', body: JSON.stringify({ ids }) });
  },

  permanentlyDeleteScreenshot(id: string): Promise<{ success: boolean }> {
    return request(`/archive/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  permanentlyDeleteScreenshots(ids: string[]): Promise<{ count: number }> {
    return request('/archive/bulk-delete', { method: 'DELETE', body: JSON.stringify({ ids }) });
  },

  updateTags(id: string, tags: string[]): Promise<{ success: boolean }> {
    return request(`/screenshots/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ tags }) });
  },

  createSnippet(snippet: { shortcut: string; text: string }): Promise<Snippet> {
    return request('/snippets', { method: 'POST', body: JSON.stringify(snippet) });
  },

  updateSnippet(id: string, snippet: { shortcut: string; text: string }): Promise<Snippet> {
    return request(`/snippets/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(snippet) });
  },

  deleteSnippet(id: string): Promise<{ success: boolean }> {
    return request(`/snippets/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  updateConfig(config: Partial<AppConfig>): Promise<{ config: AppConfig }> {
    return request('/config', { method: 'PATCH', body: JSON.stringify(config) });
  },

  pushClipboard(content: string): Promise<{ delivered: boolean; history: ClipboardEntry[] }> {
    return request('/clipboard/push', { method: 'POST', body: JSON.stringify({ content }) });
  },

  deleteClipboardEntry(id: string): Promise<{ history: ClipboardEntry[] }> {
    return request(`/clipboard/history/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  clearClipboard(): Promise<{ history: ClipboardEntry[] }> {
    return request('/clipboard/history', { method: 'DELETE' });
  },
};
