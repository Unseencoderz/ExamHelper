export interface ScreenshotItem {
  id: string;
  label?: string;
  filename?: string;
  image_url: string;
  received_at: string;
  archived_at?: string;
  tags?: string[];
  dimensions?: { width: number; height: number };
  size_bytes?: number;
}

export interface Snippet {
  id: string;
  shortcut: string;
  text: string;
  updated_at?: string;
}

export interface ClipboardEntry {
  id: string;
  content: string;
  updatedAt: string;
  char_count?: number;
}

export interface Stats {
  total_screenshots: number;
  archived_screenshots: number;
  active_snippets: number;
  clipboard_items: number;
}

export interface AppConfig {
  screenshot_hotkey: string;
  auto_archive_hours?: number;
  play_sound?: boolean;
  theme?: 'dark' | 'light';
}

export interface Session {
  authenticated: boolean;
  username?: string;
}

export interface DesktopStatus {
  connected: boolean;
  clientVersion?: string;
  platform?: string;
  lastPing?: string;
  hostname?: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
}
