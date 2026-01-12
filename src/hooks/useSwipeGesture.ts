import { useCallback, useRef } from 'react';

interface SwipeGestureOptions {
  onSwipeDown?: () => void;
  onSwipeUp?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export function useSwipeGesture({
  onSwipeDown,
  onSwipeUp,
  onSwipeLeft,
  onSwipeRight,
  threshold = 100,
}: SwipeGestureOptions) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent | TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (!touchStart.current) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;

    dragOffset.current = {
      x: currentX - touchStart.current.x,
      y: currentY - touchStart.current.y,
    };
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart.current) return;

    const { x, y } = dragOffset.current;

    // Determine primary direction
    if (Math.abs(y) > Math.abs(x)) {
      // Vertical swipe
      if (y > threshold && onSwipeDown) {
        onSwipeDown();
      } else if (y < -threshold && onSwipeUp) {
        onSwipeUp();
      }
    } else {
      // Horizontal swipe
      if (x > threshold && onSwipeRight) {
        onSwipeRight();
      } else if (x < -threshold && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    touchStart.current = null;
    dragOffset.current = { x: 0, y: 0 };
  }, [threshold, onSwipeDown, onSwipeUp, onSwipeLeft, onSwipeRight]);

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    dragOffset,
  };
}
