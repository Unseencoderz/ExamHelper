import { useState } from 'react';
import {
  Send,
  Trash2,
  Copy,
  Check,
  X,
  Search,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { ClipboardEntry } from '../types';

interface ClipboardPanelProps {
  history: ClipboardEntry[];
  value: string;
  setValue: (val: string) => void;
  busy: boolean;
  onPush: () => Promise<void>;
  onDelete: (id: string) => void;
  onClear: () => void;
}

function formatRelativeTime(isoString: string): string {
  if (!isoString) return 'Just now';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Recently';

  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ClipboardPanel({
  history,
  value,
  setValue,
  busy,
  onPush,
  onDelete,
  onClear,
}: ClipboardPanelProps) {
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const filtered = history.filter((item) => {
    if (!search.trim()) return true;
    return item.content.toLowerCase().includes(search.toLowerCase());
  });

  const handleCopy = (entry: ClipboardEntry) => {
    navigator.clipboard.writeText(entry.content);
    setCopiedId(entry.id);
    setAnnouncement('Clipboard content copied');
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="space-y-6">
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#30363D] pb-5">
        <div>
          <span className="text-[11px] font-mono font-semibold tracking-wider uppercase text-[#58A6FF]">
            LIVE DESKTOP SYNC
          </span>
          <h1 className="text-xl font-bold tracking-tight text-white mt-1">Desktop Clipboard</h1>
          <p className="text-xs text-[#8B949E] mt-1 max-w-xl">
            Recent text copied on your desktop appears here automatically. Inject text directly to desktop memory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!history.length || busy}
            onClick={onClear}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#30363D] bg-[#21262D] text-xs font-semibold text-[#C9D1D9] hover:text-[#FF7B72] hover:border-[#DA3633]/60 hover:bg-[#DA3633]/15 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Trash2 className="size-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Main Layout: History 7 cols + Push 5 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Clipboard History */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#8B949E]" />
              <input
                type="text"
                placeholder="Search copied text history..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-xs bg-[#010409] border border-[#30363D] focus:border-[#58A6FF] rounded-md text-[#C9D1D9] placeholder:text-[#6E7681] focus:outline-none transition-colors"
              />
            </div>
            <span className="text-xs text-[#8B949E] font-mono shrink-0">
              {filtered.length} entries
            </span>
          </div>

          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-[#30363D] bg-[#161B22]/30 text-[#8B949E] text-xs">
                {search ? `No entries matching “${search}”.` : 'No desktop clipboard history yet.'}
              </div>
            ) : (
              filtered.map((entry) => {
                const isCopied = copiedId === entry.id;

                return (
                  <article
                    key={entry.id}
                    className="group relative rounded-xl border border-[#30363D] bg-[#161B22] p-3.5 hover:border-[#8B949E] transition-all duration-150"
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#21262D] text-[11px] text-[#8B949E] font-mono">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3 text-[#58A6FF]" />
                        <span>{formatRelativeTime(entry.updatedAt)}</span>
                        <span>·</span>
                        <span>{entry.content.length} chars</span>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Inline copy swap */}
                        <button
                          type="button"
                          onClick={() => handleCopy(entry)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                            isCopied
                              ? 'border-[#238636] bg-[#238636] text-white'
                              : 'border-[#30363D] bg-[#21262D] text-[#C9D1D9] hover:text-white'
                          }`}
                          title="Copy to web clipboard"
                        >
                          {isCopied ? (
                            <Check className="size-3 stroke-[2.5] text-white" />
                          ) : (
                            <Copy className="size-3 text-[#8B949E]" />
                          )}
                          <span>{isCopied ? 'Copied' : 'Copy'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onDelete(entry.id)}
                          className="p-1 text-[#8B949E] hover:text-[#FF7B72] rounded hover:bg-[#DA3633]/20 transition-colors cursor-pointer"
                          title="Delete entry"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    <pre className="max-h-28 overflow-auto rounded-lg bg-[#0D1117] p-2.5 font-mono text-xs text-[#C9D1D9] whitespace-pre-wrap break-words leading-relaxed border border-[#21262D]">
                      {entry.content}
                    </pre>
                  </article>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Push to Desktop Box */}
        <div className="lg:col-span-5 rounded-xl border border-[#30363D] bg-[#161B22] p-5 shadow-sm">
          <div className="pb-3 mb-4 border-b border-[#21262D]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ArrowUpRight className="size-4 text-[#58A6FF]" />
              <span>Send to Desktop Clipboard</span>
            </h2>
            <p className="text-xs text-[#8B949E] mt-1">
              Pushes text directly to desktop memory so you can immediately paste in any app.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!value.trim()) return;
              onPush();
            }}
            className="space-y-4"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-[#C9D1D9]">
                  Text to send
                </label>
                <span className="text-[10px] font-mono text-[#8B949E]">
                  {value.length} characters
                </span>
              </div>
              <textarea
                rows={9}
                placeholder="Enter text to place on the desktop clipboard…"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full p-3 font-mono text-xs bg-[#0D1117] border border-[#30363D] focus:border-[#58A6FF] rounded-md text-white placeholder:text-[#6E7681] focus:outline-none transition-colors resize-y leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={busy || !value.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-[#238636] hover:bg-[#2ea043] text-white font-semibold text-xs shadow-sm disabled:opacity-40 transition-all cursor-pointer active:scale-95"
            >
              <Send className="size-3.5" />
              <span>Send to Desktop</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
