import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  Crop,
  Scissors,
  X,
  Download,
} from 'lucide-react';
import { ScreenshotItem } from '../types';
import { canvasToBlob, loadImage } from '../lib/images';

export interface ViewerState {
  items: ScreenshotItem[];
  index: number;
  setIndex: (index: number) => void;
}

interface ImageViewerProps {
  viewer: ViewerState | null;
  onClose: () => void;
  onCopy: (item: ScreenshotItem) => void;
  onCropCopied: (item: ScreenshotItem) => void;
  onCopyError: (message: string) => void;
  copied?: boolean;
  cropCopied?: boolean;
}

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function ImageViewer({
  viewer,
  onClose,
  onCopy,
  onCropCopied,
  onCopyError,
  copied = false,
  cropCopied = false,
}: ImageViewerProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [cropMode, setCropMode] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [imgNaturalSize, setImgNaturalSize] = useState<{ width: number; height: number }>({
    width: 1280,
    height: 800,
  });

  useEffect(() => {
    setCropMode(false);
    setCropStart(null);
    setCrop(null);
  }, [viewer?.index]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!viewer) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && viewer.index > 0) viewer.setIndex(viewer.index - 1);
      if (e.key === 'ArrowRight' && viewer.index < viewer.items.length - 1)
        viewer.setIndex(viewer.index + 1);
      if (e.key.toLowerCase() === 'c' && !cropMode) {
        setCropMode(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewer, onClose, cropMode]);

  if (!viewer) return null;
  const item = viewer.items[viewer.index];
  if (!item) return null;

  function getNormPoint(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!cropMode || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = getNormPoint(e);
    setCropStart(p);
    setCrop({ x: p.x, y: p.y, width: 0, height: 0 });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!cropStart) return;
    const p = getNormPoint(e);
    setCrop({
      x: Math.min(cropStart.x, p.x),
      y: Math.min(cropStart.y, p.y),
      width: Math.abs(p.x - cropStart.x),
      height: Math.abs(p.y - cropStart.y),
    });
  }

  function handlePointerUp() {
    setCropStart(null);
  }

  async function handleCopyCrop() {
    const image = imageRef.current;
    if (!crop || !image) {
      onCopyError('Draw a crop selection on the image first.');
      return;
    }

    try {
      const naturalW = image.naturalWidth || imgNaturalSize.width || 1280;
      const naturalH = image.naturalHeight || imgNaturalSize.height || 800;

      const sx = Math.max(0, Math.round(crop.x * naturalW));
      const sy = Math.max(0, Math.round(crop.y * naturalH));
      const sw = Math.min(naturalW - sx, Math.max(4, Math.round(crop.width * naturalW)));
      const sh = Math.min(naturalH - sy, Math.max(4, Math.round(crop.height * naturalH)));

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not initialize canvas context.');

      // Load image source into canvas safely
      const imgToDraw = await loadImage(item.image_url);
      ctx.drawImage(imgToDraw, sx, sy, sw, sh, 0, 0, sw, sh);

      const blob = await canvasToBlob(canvas);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      onCropCopied(item);
    } catch (err: any) {
      onCopyError(err.message || 'Failed to copy cropped region to clipboard.');
    }
  }

  async function handleDownload() {
    try {
      // Browsers ignore the download attribute for cross-origin Cloudinary URLs.
      // Turning the response into a blob makes the generated URL same-origin,
      // so the click always downloads rather than navigating to the image.
      const response = await fetch(item.image_url);
      if (!response.ok) throw new Error(`Image download failed (${response.status}).`);

      const objectUrl = URL.createObjectURL(await response.blob());
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = item.filename || `screenshot-${item.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      onCopyError(error instanceof Error ? error.message : 'Failed to download the image.');
    }
  }

  const cropPixelW = crop ? Math.round(crop.width * imgNaturalSize.width) : 0;
  const cropPixelH = crop ? Math.round(crop.height * imgNaturalSize.height) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot Inspector"
      className="fixed inset-0 z-50 flex flex-col bg-[#0D1117]/95 backdrop-blur-2xl select-none text-[#C9D1D9]"
    >
      {/* Top Bar Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#30363D] px-4 sm:px-6 bg-[#161B22]/90">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm text-white truncate max-w-sm sm:max-w-md">
            {item.label || item.filename || item.id}
          </span>
          <span className="text-xs text-[#8B949E] font-mono hidden sm:inline">
            {imgNaturalSize.width} × {imgNaturalSize.height} px
          </span>
          <span className="text-xs text-[#58A6FF] font-mono">
            ({viewer.index + 1} of {viewer.items.length})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#C9D1D9] hover:text-white bg-[#21262D] border border-[#30363D] hover:border-[#8B949E] rounded-md transition-colors cursor-pointer"
            title="Download original PNG"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md bg-[#21262D] text-[#8B949E] hover:bg-[#30363D] hover:text-white border border-[#30363D] transition-colors cursor-pointer"
            aria-label="Close Inspector (Esc)"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Main Stage Viewport */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-8">
        {/* Navigation Arrow Left */}
        <button
          type="button"
          disabled={viewer.index === 0}
          onClick={() => viewer.setIndex(viewer.index - 1)}
          className="absolute left-4 z-20 flex size-10 items-center justify-center rounded-full bg-[#161B22]/90 text-white border border-[#30363D] shadow-xl backdrop-blur-md hover:bg-[#21262D] disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
          title="Previous screenshot (←)"
        >
          <ChevronLeft className="size-5" />
        </button>

        {/* Navigation Arrow Right */}
        <button
          type="button"
          disabled={viewer.index === viewer.items.length - 1}
          onClick={() => viewer.setIndex(viewer.index + 1)}
          className="absolute right-4 z-20 flex size-10 items-center justify-center rounded-full bg-[#161B22]/90 text-white border border-[#30363D] shadow-xl backdrop-blur-md hover:bg-[#21262D] disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
          title="Next screenshot (→)"
        >
          <ChevronRight className="size-5" />
        </button>

        {/* Scaled Image & Interactive Crop Canvas */}
        <div
          ref={stageRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`relative max-h-[calc(100vh-140px)] max-w-full overflow-hidden rounded-xl border border-[#30363D] shadow-2xl bg-black ${
            cropMode ? 'cursor-crosshair' : 'cursor-default'
          }`}
        >
          <img
            ref={imageRef}
            src={item.image_url}
            alt={item.label || item.filename || 'Preview'}
            draggable={false}
            onLoad={(e) => {
              const target = e.currentTarget;
              setImgNaturalSize({
                width: target.naturalWidth || 1280,
                height: target.naturalHeight || 800,
              });
            }}
            className="block max-h-[calc(100vh-140px)] max-w-full object-contain pointer-events-none select-none"
          />

          {/* Interactive Crop Selection Overlay */}
          {crop && (
            <div
              className="absolute border-2 border-[#58A6FF] bg-[#58A6FF]/20 shadow-[0_0_0_9999px_rgba(1,4,9,0.7)] pointer-events-none"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.width * 100}%`,
                height: `${crop.height * 100}%`,
              }}
            >
              <div className="absolute -top-6 left-0 px-1.5 py-0.5 rounded bg-[#1F6FEB] text-white font-mono text-[10px] font-bold">
                {cropPixelW} × {cropPixelH} px
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Control Deck */}
      <div className="flex h-16 shrink-0 items-center justify-between border-t border-[#30363D] bg-[#161B22]/95 px-4 sm:px-6 backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs text-[#8B949E]">
          <kbd className="px-1.5 py-0.5 rounded bg-[#0D1117] border border-[#30363D] text-[#C9D1D9] font-mono text-[10px]">
            ← / →
          </kbd>
          <span className="hidden sm:inline">Navigate</span>
          <span className="text-[#30363D] hidden sm:inline">·</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[#0D1117] border border-[#30363D] text-[#C9D1D9] font-mono text-[10px]">
            C
          </kbd>
          <span className="hidden sm:inline">Crop Mode</span>
          <span className="text-[#30363D] hidden sm:inline">·</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[#0D1117] border border-[#30363D] text-[#C9D1D9] font-mono text-[10px]">
            Esc
          </kbd>
          <span className="hidden sm:inline">Exit</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCropMode(!cropMode);
              if (cropMode) setCrop(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
              cropMode
                ? 'border-[#58A6FF] bg-[#1F6FEB]/20 text-[#58A6FF] shadow-sm'
                : 'border-[#30363D] bg-[#21262D] text-[#C9D1D9] hover:text-white hover:border-[#8B949E]'
            }`}
          >
            <Crop className="size-3.5" />
            <span>{cropMode ? 'Cancel Selection' : 'Select Crop'}</span>
          </button>

          {cropMode && (
            <button
              type="button"
              disabled={!crop || crop.width === 0 || crop.height === 0}
              onClick={handleCopyCrop}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold border shadow-sm transition-all cursor-pointer ${
                cropCopied
                  ? 'border-[#238636] bg-[#238636] text-white'
                  : 'border-[#1F6FEB] bg-[#1F6FEB] text-white hover:bg-[#388bfd] disabled:opacity-40 disabled:pointer-events-none'
              }`}
            >
              {cropCopied ? (
                <Check className="size-3.5 stroke-[2.5]" />
              ) : (
                <Scissors className="size-3.5" />
              )}
              <span>{cropCopied ? 'Cropped' : 'Crop Region'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onCopy(item)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold border shadow-sm transition-all cursor-pointer ${
              copied
                ? 'border-[#238636] bg-[#238636] text-white'
                : 'border-[#30363D] bg-[#21262D] hover:bg-[#30363D] text-[#C9D1D9] hover:text-white'
            }`}
          >
            {copied ? (
              <Check className="size-3.5 stroke-[2.5]" />
            ) : (
              <Copy className="size-3.5" />
            )}
            <span>{copied ? 'Copied' : 'Copy Full Image'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
