import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Archive,
  Check,
  Copy,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Layers,
  CheckSquare,
  Square,
  Menu,
} from 'lucide-react';
import { api } from './api';
import {
  ScreenshotItem,
  Snippet,
  ClipboardEntry,
  Stats,
  AppConfig,
  Session,
  DesktopStatus,
  ToastMessage,
} from './types';
import Sidebar from './components/Sidebar';
import ScreenshotGrid from './components/ScreenshotGrid';
import ImageViewer, { ViewerState } from './components/ImageViewer';
import ConfirmDialog, { ConfirmationOptions } from './components/ConfirmDialog';
import SnippetsPanel from './components/SnippetsPanel';
import ClipboardPanel from './components/ClipboardPanel';
import SettingsPanel from './components/SettingsPanel';
import LoginScreen from './components/LoginScreen';
import ToastContainer from './components/Toast';
import { copyScreenshots } from './lib/images';

const SIDEBAR_PREFERENCE_KEY = 'examhelper.sidebar.collapsed';
const SCREENSHOT_LAST_VIEWED_KEY = 'examhelper.screenshots.lastViewedAt';
const CLIPBOARD_LAST_VIEWED_KEY = 'examhelper.clipboard.lastViewedAt';

function dedent(value: string): string {
  const eol = value.includes('\r\n') ? '\r\n' : '\n';
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\t ]+/, ''))
    .join(eol);
}

export default function App() {
  const [view, setView] = useState<string>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // 1. COLLAPSIBLE SIDEBAR: Default to collapsed (icon-only) on first visit, persist in localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem(SIDEBAR_PREFERENCE_KEY);
    // Default to true (collapsed) if no preference saved yet
    return saved !== null ? saved === 'true' : true;
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(next));
      return next;
    });
  };

  const [session, setSession] = useState<Session>({ authenticated: false });
  const [activeItems, setActiveItems] = useState<ScreenshotItem[]>([]);
  const [archiveData, setArchiveData] = useState<{
    items: ScreenshotItem[];
    total: number;
    page: number;
    limit: number;
  }>({ items: [], total: 0, page: 1, limit: 100 });
  const [stats, setStats] = useState<Stats | null>(null);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [clipboardHistory, setClipboardHistory] = useState<ClipboardEntry[]>([]);
  const [desktop, setDesktop] = useState<DesktopStatus>({ connected: true });
  const [config, setConfig] = useState<AppConfig | null>(null);

  const [archivePage, setArchivePage] = useState(1);
  const [activeSelection, setActiveSelection] = useState<Set<string>>(new Set());
  const [archiveSelection, setArchiveSelection] = useState<Set<string>>(new Set());
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationOptions | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [hotkey, setHotkey] = useState('');
  const [clipboardPush, setClipboardPush] = useState('');

  // 2. SCREENSHOT NOTIFICATION BADGES
  const [screenshotsUnread, setScreenshotsUnread] = useState(0);

  // 3. CLIPBOARD NOTIFICATION BADGES
  const [clipboardUnread, setClipboardUnread] = useState(0);

  // 4. COPY ICON → CHECKMARK ON SUCCESS (inline icon swap, NO toast, aria announcement)
  const [copiedKey, setCopiedKey] = useState<string>('');
  const [copyAnnouncement, setCopyAnnouncement] = useState<string>('');
  const copyTimer = useRef<number | null>(null);
  const viewRef = useRef(view);

  // General Toast notifier helper (for delete, archive, errors, hotkey saves only - NOT copy!)
  const notify = useCallback(
    (title: string, variant: 'default' | 'success' | 'danger' | 'warning' | 'info' = 'default', description?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, title, variant, description }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Screenshot unread tracking
  const markScreenshotsViewed = useCallback((items: ScreenshotItem[]) => {
    const latest = items[0]?.received_at || new Date().toISOString();
    localStorage.setItem(SCREENSHOT_LAST_VIEWED_KEY, latest);
    setScreenshotsUnread(0);
  }, []);

  const syncScreenshotsUnread = useCallback((items: ScreenshotItem[]) => {
    const lastViewed = localStorage.getItem(SCREENSHOT_LAST_VIEWED_KEY);
    if (!lastViewed) {
      if (items.length > 0) {
        localStorage.setItem(SCREENSHOT_LAST_VIEWED_KEY, items[0].received_at);
      }
      setScreenshotsUnread(0);
      return;
    }
    const lastViewedMs = Date.parse(lastViewed);
    const unread = items.filter(
      (e) => Number.isFinite(lastViewedMs) && Date.parse(e.received_at) > lastViewedMs
    ).length;
    setScreenshotsUnread(unread);
  }, []);

  // Clipboard unread tracking
  const markClipboardViewed = useCallback((entries: ClipboardEntry[]) => {
    const latest = entries[0]?.updatedAt || new Date().toISOString();
    localStorage.setItem(CLIPBOARD_LAST_VIEWED_KEY, latest);
    setClipboardUnread(0);
  }, []);

  const syncClipboardUnread = useCallback((entries: ClipboardEntry[]) => {
    const lastViewed = localStorage.getItem(CLIPBOARD_LAST_VIEWED_KEY);
    if (!lastViewed) {
      if (entries.length > 0) {
        localStorage.setItem(CLIPBOARD_LAST_VIEWED_KEY, entries[0].updatedAt);
      }
      setClipboardUnread(0);
      return;
    }
    const lastViewedMs = Date.parse(lastViewed);
    const unread = entries.filter((e) => Number.isFinite(lastViewedMs) && Date.parse(e.updatedAt) > lastViewedMs).length;
    setClipboardUnread(unread);
  }, []);

  // Main data refresh
  const refresh = useCallback(
    async ({ silent = false, requestedPage = archivePage } = {}) => {
      if (!silent) setLoading(true);
      try {
        const nextSession = await api.getSession();
        const [activeRes, statsRes, snippetsRes, clipboardRes, desktopRes, archiveRes, configRes] =
          await Promise.all([
            api.getActive(),
            api.getStats(),
            api.getSnippets(),
            api.getClipboard(),
            api.getDesktopStatus(),
            nextSession.authenticated
              ? api.getArchive(requestedPage)
              : Promise.resolve({ items: [], total: 0, page: requestedPage, limit: 100 }),
            nextSession.authenticated ? api.getConfig() : Promise.resolve(null),
          ]);

        setSession(nextSession);
        setActiveItems(activeRes.items);
        setStats(statsRes);
        setSnippets(snippetsRes.items);
        setClipboardHistory(clipboardRes.history);
        setDesktop(desktopRes);
        setArchiveData(archiveRes);
        if (configRes) {
          setConfig(configRes);
          setHotkey(configRes.screenshot_hotkey || '');
        }

        // Unread badge updates
        if (viewRef.current === 'dashboard') {
          markScreenshotsViewed(activeRes.items);
        } else {
          syncScreenshotsUnread(activeRes.items);
        }

        if (viewRef.current === 'clipboard') {
          markClipboardViewed(clipboardRes.history);
        } else {
          syncClipboardUnread(clipboardRes.history);
        }

        // Clean stale selection ids
        setActiveSelection((current) => new Set([...current].filter((id) => activeRes.items.some((i) => i.id === id))));
        setArchiveSelection((current) => new Set([...current].filter((id) => archiveRes.items.some((i) => i.id === id))));
      } catch (err: any) {
        if (!silent) notify('Sync error', 'danger', err.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [archivePage, markClipboardViewed, markScreenshotsViewed, notify, syncClipboardUnread, syncScreenshotsUnread]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Periodic background polling every 15s
  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh({ silent: true });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  // Socket.io integration if running with server
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).io) return;
    const socket = (window as any).io();

    socket.on('clipboard_updated', (clip: any) => {
      const history = clip.history || [];
      setClipboardHistory(history);
      if (viewRef.current === 'clipboard') {
        markClipboardViewed(history);
      } else {
        syncClipboardUnread(history);
      }
    });

    socket.on('desktop_status_changed', (stat: DesktopStatus) => setDesktop(stat));

    socket.on('screenshot_captured', (item: ScreenshotItem) => {
      setActiveItems((prev) => {
        const next = [item, ...prev];
        if (viewRef.current === 'dashboard') {
          markScreenshotsViewed(next);
        } else {
          setScreenshotsUnread((c) => c + 1);
        }
        return next;
      });
    });

    return () => socket.disconnect();
  }, [markClipboardViewed, markScreenshotsViewed, syncClipboardUnread]);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    };
  }, []);

  // Multi-select helpers
  const toggleActiveSelect = (id: string) => {
    setActiveSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleArchiveSelect = (id: string) => {
    setArchiveSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeIds = useMemo(() => activeItems.map((i) => i.id), [activeItems]);
  const archiveIds = useMemo(() => archiveData.items.map((i) => i.id), [archiveData.items]);
  const archivePageCount = Math.max(1, Math.ceil(archiveData.total / (archiveData.limit || 100)));

  // 4. COPY ICON → CHECKMARK ON SUCCESS (NO TOASTS, INLINE SWAP ONLY)
  const handleCopy = async (
    ids: string[],
    items: ScreenshotItem[],
    key: string,
    announcement = 'Copied to the clipboard.'
  ) => {
    try {
      setBusy(true);
      await copyScreenshots(ids, items);

      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      setCopiedKey(key);
      setCopyAnnouncement(announcement);
      copyTimer.current = window.setTimeout(() => setCopiedKey(''), 1800);
      // NOTE: NO toast call here as per Requirement #4
    } catch (err: any) {
      notify('Copy failed', 'danger', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async (ids: string[], all = false) => {
    if (!ids.length) return;
    if (all) {
      setConfirmation({
        title: 'Archive all active screenshots?',
        message: 'All screenshots on the dashboard will move into the archive.',
        confirmLabel: 'Archive All',
        danger: false,
        onConfirm: async () => {
          await executeArchive(ids);
        },
      });
      return;
    }
    await executeArchive(ids);
  };

  const executeArchive = async (ids: string[]) => {
    try {
      setBusy(true);
      if (ids.length === 1) await api.archiveScreenshot(ids[0]);
      else await api.archiveScreenshots(ids);

      setActiveSelection(new Set());
      await refresh({ silent: true });
      notify(`${ids.length} screenshot${ids.length === 1 ? '' : 's'} archived`, 'success');
    } catch (err: any) {
      notify('Archive failed', 'danger', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      setBusy(true);
      if (ids.length === 1) await api.restoreScreenshot(ids[0]);
      else await api.restoreScreenshots(ids);

      setArchiveSelection(new Set());
      await refresh({ silent: true });
      notify(`${ids.length} screenshot${ids.length === 1 ? '' : 's'} restored to dashboard`, 'success');
    } catch (err: any) {
      notify('Restore failed', 'danger', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePermanentlyDelete = (ids: string[]) => {
    if (!ids.length) return;
    setConfirmation({
      title: 'Delete permanently?',
      message: `${ids.length} archived screenshot${
        ids.length === 1 ? '' : 's'
      } will be permanently erased. This cannot be undone.`,
      confirmLabel: 'Delete Forever',
      danger: true,
      onConfirm: async () => {
        try {
          setBusy(true);
          if (ids.length === 1) await api.permanentlyDeleteScreenshot(ids[0]);
          else await api.permanentlyDeleteScreenshots(ids);

          setArchiveSelection(new Set());
          await refresh({ silent: true });
          notify('Archived screenshot(s) deleted permanently', 'success');
        } catch (err: any) {
          notify('Delete failed', 'danger', err.message);
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const handleSaveSnippet = async (
    mode: 'dedent' | 'exact',
    draft: { id: string; shortcut: string; text: string }
  ) => {
    try {
      setBusy(true);
      const payload = {
        shortcut: draft.shortcut.trim(),
        text: mode === 'dedent' ? dedent(draft.text) : draft.text,
      };

      if (draft.id) await api.updateSnippet(draft.id, payload);
      else await api.createSnippet(payload);

      await refresh({ silent: true });
      notify(draft.id ? 'Snippet updated' : 'Snippet created', 'success');
    } catch (err: any) {
      notify('Failed to save snippet', 'danger', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSnippet = (snippet: Snippet) => {
    setConfirmation({
      title: 'Delete snippet shortcut?',
      message: `Delete “${snippet.shortcut}”? The connected desktop client will stop expanding this trigger.`,
      confirmLabel: 'Delete Snippet',
      danger: true,
      onConfirm: async () => {
        try {
          setBusy(true);
          await api.deleteSnippet(snippet.id);
          await refresh({ silent: true });
          notify('Snippet deleted', 'success');
        } catch (err: any) {
          notify('Failed to delete snippet', 'danger', err.message);
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const handlePushClipboard = async () => {
    try {
      setBusy(true);
      const res = await api.pushClipboard(clipboardPush);
      setClipboardHistory(res.history);
      setClipboardPush('');
      if (res.delivered) {
        notify('Delivered to desktop clipboard', 'success');
      } else {
        notify('Saved to local history', 'warning', 'Desktop daemon is offline.');
      }
    } catch (err: any) {
      notify('Failed to push clipboard', 'danger', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteClipboard = async (id: string) => {
    try {
      setBusy(true);
      const res = await api.deleteClipboardEntry(id);
      setClipboardHistory(res.history);
    } catch (err: any) {
      notify('Failed to delete entry', 'danger', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleClearClipboard = () => {
    setConfirmation({
      title: 'Clear clipboard history?',
      message: 'All clipboard entries will be cleared from this workspace.',
      confirmLabel: 'Clear All',
      danger: true,
      onConfirm: async () => {
        try {
          setBusy(true);
          const res = await api.clearClipboard();
          setClipboardHistory(res.history);
          notify('Clipboard history cleared', 'success');
        } catch (err: any) {
          notify('Failed to clear clipboard', 'danger', err.message);
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const handleLogin = async (password: string) => {
    try {
      setBusy(true);
      await api.login('admin', password);
      await refresh({ silent: true });
      notify('Signed in as admin', 'success');
    } catch (err: any) {
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setSession({ authenticated: false });
      setView('dashboard');
      await refresh({ silent: true });
      notify('Signed out', 'default');
    } catch (err: any) {
      notify('Sign out error', 'danger', err.message);
    }
  };

  const handleSaveHotkey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      const res = await api.updateConfig({ screenshot_hotkey: hotkey });
      setConfig(res.config);
      notify('Screenshot hotkey updated', 'success', `Trigger set to ${hotkey}`);
    } catch (err: any) {
      notify('Failed to update hotkey', 'danger', err.message);
    } finally {
      setBusy(false);
    }
  };


  const navigate = (nextView: string) => {
    setView(nextView);
    if (nextView === 'dashboard') {
      markScreenshotsViewed(activeItems);
    }
    if (nextView === 'clipboard') {
      markClipboardViewed(clipboardHistory);
    }
  };

  const isPrivateView = view === 'archive' || view === 'settings';

  return (
    <div className="min-h-screen flex bg-[#0D1117] text-[#C9D1D9] font-sans antialiased selection:bg-[#1F6FEB]/30 selection:text-white">
      {/* Screen reader live announcement for copy events */}
      <span className="sr-only" aria-live="polite">
        {copyAnnouncement}
      </span>

      {/* 1. COLLAPSIBLE SIDEBAR: Collapsible left sidebar with icon-only rail or full expanded */}
      <Sidebar
        currentView={view}
        onNavigate={navigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        session={session}
        desktop={desktop}
        config={config}
        screenshotsUnread={screenshotsUnread}
        clipboardUnread={clipboardUnread}
        archiveCount={archiveData.total}
        activeCount={activeItems.length}
        snippetCount={snippets.length}
        onLogout={handleLogout}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        {/* Top Header of Main Work Area */}
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-[#30363D] bg-[#010409]/90 px-4 sm:px-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Drawer Trigger */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-md border border-[#30363D] bg-[#161B22] text-[#8B949E] hover:text-white hover:bg-[#21262D] transition-colors"
              aria-label="Open sidebar menu"
            >
              <Menu className="size-4" />
            </button>

            {/* Breadcrumb Hierarchy */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-[#8B949E]">ExamHelper</span>
              <span className="text-[#30363D]">/</span>
              <span className="text-white font-semibold capitalize">
                {view === 'dashboard'
                  ? 'Screenshots Desk'
                  : view === 'archive'
                  ? 'Archive Vault'
                  : view === 'snippets'
                  ? 'Snippets Library'
                  : view === 'clipboard'
                  ? 'Desktop Clipboard'
                  : 'Settings'}
              </span>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#161B22] border border-[#30363D] text-xs font-mono text-[#8B949E]">
              <span>{activeItems.length} active</span>
              <span className="text-[#30363D]">·</span>
              <span>{archiveData.total} archived</span>
            </div>

          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6">
          {loading ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-[#8B949E]">
                <div className="size-8 rounded-full border-2 border-[#58A6FF] border-t-transparent animate-spin" />
                <p className="text-xs font-mono">Loading ExamHelper…</p>
              </div>
            </div>
          ) : isPrivateView && !session.authenticated ? (
            <LoginScreen
              area={view === 'archive' ? 'Archive' : 'Settings'}
              onLogin={handleLogin}
              busy={busy}
            />
          ) : (
            <>
              {/* VIEW 1: ACTIVE DASHBOARD */}
              {view === 'dashboard' && (
                <div className="space-y-6">
                  {/* Action Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#30363D]">
                    <div>
                      <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                        <span>Active Screenshots</span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#161B22] border border-[#30363D] text-[#8B949E] font-normal">
                          {activeItems.length}
                        </span>
                      </h1>
                      <p className="text-xs text-[#8B949E] mt-1">
                        Screenshots captured by the daemon. Select to copy or archive in batch.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Multi-selection bar */}
                      {activeSelection.size > 0 && (
                        <div className="flex items-center gap-2 pr-2 border-r border-[#30363D]">
                          <span className="text-xs text-[#58A6FF] font-mono font-semibold">
                            {activeSelection.size} selected
                          </span>

                          {/* Copy Selected with inline checkmark swap */}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              handleCopy(
                                [...activeSelection],
                                activeItems,
                                'copy-selected',
                                `${activeSelection.size} screenshots copied to clipboard.`
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#238636] hover:bg-[#2ea043] text-white transition-all cursor-pointer active:scale-95"
                          >
                            {copiedKey === 'copy-selected' ? (
                              <Check className="size-3.5 stroke-[2.5]" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                            <span>{copiedKey === 'copy-selected' ? 'Copied' : 'Copy Selected'}</span>
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleArchive([...activeSelection])}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#21262D] hover:bg-[#30363D] text-[#C9D1D9] border border-[#30363D] transition-colors cursor-pointer"
                          >
                            <Archive className="size-3.5" />
                            <span>Archive</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveSelection(new Set())}
                            className="px-2 py-1 text-xs text-[#8B949E] hover:text-white transition-colors cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      )}

                      {/* Copy Newest with inline checkmark swap */}
                      <button
                        type="button"
                        disabled={!activeItems.length || busy}
                        onClick={() =>
                          handleCopy(
                            [activeItems[0]?.id],
                            activeItems,
                            'copy-newest',
                            'Newest screenshot copied to clipboard.'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#21262D] border border-[#30363D] hover:border-[#8B949E] text-[#C9D1D9] hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                      >
                        {copiedKey === 'copy-newest' ? (
                          <Check className="size-3.5 stroke-[2.5] text-[#3FB950]" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                        <span>{copiedKey === 'copy-newest' ? 'Copied' : 'Copy Newest'}</span>
                      </button>

                      {/* Copy All with inline checkmark swap */}
                      <button
                        type="button"
                        disabled={!activeItems.length || busy}
                        onClick={() =>
                          handleCopy(
                            activeIds,
                            activeItems,
                            'copy-all',
                            'All active screenshots copied to clipboard.'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#21262D] border border-[#30363D] hover:border-[#8B949E] text-[#C9D1D9] hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                      >
                        {copiedKey === 'copy-all' ? (
                          <Check className="size-3.5 stroke-[2.5] text-[#3FB950]" />
                        ) : (
                          <Layers className="size-3.5" />
                        )}
                        <span>{copiedKey === 'copy-all' ? 'Copied' : 'Copy All'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={!activeItems.length || busy}
                        onClick={() => handleArchive(activeIds, true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#21262D] border border-[#30363D] hover:border-[#DA3633]/60 text-[#C9D1D9] hover:text-[#FF7B72] transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <Archive className="size-3.5" />
                        <span>Archive All</span>
                      </button>

                      <button
                        type="button"
                        disabled={!activeItems.length}
                        onClick={() =>
                          setActiveSelection(
                            activeSelection.size === activeItems.length ? new Set() : new Set(activeIds)
                          )
                        }
                        className="p-1.5 rounded-md border border-[#30363D] bg-[#21262D] text-[#8B949E] hover:text-white transition-colors cursor-pointer"
                        title={activeSelection.size === activeItems.length ? 'Deselect all' : 'Select all'}
                      >
                        {activeSelection.size === activeItems.length ? (
                          <CheckSquare className="size-3.5 text-[#58A6FF]" />
                        ) : (
                          <Square className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Screenshot Grid */}
                  <ScreenshotGrid
                    items={activeItems}
                    selectedIds={activeSelection}
                    copiedId={copiedKey.startsWith('copy-card-') ? copiedKey.replace('copy-card-', '') : ''}
                    onToggle={toggleActiveSelect}
                    onOpen={(id) => {
                      const idx = activeItems.findIndex((it) => it.id === id);
                      setViewer({
                        items: activeItems,
                        index: idx >= 0 ? idx : 0,
                        setIndex: (i) => setViewer((c) => (c ? { ...c, index: i } : null)),
                      });
                    }}
                    onCopy={(item) =>
                      handleCopy([item.id], activeItems, `copy-card-${item.id}`, 'Screenshot copied to the clipboard.')
                    }
                    onArchive={(id) => handleArchive([id])}
                  />
                </div>
              )}

              {/* VIEW 2: ARCHIVE VAULT */}
              {view === 'archive' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#30363D]">
                    <div>
                      <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                        <span>Archived Screenshots</span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#161B22] border border-[#30363D] text-[#8B949E] font-normal">
                          {archiveData.total}
                        </span>
                      </h1>
                      <p className="text-xs text-[#8B949E] mt-1">
                        Archived screenshots stored securely. Restore to dashboard or permanently purge.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {archiveSelection.size > 0 && (
                        <div className="flex items-center gap-2 pr-2 border-r border-[#30363D]">
                          <span className="text-xs text-[#58A6FF] font-mono font-semibold">
                            {archiveSelection.size} selected
                          </span>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRestore([...archiveSelection])}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#238636] hover:bg-[#2ea043] text-white transition-all cursor-pointer active:scale-95"
                          >
                            <RotateCcw className="size-3.5" />
                            <span>Restore Selected</span>
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handlePermanentlyDelete([...archiveSelection])}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#DA3633] hover:bg-[#b62324] text-white transition-colors cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Delete Permanently</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setArchiveSelection(new Set())}
                            className="px-2 py-1 text-xs text-[#8B949E] hover:text-white transition-colors cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={!archiveIds.length}
                        onClick={() =>
                          setArchiveSelection(
                            archiveSelection.size === archiveIds.length ? new Set() : new Set(archiveIds)
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#21262D] border border-[#30363D] hover:border-[#8B949E] text-[#C9D1D9] hover:text-white transition-colors cursor-pointer"
                      >
                        <span>
                          {archiveSelection.size === archiveIds.length ? 'Clear Page' : 'Select All on Page'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <ScreenshotGrid
                    archived
                    items={archiveData.items}
                    selectedIds={archiveSelection}
                    copiedId={copiedKey.startsWith('copy-card-') ? copiedKey.replace('copy-card-', '') : ''}
                    onToggle={toggleArchiveSelect}
                    onOpen={(id) => {
                      const idx = archiveData.items.findIndex((it) => it.id === id);
                      setViewer({
                        items: archiveData.items,
                        index: idx >= 0 ? idx : 0,
                        setIndex: (i) => setViewer((c) => (c ? { ...c, index: i } : null)),
                      });
                    }}
                    onCopy={(item) =>
                      handleCopy([item.id], archiveData.items, `copy-card-${item.id}`, 'Screenshot copied to the clipboard.')
                    }
                    onRestore={(id) => handleRestore([id])}
                    onDelete={(id) => handlePermanentlyDelete([id])}
                  />

                  {/* Pagination */}
                  {archivePageCount > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-[#30363D] text-xs text-[#8B949E] font-mono">
                      <span>
                        Page {archivePage} of {archivePageCount}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={archivePage <= 1}
                          onClick={() => {
                            const prev = archivePage - 1;
                            setArchivePage(prev);
                            void refresh({ requestedPage: prev });
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-[#30363D] bg-[#21262D] text-[#C9D1D9] hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="size-3.5" />
                          <span>Previous</span>
                        </button>

                        <button
                          type="button"
                          disabled={archivePage >= archivePageCount}
                          onClick={() => {
                            const next = archivePage + 1;
                            setArchivePage(next);
                            void refresh({ requestedPage: next });
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-[#30363D] bg-[#21262D] text-[#C9D1D9] hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          <span>Next</span>
                          <ChevronRight className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 3: SNIPPETS */}
              {view === 'snippets' && (
                <SnippetsPanel
                  snippets={snippets}
                  busy={busy}
                  onSave={handleSaveSnippet}
                  onDelete={handleDeleteSnippet}
                />
              )}

              {/* VIEW 4: CLIPBOARD */}
              {view === 'clipboard' && (
                <ClipboardPanel
                  history={clipboardHistory}
                  value={clipboardPush}
                  setValue={setClipboardPush}
                  busy={busy}
                  onPush={handlePushClipboard}
                  onDelete={handleDeleteClipboard}
                  onClear={handleClearClipboard}
                />
              )}

              {/* VIEW 5: SETTINGS */}
              {view === 'settings' && (
                <SettingsPanel
                  hotkey={hotkey}
                  setHotkey={setHotkey}
                  config={config}
                  desktop={desktop}
                  busy={busy}
                  onSubmit={handleSaveHotkey}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Confirmation Modal */}
      <ConfirmDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />

      {/* Fullscreen Screenshot & Drag-to-Crop Inspector */}
      <ImageViewer
        viewer={viewer}
        onClose={() => setViewer(null)}
        copied={copiedKey === `copy-viewer-${viewer?.items[viewer.index]?.id}`}
        cropCopied={copiedKey === `copy-crop-${viewer?.items[viewer.index]?.id}`}
        onCopy={(item) =>
          handleCopy([item.id], viewer?.items || [], `copy-viewer-${item.id}`, 'Screenshot copied to the clipboard.')
        }
        onCropCopied={(item) => {
          if (copyTimer.current) window.clearTimeout(copyTimer.current);
          setCopiedKey(`copy-crop-${item.id}`);
          setCopyAnnouncement('Cropped image copied to the clipboard.');
          copyTimer.current = window.setTimeout(() => setCopiedKey(''), 1800);
          // NO toast for crop copy as per Requirement #4
        }}
        onCopyError={(msg) => notify('Crop error', 'danger', msg)}
      />

      {/* Toast Notification Container (for non-copy notifications) */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
