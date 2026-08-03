/**
 * Openflip Photo Editor engine.
 * A single canvas render pipeline is used for BOTH the live preview and the
 * final export, so what the user sees is exactly what gets published.
 */

export interface Adjustments {
  brightness: number; // -100..100
  contrast: number;   // -100..100
  saturation: number; // -100..100
  warmth: number;     // -100..100
  sharpness: number;  // 0..100
  blur: number;       // 0..100
  vignette: number;   // 0..100
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  sharpness: 0,
  blur: 0,
  vignette: 0,
};

export interface EditState {
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  aspect: number | null; // null = original
  zoom: number;          // >= 1
  offsetX: number;       // -0.5..0.5 of available slack
  offsetY: number;
  filter: string;        // preset id
  adjustments: Adjustments;
}

export const DEFAULT_EDIT_STATE: EditState = {
  rotate: 0,
  flipH: false,
  flipV: false,
  aspect: 1,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  filter: 'original',
  adjustments: { ...DEFAULT_ADJUSTMENTS },
};

export const ASPECT_PRESETS: { id: string; label: string; value: number | null }[] = [
  { id: 'original', label: 'Original', value: null },
  { id: 'square', label: '1:1', value: 1 },
  { id: 'portrait', label: '4:5', value: 4 / 5 },
  { id: 'story', label: '9:16', value: 9 / 16 },
  { id: 'wide', label: '16:9', value: 16 / 9 },
];

export interface FilterPreset {
  id: string;
  label: string;
  /** extra css filter fragments */
  css: string;
  /** optional colour wash */
  overlay?: { color: string; alpha: number; blend: GlobalCompositeOperation };
}

export const FILTER_PRESETS: FilterPreset[] = [
  { id: 'original', label: 'Original', css: '' },
  { id: 'clarendon', label: 'Clarendon', css: 'contrast(1.2) saturate(1.35) brightness(1.05)', overlay: { color: '#7fb9e0', alpha: 0.12, blend: 'overlay' } },
  { id: 'gingham', label: 'Gingham', css: 'brightness(1.05) hue-rotate(-10deg) contrast(0.9)', overlay: { color: '#e6e6fa', alpha: 0.15, blend: 'soft-light' } },
  { id: 'juno', label: 'Juno', css: 'saturate(1.4) contrast(1.1)', overlay: { color: '#ffb86b', alpha: 0.12, blend: 'soft-light' } },
  { id: 'lark', label: 'Lark', css: 'brightness(1.1) contrast(0.9) saturate(1.1)', overlay: { color: '#c7f0ff', alpha: 0.1, blend: 'soft-light' } },
  { id: 'ludwig', label: 'Ludwig', css: 'brightness(1.05) contrast(1.05) saturate(0.9)' },
  { id: 'moon', label: 'Moon', css: 'grayscale(1) brightness(1.1) contrast(1.1)' },
  { id: 'willow', label: 'Willow', css: 'grayscale(0.6) contrast(0.95) brightness(1.05)', overlay: { color: '#d8c8b8', alpha: 0.2, blend: 'soft-light' } },
  { id: 'valencia', label: 'Valencia', css: 'sepia(0.2) contrast(1.08) brightness(1.08) saturate(1.15)' },
  { id: 'nashville', label: 'Nashville', css: 'sepia(0.25) contrast(1.1) brightness(1.05) saturate(1.2)', overlay: { color: '#f7a08a', alpha: 0.22, blend: 'soft-light' } },
  { id: 'aden', label: 'Aden', css: 'hue-rotate(-20deg) contrast(0.9) saturate(0.85) brightness(1.1)', overlay: { color: '#ff8a5b', alpha: 0.1, blend: 'soft-light' } },
  { id: 'perpetua', label: 'Perpetua', css: 'contrast(1.05) saturate(1.1)', overlay: { color: '#68ada0', alpha: 0.18, blend: 'soft-light' } },
  { id: 'reyes', label: 'Reyes', css: 'sepia(0.22) brightness(1.12) contrast(0.85) saturate(0.75)' },
  { id: 'slumber', label: 'Slumber', css: 'saturate(0.66) brightness(1.05)', overlay: { color: '#452d2d', alpha: 0.18, blend: 'soft-light' } },
  { id: 'xpro', label: 'X-Pro II', css: 'sepia(0.3) contrast(1.3) saturate(1.3)', overlay: { color: '#4b2e17', alpha: 0.2, blend: 'overlay' } },
  { id: 'inkwell', label: 'Inkwell', css: 'grayscale(1) contrast(1.15) brightness(1.05)' },
];

export const FRAME_PRESETS: { id: string; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'white', label: 'White' },
  { id: 'black', label: 'Black' },
  { id: 'brand', label: 'Openflip' },
];

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function buildCssFilter(adj: Adjustments, preset: FilterPreset | undefined): string {
  const parts: string[] = [];
  if (preset?.css) parts.push(preset.css);
  parts.push(`brightness(${1 + adj.brightness / 100})`);
  parts.push(`contrast(${1 + adj.contrast / 100})`);
  parts.push(`saturate(${1 + adj.saturation / 100})`);
  if (adj.warmth > 0) parts.push(`sepia(${(adj.warmth / 100) * 0.4})`);
  if (adj.warmth < 0) parts.push(`hue-rotate(${adj.warmth * 0.15}deg)`);
  return parts.join(' ');
}

/** Crop rectangle (in rotated-source pixels) for the current state. */
export function getCropRect(rw: number, rh: number, state: EditState) {
  const aspect = state.aspect ?? rw / rh;
  let baseW = Math.min(rw, rh * aspect);
  let baseH = baseW / aspect;
  if (baseH > rh) {
    baseH = rh;
    baseW = baseH * aspect;
  }
  const zoom = Math.max(1, state.zoom);
  const cw = baseW / zoom;
  const ch = baseH / zoom;
  const slackX = rw - cw;
  const slackY = rh - ch;
  const x = clamp(rw / 2 - cw / 2 + state.offsetX * slackX, 0, slackX);
  const y = clamp(rh / 2 - ch / 2 + state.offsetY * slackY, 0, slackY);
  return { x, y, w: cw, h: ch };
}

function applySharpen(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  if (amount <= 0 || w < 3 || h < 3) return;
  const k = (amount / 100) * 1.2;
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const s = src.data;
  const d = out.data;
  const center = 1 + 4 * k;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; d[i + 3] = s[i + 3];
        continue;
      }
      for (let c = 0; c < 3; c++) {
        const v =
          center * s[i + c] -
          k * s[i - 4 + c] -
          k * s[i + 4 + c] -
          k * s[i - w * 4 + c] -
          k * s[i + w * 4 + c];
        d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      d[i + 3] = s[i + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

/**
 * Renders the edited image into `canvas`. `maxDim` caps the longest edge
 * (use a small value for preview, a large one for export).
 */
export function renderPhoto(
  canvas: HTMLCanvasElement,
  img: CanvasImageSource & { width: number; height: number },
  state: EditState,
  maxDim: number,
  frame: string = 'none',
) {
  const swap = state.rotate === 90 || state.rotate === 270;
  const iw = img.width;
  const ih = img.height;
  const rw = swap ? ih : iw;
  const rh = swap ? iw : ih;

  // 1. rotated + flipped intermediate
  const rot = document.createElement('canvas');
  rot.width = rw;
  rot.height = rh;
  const rctx = rot.getContext('2d')!;
  rctx.save();
  rctx.translate(rw / 2, rh / 2);
  rctx.rotate((state.rotate * Math.PI) / 180);
  rctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
  rctx.drawImage(img as CanvasImageSource, -iw / 2, -ih / 2, iw, ih);
  rctx.restore();

  // 2. crop -> output size
  const crop = getCropRect(rw, rh, state);
  const scale = Math.min(1, maxDim / Math.max(crop.w, crop.h));
  const outW = Math.max(1, Math.round(crop.w * scale));
  const outH = Math.max(1, Math.round(crop.h * scale));
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, outW, outH);

  const adj = state.adjustments;
  const preset = FILTER_PRESETS.find((f) => f.id === state.filter);
  const blurPx = (adj.blur / 100) * (Math.max(outW, outH) / 40);
  ctx.filter = `${buildCssFilter(adj, preset)}${blurPx > 0 ? ` blur(${blurPx.toFixed(2)}px)` : ''}`;
  ctx.drawImage(rot, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH);
  ctx.filter = 'none';

  // 3. preset wash
  if (preset?.overlay) {
    ctx.save();
    ctx.globalCompositeOperation = preset.overlay.blend;
    ctx.globalAlpha = preset.overlay.alpha;
    ctx.fillStyle = preset.overlay.color;
    ctx.fillRect(0, 0, outW, outH);
    ctx.restore();
  }

  // 4. warmth wash
  if (adj.warmth !== 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = Math.min(0.45, Math.abs(adj.warmth) / 180);
    ctx.fillStyle = adj.warmth > 0 ? '#ff9a3c' : '#4aa8ff';
    ctx.fillRect(0, 0, outW, outH);
    ctx.restore();
  }

  // 5. sharpen
  if (adj.sharpness > 0) applySharpen(ctx, outW, outH, adj.sharpness);

  // 6. vignette
  if (adj.vignette > 0) {
    const g = ctx.createRadialGradient(
      outW / 2, outH / 2, Math.min(outW, outH) * 0.25,
      outW / 2, outH / 2, Math.max(outW, outH) * 0.75,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${(adj.vignette / 100) * 0.85})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, outW, outH);
  }

  // 7. frame
  if (frame && frame !== 'none') {
    const t = Math.round(Math.max(outW, outH) * 0.035);
    ctx.save();
    if (frame === 'brand') {
      const grad = ctx.createLinearGradient(0, 0, outW, outH);
      grad.addColorStop(0, '#4f7cff');
      grad.addColorStop(1, '#a855f7');
      ctx.strokeStyle = grad;
    } else {
      ctx.strokeStyle = frame === 'black' ? '#000000' : '#ffffff';
    }
    ctx.lineWidth = t;
    ctx.strokeRect(t / 2, t / 2, outW - t, outH - t);
    ctx.restore();
  }

  return { width: outW, height: outH };
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this image'));
    };
    img.src = url;
  });
}

export function canvasToFile(canvas: HTMLCanvasElement, name: string, quality = 0.92): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Export failed'));
        const base = name.replace(/\.[^.]+$/, '');
        resolve(new File([blob], `${base}-edited.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      quality,
    );
  });
}
