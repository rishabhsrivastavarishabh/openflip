import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * RunningCat — a whimsical, lightweight running-cat easter egg that sprints
 * across the bottom of the screen. It triggers once shortly after mount and
 * can be re-triggered by clicking the tiny paw indicator.
 */
export function RunningCat() {
  const [running, setRunning] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const initial = setTimeout(() => setRunning(true), 1200);
    return () => clearTimeout(initial);
  }, []);

  const handleRunAgain = () => {
    setRunning(false);
    // Force reflow so the animation restarts cleanly
    requestAnimationFrame(() => {
      setRunning(true);
    });
  };

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[60] pointer-events-none',
        !visible && 'hidden'
      )}
      aria-hidden="true"
    >
      {/* Track / ground line */}
      <div className="absolute bottom-20 md:bottom-6 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      {/* Running cat sprite */}
      <div
        className={cn(
          'absolute bottom-16 md:bottom-4 left-0 will-change-transform',
          running ? 'running-cat' : 'opacity-0'
        )}
        onAnimationEnd={() => setRunning(false)}
      >
        <div className="cat-bounce">
          <svg
            width="56"
            height="40"
            viewBox="0 0 56 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-md"
          >
            {/* Body */}
            <ellipse cx="28" cy="22" rx="16" ry="10" className="fill-primary" />
            {/* Head */}
            <circle cx="14" cy="16" r="8" className="fill-primary" />
            {/* Ears */}
            <polygon points="8,10 12,2 16,10" className="fill-primary" />
            <polygon points="14,10 20,2 22,10" className="fill-primary" />
            {/* Tail */}
            <path
              d="M42 22 C50 18, 54 10, 52 4"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="text-primary cat-tail"
            />
            {/* Front legs */}
            <path d="M22 28 L18 36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary cat-leg front-left" />
            <path d="M24 28 L26 36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary cat-leg front-right" />
            {/* Back legs */}
            <path d="M34 28 L30 36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary cat-leg back-left" />
            <path d="M36 28 L40 36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary cat-leg back-right" />
          </svg>
        </div>
      </div>

      {/* Paw-print trail */}
      <div className={cn('paw-trail', running && 'paw-trail-running')}>
        <span>🐾</span>
        <span>🐾</span>
        <span>🐾</span>
        <span>🐾</span>
      </div>

      {/* Re-trigger button (tiny, bottom-right) */}
      <button
        type="button"
        onClick={handleRunAgain}
        className="pointer-events-auto absolute bottom-2 right-4 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 text-xs text-muted-foreground hover:text-primary hover:scale-110 transition-all shadow-sm"
        title="Run the cat again"
      >
        🐾
      </button>

      <style>{`
        @keyframes runAcross {
          0% {
            transform: translateX(-4rem);
          }
          100% {
            transform: translateX(calc(100vw + 4rem));
          }
        }

        @keyframes catBounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-4px) rotate(-2deg); }
          50% { transform: translateY(0) rotate(0deg); }
          75% { transform: translateY(-3px) rotate(2deg); }
        }

        @keyframes legSwing {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(20deg); }
        }

        @keyframes tailWag {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(12deg); }
        }

        @keyframes pawFade {
          0% { opacity: 0; transform: translateY(2px) scale(0.6); }
          20% { opacity: 0.8; }
          80% { opacity: 0.4; }
          100% { opacity: 0; transform: translateY(-2px) scale(0.4); }
        }

        .running-cat {
          animation: runAcross 4.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .cat-bounce {
          animation: catBounce 0.35s ease-in-out infinite;
        }

        .cat-leg {
          transform-origin: top center;
          animation: legSwing 0.18s ease-in-out infinite alternate;
        }

        .cat-leg.front-right { animation-delay: 0.05s; }
        .cat-leg.back-left { animation-delay: 0.1s; }
        .cat-leg.back-right { animation-delay: 0.15s; }

        .cat-tail {
          transform-origin: left center;
          animation: tailWag 0.5s ease-in-out infinite;
        }

        .paw-trail {
          position: absolute;
          bottom: 55px;
          left: 0;
          display: flex;
          gap: 2.5rem;
          opacity: 0;
        }

        @media (min-width: 768px) {
          .paw-trail {
            bottom: 3px;
          }
        }

        .paw-trail-running {
          animation: runAcross 4.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .paw-trail span {
          opacity: 0;
          font-size: 0.75rem;
          animation: pawFade 0.6s ease-out forwards;
        }

        .paw-trail-running span:nth-child(1) { animation-delay: 0.4s; }
        .paw-trail-running span:nth-child(2) { animation-delay: 1.1s; }
        .paw-trail-running span:nth-child(3) { animation-delay: 1.9s; }
        .paw-trail-running span:nth-child(4) { animation-delay: 2.6s; }
      `}</style>
    </div>
  );
}
