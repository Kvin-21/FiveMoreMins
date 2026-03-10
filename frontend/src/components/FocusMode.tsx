import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { startSession, endSession, triggerPenalty } from '../utils/api';
import { getRandomMessage, getNextTier } from '../utils/messages';
import WarningModal from './WarningModal';
import Toast from './Toast';

interface User {
  id: number;
  email: string;
  partner_email: string;
  image_path: string;
}

interface FocusModeProps {
  user: User | null;
}

type TimerState = 'idle' | 'running' | 'paused';

// The big scary timer component. This is where the magic (terror) happens.
export default function FocusMode({ user }: FocusModeProps) {
  const navigate = useNavigate();
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);

  // Warning modal state
  const [warningVisible, setWarningVisible] = useState(false);
  const [warningTier, setWarningTier] = useState<'mild' | 'medium' | 'aggressive'>('mild');
  const [warningMessage, setWarningMessage] = useState('');
  const [warningMinutes, setWarningMinutes] = useState(0);
  const [penaltySent, setPenaltySent] = useState(false);
  const [penaltyTriggered, setPenaltyTriggered] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  // Refs for timer accuracy (timestamps, not just counting intervals)
  const startTimeRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number>(0);
  const pauseStartRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakSecondsRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  // Track which warning tiers have already fired this session — each only shows once
  const shownTiersRef = useRef<Set<string>>(new Set());

  // Ref for the visible camera feed element — stream attaches here
  const displayVideoRef = useRef<HTMLVideoElement | null>(null);

  const sessionActive = timerState === 'running' || timerState === 'paused';
  const isPaused = timerState === 'paused';

  const {
    isDistracted,
    distractedSeconds,
    totalDistractedSeconds,
    cameraError,
    cameraReady,
    resetDistracted,
    stream,
  } = useFaceDetection(sessionActive, isPaused);

  // Attach the camera stream to the visible video element whenever it changes
  useEffect(() => {
    if (displayVideoRef.current && stream) {
      displayVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Also attach when the video element mounts (ref callback timing)
  const setDisplayVideoRef = useCallback((el: HTMLVideoElement | null) => {
    displayVideoRef.current = el;
    if (el && stream) {
      el.srcObject = stream;
    }
  }, [stream]);

  // Update elapsed time every second while running — using timestamps for accuracy
  useEffect(() => {
    if (timerState !== 'running') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const totalElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000) + pausedAtRef.current;
        elapsedRef.current = totalElapsed;
        setElapsed(totalElapsed);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerState]);

  // React to face detection — check against TOTAL distracted seconds, not just current window.
  // Each tier fires exactly once per session regardless of how many distraction events happen.
  useEffect(() => {
    if (timerState !== 'running') return;

    // totalDistractedSeconds accumulates across all distraction windows.
    // Add the currently-running window (distractedSeconds) for the real-time total.
    const runningTotal = totalDistractedSeconds + (isDistracted ? distractedSeconds : 0);
    if (runningTotal === 0) return;

    // Don't interrupt while a warning modal is already open
    if (warningVisible) return;

    const nextTier = getNextTier(runningTotal, shownTiersRef.current);
    if (!nextTier) return;

    // Mark this tier as shown so it never fires again this session
    shownTiersRef.current.add(nextTier);

    // Only trigger the penalty email for the aggressive tier
    if (nextTier === 'aggressive' && !penaltyTriggered) {
      setPenaltyTriggered(true);
      setPenaltySent(false);

      if (sessionId) {
        triggerPenalty(sessionId, Math.floor(runningTotal / 60))
          .then(() => setPenaltySent(true))
          .catch((err) => {
            console.error('Penalty email failed:', err);
            // Still show the modal even if email failed, but flag it
            setPenaltySent(false);
          });
      }
    }

    setWarningTier(nextTier);
    setWarningMessage(getRandomMessage(nextTier));
    setWarningMinutes(Math.floor(runningTotal / 60));
    setWarningVisible(true);
  }, [totalDistractedSeconds, distractedSeconds, isDistracted, timerState, warningVisible, penaltyTriggered, sessionId]);

  const handleStart = async () => {
    if (!user) {
      navigate('/setup');
      return;
    }

    try {
      const { session } = await startSession();
      setSessionId(session.id);
      startTimeRef.current = Date.now();
      pausedAtRef.current = 0;
      breakSecondsRef.current = 0;
      elapsedRef.current = 0;
      shownTiersRef.current = new Set();
      setElapsed(0);
      setBreakSeconds(0);
      setTimerState('running');
      setPenaltyTriggered(false);
      setPenaltySent(false);
    } catch (err) {
      setToast({ message: 'Failed to start session. Is the backend running?', type: 'error' });
    }
  };

  const handlePause = () => {
    if (timerState === 'running') {
      pausedAtRef.current = elapsedRef.current;
      pauseStartRef.current = Date.now();
      startTimeRef.current = null;
      setTimerState('paused');
    } else if (timerState === 'paused') {
      // Accumulate break time
      if (pauseStartRef.current) {
        const pausedFor = Math.floor((Date.now() - pauseStartRef.current) / 1000);
        breakSecondsRef.current += pausedFor;
        setBreakSeconds(breakSecondsRef.current);
        pauseStartRef.current = null;
      }
      startTimeRef.current = Date.now();
      setTimerState('running');
    }
  };

  const handleStop = useCallback(async (status: 'completed' | 'failed' = 'completed') => {
    if (!sessionId) return;

    setTimerState('idle');
    if (intervalRef.current) clearInterval(intervalRef.current);

    try {
      await endSession(sessionId, status, totalDistractedSeconds, elapsedRef.current, breakSecondsRef.current);
    } catch (err) {
      console.error('Failed to end session:', err);
    }

    setElapsed(0);
    setBreakSeconds(0);
    setSessionId(null);
    pausedAtRef.current = 0;
    pauseStartRef.current = null;
    startTimeRef.current = null;
    breakSecondsRef.current = 0;
    elapsedRef.current = 0;
    shownTiersRef.current = new Set();

    if (status === 'completed') {
      setToast({ message: '🔥 Session complete! You actually did it.', type: 'success' });
    }
  }, [sessionId, totalDistractedSeconds]);

  const handleDismissWarning = () => {
    setWarningVisible(false);
    // Don't call resetDistracted here — we want the total to keep accumulating correctly.
    // The per-window distractedSeconds resets naturally when focus is detected again.
  };

  // Format seconds as mm:ss or hh:mm:ss
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const maxSeconds = 60 * 60;
  const distractionMax = 30 * 60;
  const progress = isDistracted
    ? Math.min(distractedSeconds / distractionMax, 1)
    : Math.min(elapsed / maxSeconds, 1);
  const circumference = 2 * Math.PI * 140;
  const strokeDashoffset = circumference * (1 - progress);

  // Background color shifts from dark to danger red based on distraction time
  const dangerLevel = Math.min(totalDistractedSeconds / (30 * 60), 1);

  // Ring colour: red when distracted, green→orange→red when focused
  const ringColour = isDistracted
    ? '#ff3333'
    : progress > 0.8 ? '#ff3333' : progress > 0.5 ? '#ff6b35' : '#00ff88';

  // Focused time = elapsed minus total distracted, never negative
  const focusedTime = Math.max(0, elapsed - totalDistractedSeconds);

  return (
    <div
      className="focus-page"
      style={{
        background: `radial-gradient(ellipse at center, rgba(255, 51, 51, ${dangerLevel * 0.08}) 0%, #0a0a0a 70%)`,
      }}
    >
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {warningVisible && (
        <WarningModal
          tier={warningTier}
          message={warningMessage}
          awayMinutes={warningMinutes}
          partnerEmail={user?.partner_email}
          penaltySent={penaltySent}
          onDismiss={handleDismissWarning}
        />
      )}

      <div className="focus-header">
        <h2 className="focus-title">
          {timerState === 'idle' && 'Ready to Focus'}
          {timerState === 'running' && '🔥 Focus Session Active'}
          {timerState === 'paused' && '⏸ Paused'}
        </h2>
        {user && (
          <p className="focus-user">
            Logged in as <strong>{user.email}</strong>
            {user.partner_email && (
              <span className="focus-partner"> · Partner: <strong>{user.partner_email}</strong></span>
            )}
          </p>
        )}
      </div>

      {/* Camera feed + timer + side stats layout */}
      <div className="focus-main-row">

        {/* Left side stat: total elapsed */}
        {timerState !== 'idle' && (
          <div className="focus-side-stat focus-side-left">
            <span className="side-stat-label">ELAPSED</span>
            <span className="side-stat-value">{formatTime(elapsed)}</span>
            {breakSeconds > 0 && (
              <span className="side-stat-sub">☕ {formatTime(breakSeconds)} break</span>
            )}
          </div>
        )}

        {/* THE TIMER — shows distraction seconds when distracted, else elapsed */}
        <div className={`timer-container ${timerState === 'running' ? 'timer-active' : ''} ${isDistracted ? 'timer-distracted' : ''}`}>
          <svg className="timer-ring" viewBox="0 0 300 300">
            {/* Background ring */}
            <circle
              cx="150" cy="150" r="140"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="8"
            />
            {/* Progress ring */}
            <circle
              cx="150" cy="150" r="140"
              fill="none"
              stroke={ringColour}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 150 150)"
              style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
            />
          </svg>

          <div className="timer-display">
            <span className={`timer-time ${isDistracted ? 'timer-time-danger' : ''}`}>
              {isDistracted ? formatTime(distractedSeconds) : formatTime(elapsed)}
            </span>
            <span className="timer-label">
              {timerState === 'idle' && 'start when ready'}
              {timerState === 'running' && (isDistracted ? '📵 procrastinating' : 'focused')}
              {timerState === 'paused' && 'paused'}
            </span>
          </div>
        </div>

        {/* Right side stat: total focused (elapsed minus distracted) */}
        {timerState !== 'idle' && (
          <div className="focus-side-stat focus-side-right">
            <span className="side-stat-label">FOCUSED</span>
            <span className="side-stat-value side-stat-green">
              {formatTime(focusedTime)}
            </span>
            {totalDistractedSeconds > 0 && (
              <span className="side-stat-sub side-stat-red">📵 {formatTime(totalDistractedSeconds)} off</span>
            )}
          </div>
        )}
      </div>

      {/* Camera feed — always mounted once session starts so stream attaches correctly */}
      {timerState !== 'idle' && (
        <div className="camera-feed-wrapper">
          <video
            ref={setDisplayVideoRef}
            className="camera-feed-video"
            autoPlay
            playsInline
            muted
          />
          <div className={`camera-feed-status ${isDistracted ? 'feed-status-bad' : cameraReady ? 'feed-status-ok' : cameraError ? 'feed-status-err' : 'feed-status-loading'}`}>
            {!cameraReady && !cameraError && '📷 Starting camera...'}
            {cameraError && `⚠ ${cameraError}`}
            {cameraReady && !isDistracted && (timerState === 'paused' ? '⏸ Paused' : '✅ Focused')}
            {cameraReady && isDistracted && '📵 Procrastinating'}
          </div>
        </div>
      )}

      {/* Control buttons */}
      <div className="focus-controls">
        {timerState === 'idle' ? (
          <button className="btn-primary btn-large pulse-btn" onClick={handleStart}>
            Start Session
          </button>
        ) : (
          <>
            <button
              className={`btn-secondary btn-large ${timerState === 'paused' ? 'btn-resume' : ''}`}
              onClick={handlePause}
            >
              {timerState === 'running' ? '⏸ Pause' : '▶ Resume'}
            </button>
            <button
              className="btn-success btn-large"
              onClick={() => handleStop('completed')}
            >
              ✓ Complete
            </button>
          </>
        )}
      </div>

      {/* Danger zone indicator */}
      {timerState === 'running' && (
        <div className="danger-zone">
          <div className="danger-zone-label">PROCRASTINATION RISK</div>
          <div className="danger-bar">
            <div
              className="danger-fill"
              style={{ width: `${dangerLevel * 100}%` }}
            />
          </div>
          <div className="danger-note">
            {dangerLevel < 0.5 && '🟢 All good — keep it up'}
            {dangerLevel >= 0.5 && dangerLevel < 0.8 && '🟡 Put the phone down'}
            {dangerLevel >= 0.8 && '🔴 DANGER ZONE — blackmail photo is ready to deploy'}
          </div>
        </div>
      )}

      {/* Tip when idle */}
      {timerState === 'idle' && (
        <div className="focus-tips">
          <p>📷 Your webcam watches for phone use. Look down for <strong>5+ minutes</strong> and you'll get a warning.</p>
          <p>💀 Keep looking at your phone for <strong>30+ minutes</strong> and the blackmail gets sent.</p>
          {!user && (
            <p className="tip-cta">
              <a href="/setup">Set up your account first →</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}