import {
  Camera,
  Archive,
  Code2,
  ClipboardList,
  Settings,
  LogIn,
  LogOut,
  Command,
} from 'lucide-react';
import DesktopIndicator from './DesktopIndicator';
import { DesktopStatus, Session, AppConfig } from '../types';

interface TopNavigationProps {
  currentView: string;
  onNavigate: (view: string) => void;
  session: Session;
  desktop: DesktopStatus;
  config: AppConfig | null;
  clipboardUnread: number;
  archiveCount: number;
  activeCount: number;
  onLogout: () => void;
}

export default function TopNavigation({
  currentView,
  onNavigate,
  session,
  desktop,
  config,
  clipboardUnread,
  archiveCount,
  activeCount,
  onLogout,
}: TopNavigationProps) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Screenshots',
      icon: Camera,
      badge: activeCount > 0 ? activeCount : undefined,
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: Archive,
      badge: session.authenticated && archiveCount > 0 ? archiveCount : undefined,
    },
    {
      id: 'snippets',
      label: 'Snippets',
      icon: Code2,
    },
    {
      id: 'clipboard',
      label: 'Clipboard',
      icon: ClipboardList,
      badge: clipboardUnread > 0 ? (clipboardUnread > 9 ? '9+' : clipboardUnread) : undefined,
      badgeColor: 'sky',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-[#0d1117]/90 px-4 sm:px-6 backdrop-blur-md">
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="group flex items-center gap-2.5 text-left cursor-pointer"
        >
          <div className="relative flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
            <Command className="size-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-white group-hover:text-sky-300 transition-colors">
              ExamHelper
            </span>
            <span className="text-[10px] font-mono text-slate-400">Desktop Studio</span>
          </div>
        </button>
      </div>

      {/* Zone 2: Navigation Tabs */}
      <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1 scrollbar-none">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`relative flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-slate-800/90 text-sky-400 shadow-sm border border-slate-700/60 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Icon className="size-3.5 shrink-0" />
              <span>{item.label}</span>

              {item.badge !== undefined && (
                <span
                  className={`inline-flex items-center justify-center px-1.5 py-0.2 rounded-full font-mono text-[10px] font-semibold tabular-nums ${
                    isActive
                      ? 'bg-sky-500/20 text-sky-300'
                      : item.badgeColor === 'sky'
                      ? 'bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Status & Auth */}
      <div className="flex items-center gap-2 sm:gap-3">
        {config?.screenshot_hotkey && (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800 text-slate-400 font-mono text-[11px]">
            <span className="text-slate-500">Capture</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-300 font-semibold">
              {config.screenshot_hotkey}
            </kbd>
          </div>
        )}

        <DesktopIndicator status={desktop} />

        {session.authenticated ? (
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-lg border border-slate-800 hover:bg-slate-800/80 transition-colors cursor-pointer"
            title="Sign out of admin session"
          >
            <LogOut className="size-3.5 text-rose-400" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate('archive')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 rounded-lg border border-sky-500/20 bg-sky-500/10 hover:bg-sky-500/20 transition-colors cursor-pointer"
            title="Admin Sign In"
          >
            <LogIn className="size-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </button>
        )}
      </div>
    </header>
  );
}
