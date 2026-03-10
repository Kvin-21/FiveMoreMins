import { useState, useEffect, useRef } from 'react';

interface VisibilityState {
  isHidden: boolean;
  awaySeconds: number;
  totalAwaySeconds: number;
}

// Custom hook to track tab visibility and time spent away
// Uses timestamps not intervals - accurate even when browser throttles timers
export function useVisibility(isSessionActive: boolean) {
  const [state, setState] = useState<VisibilityState>({
    isHidden: false,
    awaySeconds: 0,
    totalAwaySeconds: 0,
  });

  const hiddenAtRef = useRef<number | null>(null);
  const resetBaseRef = useRef<number | null>(null); // tracks when resetAway was called while still hidden
  const totalAwayRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isSessionActive) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab went hidden - record when
        hiddenAtRef.current = Date.now();
        resetBaseRef.current = null;
        setState(prev => ({ ...prev, isHidden: true, awaySeconds: 0 }));

        // Start updating away time every second
        intervalRef.current = setInterval(() => {
          if (hiddenAtRef.current) {
            const base = resetBaseRef.current ?? hiddenAtRef.current;
            const seconds = Math.floor((Date.now() - base) / 1000);
            setState(prev => ({ ...prev, awaySeconds: seconds }));
          }
        }, 1000);
      } else {
        // Tab came back - calculate actual time away
        if (hiddenAtRef.current) {
          const awayMs = Date.now() - hiddenAtRef.current;
          const awaySeconds = Math.floor(awayMs / 1000);
          totalAwayRef.current += awaySeconds;

          setState({
            isHidden: false,
            awaySeconds,
            totalAwaySeconds: totalAwayRef.current,
          });

          hiddenAtRef.current = null;
          resetBaseRef.current = null;
        }

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isSessionActive]);

  const resetAway = () => {
    // If still hidden, move the base forward so awaySeconds restarts from 0
    if (hiddenAtRef.current !== null) {
      resetBaseRef.current = Date.now();
    }
    setState(prev => ({ ...prev, awaySeconds: 0 }));
  };

  return { ...state, resetAway };
}