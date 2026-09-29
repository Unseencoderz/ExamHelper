import { ScreenshotItem } from '../types';

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Unable to render PNG image from canvas.'));
    }, 'image/png');
  });
}

export async function loadImage(srcOrBlob: string | Blob): Promise<HTMLImageElement> {
  let url: string;
  let isCreatedUrl = false;

  if (typeof srcOrBlob === 'string') {
    url = srcOrBlob;
  } else {
    url = URL.createObjectURL(srcOrBlob);
    isCreatedUrl = true;
  }

  try {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to decode screenshot image for export.'));
      image.src = url;
    });
    return image;
  } finally {
    if (isCreatedUrl) {
      URL.revokeObjectURL(url);
    }
  }
}

export async function pngFromBlob(blob: Blob): Promise<Blob> {
  const image = await loadImage(blob);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || 1280;
  canvas.height = image.naturalHeight || 800;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to acquire 2D drawing context.');
  context.drawImage(image, 0, 0);
  return canvasToBlob(canvas);
}

export async function getImageBlobs(ids: string[], items: ScreenshotItem[]): Promise<Array<{ meta: ScreenshotItem; blob: Blob }>> {
  const chosen = items.filter((item) => ids.includes(item.id));
  const entries: Array<{ meta: ScreenshotItem; blob: Blob }> = [];

  for (const item of chosen) {
    if (item.image_url.startsWith('data:')) {
      const img = await loadImage(item.image_url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1280;
      canvas.height = img.naturalHeight || 800;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const blob = await canvasToBlob(canvas);
        entries.push({ meta: item, blob });
      }
    } else {
      try {
        const response = await fetch(item.image_url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await pngFromBlob(await response.blob());
        entries.push({ meta: item, blob });
      } catch {
        // Fallback: draw through image element
        const img = await loadImage(item.image_url);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1280;
        canvas.height = img.naturalHeight || 800;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const blob = await canvasToBlob(canvas);
          entries.push({ meta: item, blob });
        }
      }
    }
  }

  return entries;
}

export async function contactSheet(entries: Array<{ meta: ScreenshotItem; blob: Blob }>): Promise<Blob> {
  const loaded: Array<{ meta: ScreenshotItem; image: HTMLImageElement }> = [];
  for (const entry of entries) {
    loaded.push({ meta: entry.meta, image: await loadImage(entry.blob) });
  }

  const gap = 24;
  const labelHeight = 36;
  const cellWidth = 480;
  const columns = loaded.length === 1 ? 1 : 2;
  const rows = Math.ceil(loaded.length / columns);

  const sizes = loaded.map(({ image }) => {
    const ratio = Math.min(cellWidth / (image.naturalWidth || cellWidth), 1);
    return {
      width: Math.round((image.naturalWidth || cellWidth) * ratio),
      height: Math.round((image.naturalHeight || 300) * ratio),
    };
  });

  const rowHeights = Array.from({ length: rows }, (_, row) =>
    Math.max(
      ...sizes
        .slice(row * columns, row * columns + columns)
        .map((size) => size.height + labelHeight),
      0
    )
  );

  const canvas = document.createElement('canvas');
  canvas.width = columns * cellWidth + gap * (columns + 1);
  canvas.height = rowHeights.reduce((sum, h) => sum + h, 0) + gap * (rows + 1);

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to prepare the contact sheet canvas.');

  // Dark modern sheet background
  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, canvas.width, canvas.height);

  let y = gap;
  loaded.forEach((entry, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const size = sizes[index];
    const x = gap + column * (cellWidth + gap);

    // Label
    context.fillStyle = '#94a3b8';
    context.font = '600 13px ui-monospace, SFMono-Regular, monospace';
    context.fillText(
      `${index + 1}. ${entry.meta.label || entry.meta.filename || entry.meta.id}`,
      x,
      y + 18
    );

    // Image frame
    context.drawImage(entry.image, x, y + labelHeight, size.width, size.height);

    if (column === columns - 1 || index === loaded.length - 1) {
      y += rowHeights[row] + gap;
    }
  });

  return canvasToBlob(canvas);
}

export async function copyScreenshots(ids: string[], items: ScreenshotItem[]): Promise<'single' | 'multiple' | 'contact-sheet'> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Your browser does not support clipboard image writes.');
  }

  const entries = await getImageBlobs(ids, items);
  if (entries.length === 0) {
    throw new Error('Select at least one screenshot to copy.');
  }

  if (entries.length === 1) {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': entries[0].blob }),
    ]);
    return 'single';
  }

  try {
    await navigator.clipboard.write(
      entries.map(({ blob }) => new ClipboardItem({ 'image/png': blob }))
    );
    return 'multiple';
  } catch {
    const sheetBlob = await contactSheet(entries);
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': sheetBlob }),
    ]);
    return 'contact-sheet';
  }
}
