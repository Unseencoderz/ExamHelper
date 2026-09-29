import { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Archive,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Maximize2,
  Info,
  Search,
  LayoutGrid,
  List,
} from 'lucide-react';
import { ScreenshotItem } from '../types';

interface ScreenshotGridProps {
  items: ScreenshotItem[];
  selectedIds: Set<string>;
  archived?: boolean;
  copiedId?: string;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onCopy: (item: ScreenshotItem) => void;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function formatDate(isoString: string): string {
  if (!isoString) return 'Just now';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Recently';

  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (60 * 1000));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '180 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CardInfoPopover({
  item,
  open,
  onClose,
}: {
  item: ScreenshotItem;
  open: boolean;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-12 right-2 z-30 w-72 rounded-xl border border-[#30363D] bg-[#161B22] p-4 text-xs text-[#C9D1D9] shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#21262D]">
        <span className="font-semibold text-white truncate">{item.filename || item.id}</span>
      </div>
      <dl className="grid grid-cols-[80px_1fr] gap-1.5 leading-relaxed">
        <dt className="text-[#8B949E]">Captured</dt>
        <dd className="text-[#C9D1D9] font-mono text-[11px]">{formatDate(item.received_at)}</dd>

        {item.archived_at && (
          <>
            <dt className="text-[#8B949E]">Archived</dt>
            <dd className="text-[#C9D1D9] font-mono text-[11px]">{formatDate(item.archived_at)}</dd>
          </>
        )}

        <dt className="text-[#8B949E]">Resolution</dt>
        <dd className="text-[#C9D1D9] font-mono text-[11px]">
          {item.dimensions?.width || 1280} × {item.dimensions?.height || 800} px
        </dd>

        <dt className="text-[#8B949E]">File size</dt>
        <dd className="text-[#C9D1D9] font-mono text-[11px]">{formatBytes(item.size_bytes)}</dd>

        {item.tags && item.tags.length > 0 && (
          <>
            <dt className="text-[#8B949E]">Tags</dt>
            <dd className="text-[#58A6FF] font-mono text-[11px]">{item.tags.join(', ')}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

export default function ScreenshotGrid({
  items,
  selectedIds,
  archived = false,
  copiedId,
  onToggle,
  onOpen,
  onCopy,
  onArchive,
  onRestore,
  onDelete,
}: ScreenshotGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);

  // Filter items based on label / tags
  const filtered = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesLabel = (item.label || item.filename || '').toLowerCase().includes(q);
    const matchesTags = item.tags?.some((t) => t.toLowerCase().includes(q));
    return matchesLabel || matchesTags;
  });

  if (items.length === 0) {
    return (
      <div className="flex min-h-[380px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[#30363D] bg-[#161B22]/40 p-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-xl bg-[#21262D] border border-[#30363D] text-[#8B949E]">
          {archived ? (
            <Archive className="size-6 text-[#8B949E]" />
          ) : (
            <Camera className="size-6 text-[#58A6FF]" />
          )}
        </div>
        <div className="max-w-md">
          <h3 className="text-base font-semibold text-white">
            {archived ? 'No archived screenshots' : 'Workspace is ready for captures'}
          </h3>
          <p className="mt-1.5 text-xs text-[#8B949E] leading-relaxed">
            {archived
              ? 'Archived captures will appear here once moved from your active desk.'
              : 'Screenshots will appear here as soon as the desktop client captures them using your configured hotkey.'}
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {/* Sub-toolbar: Search & Layout Mode */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#8B949E]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter captures by topic or tag..."
            className="w-full h-8 pl-8 pr-3 text-xs bg-[#010409] border border-[#30363D] focus:border-[#58A6FF] rounded-md text-[#C9D1D9] placeholder:text-[#6E7681] focus:outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8B949E] font-mono">
            {filtered.length} of {items.length} captures
          </span>

          <div className="flex items-center rounded-md border border-[#30363D] bg-[#010409] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#21262D] text-white shadow-sm'
                  : 'text-[#8B949E] hover:text-[#C9D1D9]'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#21262D] text-white shadow-sm'
                  : 'text-[#8B949E] hover:text-[#C9D1D9]'
              }`}
              title="List View"
            >
              <List className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#8B949E]">
          No screenshots match “{searchQuery}”.{' '}
          <button
            onClick={() => setSearchQuery('')}
            className="text-[#58A6FF] underline hover:text-white ml-1 font-medium cursor-pointer"
          >
            Clear filter
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const isCopied = copiedId === item.id;
            const title = item.label || item.filename || 'Screenshot';

            return (
              <article
                key={item.id}
                className={`group relative flex flex-col rounded-xl border transition-all duration-150 bg-[#161B22] overflow-hidden ${
                  isSelected
                    ? 'border-[#58A6FF] shadow-[0_0_0_1px_#58A6FF] ring-1 ring-[#58A6FF]/40'
                    : 'border-[#30363D] hover:border-[#8B949E]/70 hover:shadow-lg'
                }`}
              >
                {/* Image Canvas Container */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#010409]">
                  <button
                    type="button"
                    onClick={() => onOpen(item.id)}
                    className="size-full cursor-zoom-in block"
                    aria-label={`View ${title}`}
                  >
                    <img
                      src={item.image_url}
                      alt={title}
                      loading="lazy"
                      className="size-full object-cover object-top transition-transform duration-200 group-hover:scale-[1.01]"
                    />
                  </button>

                  {/* Scrim gradient on hover */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />

                  {/* Multi-select check (top-left) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(item.id);
                    }}
                    role="checkbox"
                    aria-checked={isSelected}
                    title={isSelected ? 'Deselect screenshot' : 'Select screenshot'}
                    className={`absolute top-2.5 left-2.5 flex size-6 items-center justify-center rounded-md border backdrop-blur-md transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#1F6FEB] bg-[#1F6FEB] text-white font-bold shadow-md'
                        : 'border-[#8B949E]/50 bg-[#010409]/70 text-transparent hover:border-white hover:text-white/80 opacity-0 group-hover:opacity-100 focus:opacity-100'
                    }`}
                  >
                    <Check className="size-3.5 stroke-[3]" />
                  </button>

                  {/* Hover Floating Actions */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => onOpen(item.id)}
                      className="flex size-7 items-center justify-center rounded-md border border-[#30363D] bg-[#161B22]/90 text-[#C9D1D9] backdrop-blur-md hover:bg-[#21262D] hover:text-white transition-colors cursor-pointer"
                      title="Inspect full screen"
                    >
                      <Maximize2 className="size-3.5" />
                    </button>
                  </div>

                  <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenInfoId(openInfoId === item.id ? null : item.id);
                      }}
                      className="flex size-7 items-center justify-center rounded-md border border-[#30363D] bg-[#161B22]/90 text-[#C9D1D9] backdrop-blur-md hover:bg-[#21262D] hover:text-white transition-colors cursor-pointer"
                      title="Metadata & Details"
                    >
                      <Info className="size-3.5" />
                    </button>

                    {/* Copy button with inline checkmark swap */}
                    <button
                      type="button"
                      onClick={() => onCopy(item)}
                      className={`flex h-7 items-center gap-1 px-2.5 rounded-md border backdrop-blur-md text-xs font-semibold transition-all cursor-pointer ${
                        isCopied
                          ? 'border-[#238636] bg-[#238636] text-white'
                          : 'border-[#30363D] bg-[#161B22]/90 text-[#C9D1D9] hover:bg-[#21262D] hover:text-white'
                      }`}
                      title={isCopied ? 'Copied' : 'Copy screenshot to clipboard'}
                    >
                      {isCopied ? (
                        <Check className="size-3 stroke-[2.5] text-white" />
                      ) : (
                        <Copy className="size-3 text-[#C9D1D9]" />
                      )}
                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>

                    {archived ? (
                      <>
                        {onRestore && (
                          <button
                            type="button"
                            onClick={() => onRestore(item.id)}
                            className="flex size-7 items-center justify-center rounded-md border border-[#30363D] bg-[#161B22]/90 text-[#C9D1D9] backdrop-blur-md hover:bg-[#1F6FEB] hover:text-white transition-colors cursor-pointer"
                            title="Restore to active"
                          >
                            <RotateCcw className="size-3.5" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(item.id)}
                            className="flex size-7 items-center justify-center rounded-md border border-[#DA3633]/60 bg-[#DA3633]/20 text-[#FF7B72] backdrop-blur-md hover:bg-[#DA3633] hover:text-white transition-colors cursor-pointer"
                            title="Delete permanently"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </>
                    ) : (
                      onArchive && (
                        <button
                          type="button"
                          onClick={() => onArchive(item.id)}
                          className="flex size-7 items-center justify-center rounded-md border border-[#30363D] bg-[#161B22]/90 text-[#C9D1D9] backdrop-blur-md hover:bg-[#21262D] hover:text-white transition-colors cursor-pointer"
                          title="Archive"
                        >
                          <Archive className="size-3.5" />
                        </button>
                      )
                    )}
                  </div>

                  <CardInfoPopover
                    item={item}
                    open={openInfoId === item.id}
                    onClose={() => setOpenInfoId(null)}
                  />
                </div>

                {/* Card Meta Footer */}
                <div className="flex flex-col p-3 border-t border-[#21262D] bg-[#161B22]">
                  <h3
                    className="text-xs font-semibold text-[#C9D1D9] line-clamp-1 group-hover:text-white transition-colors"
                    title={title}
                  >
                    {title}
                  </h3>

                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#8B949E] font-mono tabular-nums">
                    <span>{formatDate(item.received_at)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.dimensions?.width || 1280}×{item.dimensions?.height || 800}</span>
                    {item.tags && item.tags[0] && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#58A6FF] truncate">#{item.tags[0]}</span>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* Compact List View */
        <div className="divide-y divide-[#21262D] rounded-xl border border-[#30363D] bg-[#161B22] overflow-hidden">
          {filtered.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const isCopied = copiedId === item.id;
            const title = item.label || item.filename || 'Screenshot';

            return (
              <div
                key={item.id}
                className={`group flex items-center gap-3 p-2.5 transition-colors ${
                  isSelected ? 'bg-[#1F6FEB]/15' : 'hover:bg-[#21262D]/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggle(item.id)}
                  role="checkbox"
                  aria-checked={isSelected}
                  className={`flex size-5 shrink-0 items-center justify-center rounded border transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-[#1F6FEB] bg-[#1F6FEB] text-white font-bold'
                      : 'border-[#30363D] bg-[#0D1117] text-transparent'
                  }`}
                >
                  <Check className="size-3 stroke-[3]" />
                </button>

                <div
                  onClick={() => onOpen(item.id)}
                  className="size-12 shrink-0 rounded-md overflow-hidden border border-[#30363D] bg-black cursor-pointer"
                >
                  <img
                    src={item.image_url}
                    alt={title}
                    className="size-full object-cover object-top"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-white truncate">{title}</h4>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#8B949E] font-mono mt-0.5">
                    <span>{formatDate(item.received_at)}</span>
                    <span>·</span>
                    <span>{formatBytes(item.size_bytes)}</span>
                    {item.tags?.map((t) => (
                      <span key={t} className="text-[#58A6FF]">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onCopy(item)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                      isCopied
                        ? 'border-[#238636] bg-[#238636] text-white'
                        : 'border-[#30363D] bg-[#21262D] text-[#C9D1D9] hover:text-white hover:border-[#8B949E]'
                    }`}
                  >
                    {isCopied ? <Check className="size-3 text-white" /> : <Copy className="size-3 text-[#8B949E]" />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>

                  {archived ? (
                    <>
                      {onRestore && (
                        <button
                          type="button"
                          onClick={() => onRestore(item.id)}
                          className="p-1.5 text-[#8B949E] hover:text-[#58A6FF] rounded hover:bg-[#21262D] transition-colors"
                          title="Restore"
                        >
                          <RotateCcw className="size-3.5" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(item.id)}
                          className="p-1.5 text-[#8B949E] hover:text-[#FF7B72] rounded hover:bg-[#DA3633]/20 transition-colors"
                          title="Delete permanently"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </>
                  ) : (
                    onArchive && (
                      <button
                        type="button"
                        onClick={() => onArchive(item.id)}
                        className="p-1.5 text-[#8B949E] hover:text-[#FFA657] rounded hover:bg-[#21262D] transition-colors"
                        title="Archive"
                      >
                        <Archive className="size-3.5" />
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
