import { useCallback, useEffect, useRef, useState } from 'react';

interface TimerState {
  elapsed: number; // seconds
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  stop: () => void;
  reset: () => void;
}

export function useTimer(): TimerState {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear the interval helper so we don't sprinkle this everywhere
  function clearTick() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      clearTick();
    }

    return clearTick;
  }, [isRunning]);

  // Cleanup on unmount so we don't leak timers
  useEffect(() => {
    return clearTick;
  }, []);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);

  const stop = useCallback(() => {
    setIsRunning(false);
    // Don't reset elapsed here — caller decides what to do with the final value
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setElapsed(0);
  }, []);

  return { elapsed, isRunning, start, pause, stop, reset };
}
