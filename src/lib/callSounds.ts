// Shared WebAudio patterns for calls, incoming ringtones, caller tunes,
// and message notification sounds. All tones are synthesized in-browser so
// no audio assets need shipping.

export type ToneStep = { freq: number; dur: number; type?: OscillatorType; gain?: number };
export type TonePattern = { steps: ToneStep[]; gap: number };

export const RINGTONES: Record<string, TonePattern> = {
  default: { steps: [{ freq: 440, dur: 0.9 }, { freq: 480, dur: 0.9 }], gap: 600 },
  chime:   { steps: [{ freq: 660, dur: 0.22 }, { freq: 880, dur: 0.22 }, { freq: 990, dur: 0.22 }], gap: 900 },
  ding:    { steps: [{ freq: 1200, dur: 0.18, type: 'triangle' }], gap: 900 },
  pop:     { steps: [{ freq: 520, dur: 0.09, type: 'square' }, { freq: 380, dur: 0.09, type: 'square' }], gap: 260 },
  swoosh:  { steps: [{ freq: 300, dur: 0.09, type: 'sawtooth' }, { freq: 500, dur: 0.09, type: 'sawtooth' }, { freq: 700, dur: 0.09, type: 'sawtooth' }, { freq: 900, dur: 0.09, type: 'sawtooth' }], gap: 400 },
  classic: { steps: [{ freq: 350, dur: 1.0 }, { freq: 440, dur: 1.0 }], gap: 2000 },
  none:    { steps: [], gap: 1000 },
};

export const CALLER_TUNES: Record<string, TonePattern> = {
  default: { steps: [{ freq: 350, dur: 1.5 }, { freq: 440, dur: 1.5 }], gap: 3000 }, // classic dial-tone
  soft:    { steps: [{ freq: 523, dur: 0.35, type: 'sine' }, { freq: 659, dur: 0.35, type: 'sine' }, { freq: 784, dur: 0.6, type: 'sine' }], gap: 1400 },
  uplift:  { steps: [{ freq: 523, dur: 0.2 }, { freq: 659, dur: 0.2 }, { freq: 784, dur: 0.2 }, { freq: 1046, dur: 0.4 }], gap: 1200 },
  retro:   { steps: [{ freq: 440, dur: 0.15, type: 'square' }, { freq: 0, dur: 0.05 }, { freq: 440, dur: 0.15, type: 'square' }], gap: 800 },
  lofi:    { steps: [{ freq: 220, dur: 0.6, type: 'triangle' }, { freq: 262, dur: 0.6, type: 'triangle' }, { freq: 330, dur: 0.6, type: 'triangle' }], gap: 1600 },
  silent:  { steps: [], gap: 1000 },
};

export const MESSAGE_TONES: Record<string, TonePattern> = {
  chime:   { steps: [{ freq: 880, dur: 0.12 }, { freq: 1175, dur: 0.14 }], gap: 0 },
  ding:    { steps: [{ freq: 1400, dur: 0.16, type: 'triangle' }], gap: 0 },
  pop:     { steps: [{ freq: 620, dur: 0.06, type: 'square' }, { freq: 480, dur: 0.06, type: 'square' }], gap: 0 },
  bubble:  { steps: [{ freq: 500, dur: 0.05, type: 'sine' }, { freq: 700, dur: 0.05, type: 'sine' }, { freq: 900, dur: 0.05, type: 'sine' }], gap: 0 },
  soft:    { steps: [{ freq: 660, dur: 0.2, type: 'sine' }], gap: 0 },
  none:    { steps: [], gap: 0 },
};

export type ToneHandle = { stop: () => void };

/** Play a pattern once (or on loop) via WebAudio. Returns a stop handle. */
export function playPattern(
  pattern: TonePattern | undefined,
  opts?: { loop?: boolean; volume?: number },
): ToneHandle {
  const noop: ToneHandle = { stop: () => {} };
  if (!pattern || pattern.steps.length === 0) return noop;

  const AudioCtx =
    (typeof window !== 'undefined' && ((window as any).AudioContext || (window as any).webkitAudioContext)) || null;
  if (!AudioCtx) return noop;

  const ctx: AudioContext = new AudioCtx();
  ctx.resume().catch(() => {});

  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const volume = Math.max(0, Math.min(1, opts?.volume ?? 0.2));

  const runOnce = (onDone: () => void) => {
    if (cancelled) return;
    let elapsedMs = 0;
    pattern.steps.forEach((step) => {
      const start = elapsedMs / 1000;
      const t = setTimeout(() => {
        if (cancelled || ctx.state === 'closed') return;
        if (step.freq <= 0) return; // silent gap step
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = step.type ?? 'sine';
        osc.frequency.value = step.freq;
        const now = ctx.currentTime;
        gain.gain.value = 0.0001;
        gain.gain.exponentialRampToValueAtTime((step.gain ?? volume), now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + step.dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + step.dur + 0.03);
      }, elapsedMs);
      timers.push(t);
      elapsedMs += step.dur * 1000;
    });
    const done = setTimeout(onDone, elapsedMs + pattern.gap);
    timers.push(done);
  };

  const loop = () => {
    if (cancelled) return;
    runOnce(() => {
      if (opts?.loop && !cancelled) loop();
    });
  };
  loop();

  return {
    stop: () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      ctx.close().catch(() => {});
    },
  };
}
