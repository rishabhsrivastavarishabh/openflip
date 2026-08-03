import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, RotateCw, RotateCcw, FlipHorizontal, FlipVertical, Undo2, Redo2,
  Crop, Sliders, Sparkles, Frame as FrameIcon, Check, Loader2, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ASPECT_PRESETS, DEFAULT_ADJUSTMENTS, DEFAULT_EDIT_STATE, FILTER_PRESETS,
  FRAME_PRESETS, type Adjustments, type EditState,
  canvasToFile, getCropRect, loadImageFromFile, renderPhoto,
} from '@/lib/photoEditor';

interface PhotoEditorProps {
  file: File;
  open: boolean;
  onClose: () => void;
  onSave: (file: File) => void;
}

const ADJUSTMENTS: { key: keyof Adjustments; label: string; min: number; max: number }[] = [
  { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
  { key: 'warmth', label: 'Warmth', min: -100, max: 100 },
  { key: 'sharpness', label: 'Sharpness', min: 0, max: 100 },
  { key: 'blur', label: 'Blur', min: 0, max: 100 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 100 },
];

export function PhotoEditor({ file, open, onClose, onSave }: PhotoEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const thumbRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const frameReq = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [frame, setFrame] = useState('none');
  const [state, setState] = useState<EditState>({ ...DEFAULT_EDIT_STATE, adjustments: { ...DEFAULT_ADJUSTMENTS } });
  const [history, setHistory] = useState<{ state: EditState; frame: string }[]>([]);
  const [cursor, setCursor] = useState(0);

  // Load source image
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReady(false);
    loadImageFromFile(file)
      .then((img) => {
        if (cancelled) return;
        imgRef.current = img;
        // Small thumbnail source for the filter strip
        const t = document.createElement('canvas');
        const s = Math.min(1, 160 / Math.max(img.width, img.height));
        t.width = Math.max(1, Math.round(img.width * s));
        t.height = Math.max(1, Math.round(img.height * s));
        t.getContext('2d')!.drawImage(img, 0, 0, t.width, t.height);
        thumbRef.current = t;
        const initial = { ...DEFAULT_EDIT_STATE, aspect: 1, adjustments: { ...DEFAULT_ADJUSTMENTS } };
        setState(initial);
        setFrame('none');
        setHistory([{ state: initial, frame: 'none' }]);
        setCursor(0);
        setReady(true);
      })
      .catch(() => toast.error('Could not open this image'));
    return () => { cancelled = true; };
  }, [file, open]);

  // Preview render loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    renderPhoto(canvas, img, state, Math.round(900 * dpr), frame);
  }, [state, frame]);

  useEffect(() => {
    if (!ready) return;
    if (frameReq.current) cancelAnimationFrame(frameReq.current);
    frameReq.current = requestAnimationFrame(draw);
    return () => { if (frameReq.current) cancelAnimationFrame(frameReq.current); };
  }, [draw, ready]);

  const commit = useCallback((next: EditState, nextFrame?: string) => {
    const f = nextFrame ?? frame;
    setHistory((h) => [...h.slice(0, cursor + 1), { state: next, frame: f }].slice(-40));
    setCursor((c) => Math.min(c + 1, 39));
  }, [cursor, frame]);

  const update = (patch: Partial<EditState>, withCommit = true) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      if (withCommit) commit(next);
      return next;
    });
  };

  const updateAdjustment = (key: keyof Adjustments, value: number, withCommit = false) => {
    setState((prev) => {
      const next = { ...prev, adjustments: { ...prev.adjustments, [key]: value } };
      if (withCommit) commit(next);
      return next;
    });
  };

  const undo = () => {
    if (cursor <= 0) return;
    const entry = history[cursor - 1];
    setCursor(cursor - 1);
    setState(entry.state);
    setFrame(entry.frame);
  };

  const redo = () => {
    if (cursor >= history.length - 1) return;
    const entry = history[cursor + 1];
    setCursor(cursor + 1);
    setState(entry.state);
    setFrame(entry.frame);
  };

  const reset = () => {
    const initial = { ...DEFAULT_EDIT_STATE, aspect: 1, adjustments: { ...DEFAULT_ADJUSTMENTS } };
    setState(initial);
    setFrame('none');
    commit(initial, 'none');
  };

  // Pan by dragging the canvas
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const start = dragRef.current;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!start || !img || !canvas) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!dx && !dy) return;
    dragRef.current = { x: e.clientX, y: e.clientY };
    const swap = state.rotate === 90 || state.rotate === 270;
    const rw = swap ? img.height : img.width;
    const rh = swap ? img.width : img.height;
    const crop = getCropRect(rw, rh, state);
    const rect = canvas.getBoundingClientRect();
    const slackX = rw - crop.w;
    const slackY = rh - crop.h;
    setState((prev) => ({
      ...prev,
      offsetX: slackX > 0 ? Math.max(-0.5, Math.min(0.5, prev.offsetX - (dx * (crop.w / rect.width)) / slackX)) : 0,
      offsetY: slackY > 0 ? Math.max(-0.5, Math.min(0.5, prev.offsetY - (dy * (crop.h / rect.height)) / slackY)) : 0,
    }));
  };
  const onPointerUp = () => {
    if (dragRef.current) {
      dragRef.current = null;
      setState((prev) => { commit(prev); return prev; });
    }
  };

  const handleSave = async () => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    setSaving(true);
    try {
      const out = document.createElement('canvas');
      renderPhoto(out, img, state, 2560, frame);
      const edited = await canvasToFile(out, file.name);
      onSave(edited);
    } catch {
      toast.error('Could not export the edited photo');
    } finally {
      setSaving(false);
    }
  };

  const filterThumbs = useMemo(() => FILTER_PRESETS, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close editor">
          <X className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={undo} disabled={cursor <= 0} aria-label="Undo">
            <Undo2 className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={redo} disabled={cursor >= history.length - 1} aria-label="Redo">
            <Redo2 className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={reset} aria-label="Reset edits">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="gradient" size="sm" onClick={handleSave} disabled={!ready || saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
          Done
        </Button>
      </header>

      {/* Preview */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-black/90 p-3 overflow-hidden">
        {!ready ? (
          <Loader2 className="w-8 h-8 animate-spin text-white/70" />
        ) : (
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="max-w-full max-h-full object-contain touch-none cursor-grab active:cursor-grabbing rounded-lg"
          />
        )}
      </div>

      {/* Controls */}
      <Tabs defaultValue="filters" className="border-t border-border bg-background">
        <TabsList className="grid grid-cols-4 w-full rounded-none h-12 bg-transparent">
          <TabsTrigger value="filters"><Sparkles className="w-4 h-4 mr-1.5" />Filters</TabsTrigger>
          <TabsTrigger value="adjust"><Sliders className="w-4 h-4 mr-1.5" />Adjust</TabsTrigger>
          <TabsTrigger value="crop"><Crop className="w-4 h-4 mr-1.5" />Crop</TabsTrigger>
          <TabsTrigger value="frame"><FrameIcon className="w-4 h-4 mr-1.5" />Frame</TabsTrigger>
        </TabsList>

        <div className="max-h-[38vh] overflow-y-auto">
          <TabsContent value="filters" className="m-0 p-3">
            <div className="flex gap-3 overflow-x-auto pb-1">
              {filterThumbs.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => update({ filter: preset.id })}
                  className="flex-shrink-0 text-center"
                >
                  <div className={cn(
                    'w-16 h-16 rounded-xl overflow-hidden border-2 bg-muted',
                    state.filter === preset.id ? 'border-primary' : 'border-transparent',
                  )}>
                    <FilterThumb source={thumbRef.current} presetId={preset.id} />
                  </div>
                  <span className={cn(
                    'block mt-1 text-[11px]',
                    state.filter === preset.id ? 'text-primary font-medium' : 'text-muted-foreground',
                  )}>{preset.label}</span>
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="adjust" className="m-0 p-4 space-y-4">
            {ADJUSTMENTS.map(({ key, label, min, max }) => (
              <div key={key}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium tabular-nums">{state.adjustments[key]}</span>
                </div>
                <Slider
                  value={[state.adjustments[key]]}
                  min={min}
                  max={max}
                  step={1}
                  onValueChange={(v) => updateAdjustment(key, v[0])}
                  onValueCommit={(v) => updateAdjustment(key, v[0], true)}
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="crop" className="m-0 p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {ASPECT_PRESETS.map((a) => (
                <Button
                  key={a.id}
                  size="sm"
                  variant={state.aspect === a.value ? 'gradient' : 'outline'}
                  onClick={() => update({ aspect: a.value, offsetX: 0, offsetY: 0 })}
                >
                  {a.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => update({ rotate: (((state.rotate + 270) % 360) as EditState['rotate']) })}>
                <RotateCcw className="w-4 h-4 mr-1.5" />Left
              </Button>
              <Button size="sm" variant="outline" onClick={() => update({ rotate: (((state.rotate + 90) % 360) as EditState['rotate']) })}>
                <RotateCw className="w-4 h-4 mr-1.5" />Right
              </Button>
              <Button size="sm" variant={state.flipH ? 'gradient' : 'outline'} onClick={() => update({ flipH: !state.flipH })}>
                <FlipHorizontal className="w-4 h-4" />
              </Button>
              <Button size="sm" variant={state.flipV ? 'gradient' : 'outline'} onClick={() => update({ flipV: !state.flipV })}>
                <FlipVertical className="w-4 h-4" />
              </Button>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Zoom</span>
                <span className="font-medium tabular-nums">{state.zoom.toFixed(1)}x</span>
              </div>
              <Slider
                value={[state.zoom]}
                min={1}
                max={4}
                step={0.05}
                onValueChange={(v) => setState((p) => ({ ...p, zoom: v[0] }))}
                onValueCommit={(v) => update({ zoom: v[0] })}
              />
              <p className="text-[11px] text-muted-foreground mt-2">Drag the photo to reposition it inside the crop.</p>
            </div>
          </TabsContent>

          <TabsContent value="frame" className="m-0 p-4">
            <div className="flex flex-wrap gap-2">
              {FRAME_PRESETS.map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  variant={frame === f.id ? 'gradient' : 'outline'}
                  onClick={() => { setFrame(f.id); commit(state, f.id); }}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

/** Tiny preview of a single filter preset, drawn from a cached thumbnail. */
function FilterThumb({ source, presetId }: { source: HTMLCanvasElement | null; presetId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !source) return;
    renderPhoto(
      canvas,
      source as unknown as CanvasImageSource & { width: number; height: number },
      { ...DEFAULT_EDIT_STATE, aspect: 1, filter: presetId, adjustments: { ...DEFAULT_ADJUSTMENTS } },
      128,
      'none',
    );
  }, [source, presetId]);
  return <canvas ref={ref} className="w-full h-full object-cover" />;
}
