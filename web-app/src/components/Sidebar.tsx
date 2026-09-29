import {
  Camera,
  Archive,
  Code2,
  ClipboardList,
  Settings,
  LogIn,
  LogOut,
  Command,
  PanelLeftClose,
  PanelLeftOpen,
  Keyboard,
} from 'lucide-react';
import DesktopIndicator from './DesktopIndicator';
import { DesktopStatus, Session, AppConfig } from '../types';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  session: Session;
  desktop: DesktopStatus;
  config: AppConfig | null;
  screenshotsUnread: number;
  clipboardUnread: number;
  archiveCount: number;
  activeCount: number;
  snippetCount: number;
  onLogout: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({
  currentView,
  onNavigate,
  collapsed,
  onToggleCollapse,
  session,
  desktop,
  config,
  screenshotsUnread,
  clipboardUnread,
  archiveCount,
  activeCount,
  snippetCount,
  onLogout,
  isOpenMobile,
  onCloseMobile,
}: SidebarProps) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Screenshots',
      icon: Camera,
      unreadBadge: screenshotsUnread,
      countBadge: activeCount,
    },
    {
      id: 'archive',
      label: 'Archive Vault',
      icon: Archive,
      countBadge: session.authenticated && archiveCount > 0 ? archiveCount : undefined,
    },
    {
      id: 'snippets',
      label: 'Snippets',
      icon: Code2,
      countBadge: snippetCount > 0 ? snippetCount : undefined,
    },
    {
      id: 'clipboard',
      label: 'Clipboard',
      icon: ClipboardList,
      unreadBadge: clipboardUnread,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  const handleItemClick = (viewId: string) => {
    onNavigate(viewId);
    onCloseMobile();
  };

  const sidebarContent = (
    <div
      className={`flex h-full flex-col justify-between border-r border-[#30363D] bg-[#010409] text-[#C9D1D9] transition-all duration-200 ease-in-out select-none ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top Branding & Toggle Section */}
      <div>
        <div
          className={`flex h-14 items-center border-b border-[#30363D] px-3 ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {/* Brand */}
          <button
            type="button"
            onClick={() => handleItemClick('dashboard')}
            className={`group flex items-center gap-2.5 text-left cursor-pointer transition-all ${
              collapsed ? 'justify-center' : ''
            }`}
            title="ExamHelper Desktop Studio"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#21262D] border border-[#30363D] text-[#58A6FF] shadow-sm group-hover:border-[#58A6FF] transition-colors">
              <Command className="size-4" />
            </div>

            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold tracking-tight text-white group-hover:text-[#58A6FF] transition-colors truncate">
                  ExamHelper
                </span>
                <span className="text-[10px] font-mono text-[#8B949E]">
                  v3.1.0
                </span>
              </div>
            )}
          </button>

          {/* Toggle Sidebar Collapse */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`p-1.5 rounded-md text-[#8B949E] hover:text-white hover:bg-[#161B22] border border-transparent hover:border-[#30363D] transition-colors cursor-pointer ${
              collapsed ? 'hidden' : 'block'
            }`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>

        {/* Collapsed Toggle Button below brand if collapsed */}
        {collapsed && (
          <div className="flex justify-center py-2 border-b border-[#21262D]">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1.5 rounded-md text-[#8B949E] hover:text-white hover:bg-[#161B22] border border-transparent hover:border-[#30363D] transition-colors cursor-pointer"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          </div>
        )}

        {/* Navigation List */}
        <div className="px-2 py-3">
          {!collapsed && (
            <p className="px-2.5 mb-2 text-[10px] font-mono font-semibold tracking-wider text-[#8B949E] uppercase">
              Workspace
            </p>
          )}

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              const Icon = item.icon;
              const hasUnread = (item.unreadBadge ?? 0) > 0;
              const unreadText = (item.unreadBadge ?? 0) > 9 ? '9+' : item.unreadBadge;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`group relative flex w-full items-center rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    collapsed
                      ? 'justify-center py-2.5 px-0'
                      : 'justify-between px-2.5 py-2'
                  } ${
                    isActive
                      ? 'bg-[#161B22] text-white font-semibold border border-[#30363D]'
                      : 'text-[#8B949E] hover:bg-[#161B22]/70 hover:text-[#C9D1D9] border border-transparent'
                  }`}
                >
                  <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'justify-center' : ''}`}>
                    <div className="relative flex shrink-0 items-center justify-center">
                      <Icon
                        className={`size-4.5 transition-colors ${
                          isActive ? 'text-[#58A6FF]' : 'text-[#8B949E] group-hover:text-[#C9D1D9]'
                        }`}
                      />

                      {/* WhatsApp-style badge on collapsed icon */}
                      {hasUnread && (
                        <span
                          className={`absolute -top-1.5 -right-2 flex min-w-4 h-4 px-1 items-center justify-center rounded-full bg-[#1F6FEB] text-white font-mono text-[9px] font-bold shadow-sm ring-2 ring-[#010409] animate-in zoom-in-75 duration-150`}
                          aria-label={`${unreadText} unread`}
                        >
                          {unreadText}
                        </span>
                      )}
                    </div>

                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </div>

                  {/* Badges in expanded state */}
                  {!collapsed && (
                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      {hasUnread && (
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-[#1F6FEB] text-white font-mono text-[10px] font-bold">
                          {unreadText}
                        </span>
                      )}

                      {!hasUnread && item.countBadge !== undefined && (
                        <span className="font-mono text-[10px] text-[#6E7681]">
                          {item.countBadge}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Left accent bar on active */}
                  {isActive && !collapsed && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-1 rounded-r bg-[#1F6FEB]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Hotkey Readout */}
        {!collapsed && config?.screenshot_hotkey && (
          <div className="px-2 py-2 border-t border-[#21262D]">
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[#0D1117] border border-[#21262D] text-[11px] text-[#8B949E]">
              <span className="flex items-center gap-1">
                <Keyboard className="size-3 text-[#58A6FF]" />
                <span>Hotkey</span>
              </span>
              <kbd className="px-1 py-0.5 rounded bg-[#161B22] border border-[#30363D] text-[#C9D1D9] font-mono text-[10px]">
                {config.screenshot_hotkey}
              </kbd>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer: Daemon Status & Admin Auth */}
      <div className="border-t border-[#21262D] p-2 bg-[#010409]">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <DesktopIndicator status={desktop} compact />

            {session.authenticated ? (
              <button
                type="button"
                onClick={onLogout}
                className="p-2 text-[#8B949E] hover:text-[#FF7B72] rounded-lg hover:bg-[#161B22] transition-colors cursor-pointer"
                title="Sign out of admin session"
              >
                <LogOut className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleItemClick('archive')}
                className="p-2 text-[#8B949E] hover:text-[#58A6FF] rounded-lg hover:bg-[#161B22] transition-colors cursor-pointer"
                title="Admin Sign In"
              >
                <LogIn className="size-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2 p-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-[#8B949E] uppercase">Core Daemon</span>
              <DesktopIndicator status={desktop} />
            </div>

            {session.authenticated ? (
              <div className="flex items-center justify-between pt-1 border-t border-[#21262D]">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-5 rounded-full bg-[#1F6FEB] flex items-center justify-center text-white text-[10px] font-bold">
                    A
                  </div>
                  <span className="text-xs text-[#C9D1D9] truncate">Admin Active</span>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="p-1 text-[#8B949E] hover:text-[#FF7B72] rounded hover:bg-[#161B22] transition-colors cursor-pointer"
                  title="Sign out"
                >
                  <LogOut className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleItemClick('archive')}
                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#C9D1D9] bg-[#161B22] hover:bg-[#21262D] border border-[#30363D] transition-colors cursor-pointer"
              >
                <LogIn className="size-3.5 text-[#58A6FF]" />
                <span>Admin Sign In</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Left Sidebar */}
      <aside className="hidden md:flex h-screen shrink-0 sticky top-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
}
