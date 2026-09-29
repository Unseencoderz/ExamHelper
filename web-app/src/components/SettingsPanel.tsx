import { useState } from 'react';
import {
  Keyboard,
  Check,
  Volume2,
  Monitor,
} from 'lucide-react';
import { AppConfig, DesktopStatus } from '../types';

const HOTKEYS = [
  'Win+Alt+C',
  'Ctrl+Shift+4',
  'Ctrl+Alt+S',
  'Ctrl+Shift+S',
  'Alt+Shift+X',
  'Win+Shift+S',
];

interface SettingsPanelProps {
  hotkey: string;
  setHotkey: (val: string) => void;
  config: AppConfig | null;
  desktop: DesktopStatus;
  busy: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

export default function SettingsPanel({
  hotkey,
  setHotkey,
  config,
  desktop,
  busy,
  onSubmit,
}: SettingsPanelProps) {
  const [selectedKey, setSelectedKey] = useState(hotkey || config?.screenshot_hotkey || 'Win+Alt+C');
  const [soundEnabled, setSoundEnabled] = useState(config?.play_sound ?? true);
  const [retentionHours, setRetentionHours] = useState(config?.auto_archive_hours || 48);

  const handleKeySelect = (key: string) => {
    setSelectedKey(key);
    setHotkey(key);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-[#30363D] pb-5">
        <span className="text-[11px] font-mono font-semibold tracking-wider uppercase text-[#58A6FF]">
          ADMIN SETTINGS
        </span>
        <h1 className="text-xl font-bold tracking-tight text-white mt-1">Screenshot Hotkey &amp; Preferences</h1>
        <p className="text-xs text-[#8B949E] mt-1">
          Choose the global capture shortcut and retention behaviors for the connected desktop client.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Hotkey Section */}
        <section className="rounded-xl border border-[#30363D] bg-[#161B22] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Keyboard className="size-4 text-[#58A6FF]" />
            <h2 className="text-sm font-semibold text-white">Capture Shortcut</h2>
          </div>
          <p className="text-xs text-[#8B949E] mb-4 leading-relaxed">
            Choose the global capture shortcut registered on your connected desktop client.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {HOTKEYS.map((k) => {
              const isSelected = selectedKey === k;
              const parts = k.split('+');

              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleKeySelect(k)}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#58A6FF] bg-[#1F6FEB]/15 shadow-sm ring-1 ring-[#58A6FF]/40 text-white'
                      : 'border-[#30363D] bg-[#0D1117] hover:border-[#8B949E] text-[#8B949E] hover:text-[#C9D1D9]'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {parts.map((part, idx) => (
                      <span key={idx} className="flex items-center">
                        <kbd className="px-1.5 py-0.5 rounded bg-[#161B22] border border-[#30363D] font-mono text-[11px] font-semibold text-[#C9D1D9] shadow-inner">
                          {part}
                        </kbd>
                        {idx < parts.length - 1 && (
                          <span className="text-[#8B949E] text-xs mx-0.5">+</span>
                        )}
                      </span>
                    ))}
                  </div>

                  {isSelected && (
                    <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#58A6FF]">
                      <Check className="size-3" />
                      <span>Selected</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between pt-4 border-t border-[#21262D]">
            <span className="text-xs text-[#8B949E] font-mono">
              Current trigger: <strong className="text-white font-bold">{selectedKey}</strong>
            </span>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#238636] hover:bg-[#2ea043] text-white font-semibold text-xs shadow-sm disabled:opacity-40 transition-all cursor-pointer active:scale-95"
            >
              <Check className="size-3.5 stroke-[2.5]" />
              <span>Apply Hotkey</span>
            </button>
          </div>
        </section>

        {/* Capture Behavior */}
        <section className="rounded-xl border border-[#30363D] bg-[#161B22] p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Volume2 className="size-4 text-[#58A6FF]" />
            <h2 className="text-sm font-semibold text-white">Capture Behavior &amp; Retention</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-start gap-3 p-3.5 rounded-lg border border-[#30363D] bg-[#0D1117] hover:bg-[#0D1117]/80 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="mt-0.5 rounded border-[#30363D] bg-[#161B22] text-[#1F6FEB] focus:ring-[#58A6FF]"
              />
              <div>
                <p className="text-xs font-semibold text-white">Shutter Sound Confirmation</p>
                <p className="text-[11px] text-[#8B949E] mt-0.5">
                  Play auditory chime upon capture completion.
                </p>
              </div>
            </label>

            <div className="p-3.5 rounded-lg border border-[#30363D] bg-[#0D1117]">
              <p className="text-xs font-semibold text-white">Auto-Archive Retention</p>
              <p className="text-[11px] text-[#8B949E] mt-0.5 mb-2">
                Move screenshots to archive after elapsed time.
              </p>
              <select
                value={retentionHours}
                onChange={(e) => setRetentionHours(Number(e.target.value))}
                className="w-full h-8 px-2 text-xs bg-[#161B22] border border-[#30363D] rounded-md text-white focus:outline-none focus:border-[#58A6FF]"
              >
                <option value={12}>12 Hours</option>
                <option value={24}>24 Hours (1 Day)</option>
                <option value={48}>48 Hours (2 Days)</option>
                <option value={168}>7 Days</option>
                <option value={0}>Manual Only (Never)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Desktop Daemon Telemetry */}
        <section className="rounded-xl border border-[#30363D] bg-[#161B22] p-5 shadow-sm">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#21262D]">
            <Monitor className="size-4 text-[#58A6FF]" />
            <h2 className="text-sm font-semibold text-white">Daemon Environment</h2>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#0D1117] border border-[#30363D]">
              <dt className="text-[#8B949E] text-[11px] font-mono">CONNECTION</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-semibold">
                <span
                  className={`size-2 rounded-full ${
                    desktop.connected ? 'bg-[#3FB950]' : 'bg-[#FF7B72]'
                  }`}
                />
                <span className={desktop.connected ? 'text-[#3FB950]' : 'text-[#FF7B72]'}>
                  {desktop.connected ? 'Active WebSocket' : 'Disconnected'}
                </span>
              </dd>
            </div>

            <div className="p-3 rounded-lg bg-[#0D1117] border border-[#30363D]">
              <dt className="text-[#8B949E] text-[11px] font-mono">CLIENT VERSION</dt>
              <dd className="mt-1 font-mono text-white">
                {desktop.clientVersion || '3.1.0-pro'}
              </dd>
            </div>

            <div className="p-3 rounded-lg bg-[#0D1117] border border-[#30363D]">
              <dt className="text-[#8B949E] text-[11px] font-mono">HOST PLATFORM</dt>
              <dd className="mt-1 font-mono text-white truncate">
                {desktop.platform || 'Desktop Host'}
              </dd>
            </div>
          </dl>
        </section>
      </form>
    </div>
  );
}
