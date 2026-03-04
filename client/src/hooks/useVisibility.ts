import { useCallback, useEffect, useRef, useState } from 'react';

interface VisibilityState {
  isVisible: boolean;
  awayDuration: number; // ms since the tab was last hidden
  resetAway: () => void;
}

export function useVisibility(): VisibilityState {
  const [isVisible, setIsVisible] = useState(!document.hidden);
  const [awayDuration, setAwayDuration] = useState(0);
  // When the user left (ms timestamp). null = currently visible.
  const awayStartRef = useRef<number | null>(null);

  const handleHide = useCallback(() => {
    if (awayStartRef.current === null) {
      awayStartRef.current = Date.now();
    }
    setIsVisible(false);
  }, []);

  const handleShow = useCallback(() => {
    if (awayStartRef.current !== null) {
      const duration = Date.now() - awayStartRef.current;
      setAwayDuration(duration);
      awayStartRef.current = null;
    }
    setIsVisible(true);
  }, []);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) {
        handleHide();
      } else {
        handleShow();
      }
    }

    // visibilitychange covers tab switches and minimising the window in most browsers.
    // blur/focus catches things like switching apps on desktop that visibilitychange misses.
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', handleHide);
    window.addEventListener('focus', handleShow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', handleHide);
      window.removeEventListener('focus', handleShow);
    };
  }, [handleHide, handleShow]);

  const resetAway = useCallback(() => {
    setAwayDuration(0);
    awayStartRef.current = null;
  }, []);

  return { isVisible, awayDuration, resetAway };
}
