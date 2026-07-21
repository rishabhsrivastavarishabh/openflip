import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * RunningCat — a whimsical, lightweight running-cat easter egg.
 * Renders two cats: one sprinting across the top of the viewport
 * and one across the bottom, each with an expressive face.
 */
function CatSprite() {
  return (
    <svg
      width="64"
      height="46"
      viewBox="0 0 64 46"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-md"
    >
      {/* Tail */}
      <path
        d="M46 24 C54 20, 58 12, 56 4"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="text-primary cat-tail"
        fill="none"
      />
      {/* Body */}
      <ellipse cx="32" cy="26" rx="17" ry="10" className="fill-primary" />
      {/* Back legs */}
      <path d="M38 32 L34 42" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary cat-leg back-left" />
      <path d="M40 32 L44 42" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary cat-leg back-right" />
      {/* Front legs */}
      <path d="M24 32 L20 42" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary cat-leg front-left" />
      <path d="M26 32 L28 42" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary cat-leg front-right" />
      {/* Head */}
      <circle cx="16" cy="18" r="9" className="fill-primary" />
      {/* Ears */}
      <polygon points="8,12 11,3 16,11" className="fill-primary" />
      <polygon points="16,11 21,3 24,12" className="fill-primary" />
      {/* Inner ears */}
      <polygon points="10,10 12,5 14,10" className="fill-background/60" />
      <polygon points="18,10 20,5 22,10" className="fill-background/60" />
      {/* Face — eyes */}
      <circle cx="12.5" cy="17" r="1.4" className="fill-background" />
      <circle cx="19.5" cy="17" r="1.4" className="fill-background" />
      <circle cx="12.7" cy="17.3" r="0.6" fill="#111" />
      <circle cx="19.7" cy="17.3" r="0.6" fill="#111" />
      {/* Nose */}
      <path d="M15.2 20.2 L16.8 20.2 L16 21.4 Z" className="fill-background" />
      {/* Mouth */}
      <path d="M16 21.4 Q14.8 22.8 13.8 22" stroke="hsl(var(--background))" strokeWidth="0.7" strokeLinecap="round" fill="none" />
      <path d="M16 21.4 Q17.2 22.8 18.2 22" stroke="hsl(var(--background))" strokeWidth="0.7" strokeLinecap="round" fill="none" />
      {/* Whiskers */}
      <line x1="5" y1="19" x2="11" y2="19.5" stroke="hsl(var(--background))" strokeWidth="0.5" strokeLinecap="round" />
      <line x1="5" y1="21" x2="11" y2="20.5" stroke="hsl(var(--background))" strokeWidth="0.5" strokeLinecap="round" />
      <line x1="21" y1="19.5" x2="27" y2="19" stroke="hsl(var(--background))" strokeWidth="0.5" strokeLinecap="round" />
      <line x1="21" y1="20.5" x2="27" y2="21" stroke="hsl(var(--background))" strokeWidth="0.5" strokeLinecap="round" />
    </svg>
  );
}

interface CatLaneProps {
  position: 'top' | 'bottom';
  running: boolean;
  onEnd: () => void;
}

function CatLane({ position, running, onEnd }: CatLaneProps) {
  const posClass =
    position === 'top'
      ? 'top-2 md:top-3'
      : 'bottom-16 md:bottom-4';
  const trailPosClass =
    position === 'top'
      ? 'top-12 md:top-14'
      : 'bottom-14 md:bottom-2';
  return (
    <>
      <div
        className={cn(
          'absolute left-0 will-change-transform',
          posClass,
          running ? 'running-cat' : 'opacity-0'
        )}
        onAnimationEnd={onEnd}
        style={position === 'top' ? { transform: 'scaleX(-1)' } : undefined}
      >
        <div className="cat-bounce">
          <CatSprite />
        </div>
      </div>
      <div className={cn('paw-trail absolute left-0', trailPosClass, running && 'paw-trail-running')}>
        <span>🐾</span>
        <span>🐾</span>
        <span>🐾</span>
        <span>🐾</span>
      </div>
    </>
  );
}

export function RunningCat() {
  const [running, setRunning] = useState(false);
  const [visible] = useState(true);

  useEffect(() => {
    const initial = setTimeout(() => setRunning(true), 1200);
    return () => clearTimeout(initial);
  }, []);

  const handleRunAgain = () => {
    setRunning(false);
    requestAnimationFrame(() => setRunning(true));
  };

  return (
    <div
      className={cn('fixed inset-0 z-[60] pointer-events-none', !visible && 'hidden')}
      aria-hidden="true"
    >
      <CatLane position="top" running={running} onEnd={() => setRunning(false)} />
      <CatLane position="bottom" running={running} onEnd={() => setRunning(false)} />

      <button
        type="button"
        onClick={handleRunAgain}
        className="pointer-events-auto absolute bottom-20 md:bottom-2 right-4 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 text-xs text-muted-foreground hover:text-primary hover:scale-110 transition-all shadow-sm"
        title="Run the cat again"
      >
        🐾
      </button>

      <style>{`
        @keyframes runAcross {
          0% { transform: translateX(-5rem); }
          100% { transform: translateX(calc(100vw + 5rem)); }
        }
        @keyframes catBounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-4px) rotate(-2deg); }
          50% { transform: translateY(0) rotate(0deg); }
          75% { transform: translateY(-3px) rotate(2deg); }
        }
        @keyframes legSwing {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(22deg); }
        }
        @keyframes tailWag {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(14deg); }
        }
        @keyframes pawFade {
          0% { opacity: 0; transform: translateY(2px) scale(0.6); }
          20% { opacity: 0.8; }
          80% { opacity: 0.4; }
          100% { opacity: 0; transform: translateY(-2px) scale(0.4); }
        }
        .running-cat { animation: runAcross 4.6s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        .cat-bounce { animation: catBounce 0.35s ease-in-out infinite; }
        .cat-leg { transform-origin: top center; animation: legSwing 0.18s ease-in-out infinite alternate; }
        .cat-leg.front-right { animation-delay: 0.05s; }
        .cat-leg.back-left { animation-delay: 0.1s; }
        .cat-leg.back-right { animation-delay: 0.15s; }
        .cat-tail { transform-origin: left center; animation: tailWag 0.5s ease-in-out infinite; }
        .paw-trail { display: flex; gap: 2.5rem; opacity: 0; }
        .paw-trail-running { animation: runAcross 4.6s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        .paw-trail span { opacity: 0; font-size: 0.75rem; animation: pawFade 0.6s ease-out forwards; }
        .paw-trail-running span:nth-child(1) { animation-delay: 0.4s; }
        .paw-trail-running span:nth-child(2) { animation-delay: 1.2s; }
        .paw-trail-running span:nth-child(3) { animation-delay: 2.0s; }
        .paw-trail-running span:nth-child(4) { animation-delay: 2.8s; }
      `}</style>
    </div>
  );
}
