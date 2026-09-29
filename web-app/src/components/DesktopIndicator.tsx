import { DesktopStatus } from '../types';

interface DesktopIndicatorProps {
  status: DesktopStatus;
  onToggleStatus?: () => void;
  compact?: boolean;
}

export default function DesktopIndicator({
  status,
  onToggleStatus,
  compact = false,
}: DesktopIndicatorProps) {
  const isOnline = status?.connected;

  const title = isOnline
    ? `Daemon Online · ${status.platform || 'Desktop'}`
    : 'Daemon Offline · Desktop bridge disconnected';

  const dotEl = (
    <span className="relative flex size-2">
      {isOnline && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3FB950] opacity-60" />
      )}
      <span
        className={`relative inline-flex size-2 rounded-full ${
          isOnline ? 'bg-[#3FB950] shadow-[0_0_6px_rgba(63,185,80,0.8)]' : 'bg-[#6E7681]'
        }`}
      />
    </span>
  );

  const baseClass = onToggleStatus ? 'cursor-pointer' : 'cursor-default';

  if (compact) {
    const cls = `relative flex size-8 items-center justify-center rounded-lg border transition-colors ${baseClass} ${
      isOnline
        ? 'bg-[#238636]/20 border-[#238636]/60 text-[#3FB950] hover:bg-[#238636]/40'
        : 'bg-[#161B22] border-[#30363D] text-[#8B949E] hover:border-[#8B949E]'
    }`;
    return onToggleStatus ? (
      <button type="button" onClick={onToggleStatus} title={title} className={cls}>
        {dotEl}
      </button>
    ) : (
      <div title={title} className={cls}>
        {dotEl}
      </div>
    );
  }

  const cls = `group relative inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${baseClass} ${
    isOnline
      ? 'bg-[#238636]/20 border-[#238636]/60 text-[#3FB950] hover:bg-[#238636]/30 shadow-sm'
      : 'bg-[#161B22] border-[#30363D] text-[#8B949E] hover:border-[#8B949E] hover:text-[#C9D1D9]'
  }`;

  return onToggleStatus ? (
    <button type="button" onClick={onToggleStatus} title={title} className={cls}>
      {dotEl}
      <span className="font-mono text-[10px] font-semibold tracking-wide">
        {isOnline ? 'ONLINE' : 'OFFLINE'}
      </span>
    </button>
  ) : (
    <div title={title} className={cls}>
      {dotEl}
      <span className="font-mono text-[10px] font-semibold tracking-wide">
        {isOnline ? 'ONLINE' : 'OFFLINE'}
      </span>
    </div>
  );
}
