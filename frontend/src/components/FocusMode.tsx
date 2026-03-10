import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { startSession, endSession, triggerPenalty } from '../utils/api';
import { getRandomMessage, getTier } from '../utils/messages';
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
  const [elapsed, setElapsed] = useState(0); // total focus seconds
  const [breakSeconds, setBreakSeconds] = useState(0); // total paused seconds this session
  const [sessionId, setSessionId] = useState<number | null>(null);

  // Warning modal state
  const [warningVisible, setWarningVisible] = useState(false);
  const [warningTier, setWarningTier] = useState<'mild' | 'medium' | 'aggressive'>('mild');
  const [warningMessage, setWarningMessage] = useState('');
  const [warningMinutes, setWarningMinutes] = useState(0);
  const [penaltySent, setPenaltySent] = useState(false);
  const [penaltyTriggered, setPenaltyTriggered] = useState(false); // one per session

  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  // Refs for timer accuracy (timestamps, not just counting intervals)
  const startTimeRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number>(0);
  const pauseStartRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalDistractedAccumRef = useRef<number>(0);

  // Ref for the visible camera feed element
  const displayVideoRef = useRef<HTMLVideoElement | null>(null);

  const isActive = timerState === 'running';
  const {
    isDistracted,
    distractedSeconds,
    totalDistractedSeconds,
    cameraError,
    cameraReady,
    resetDistracted,
    startCamera,
    stopCamera,
  } = useFaceDetection(isActive);

  // Update elapsed time every second while running
  useEffect(() => {
    if (timerState !== 'running') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const totalElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000) + pausedAtRef.current;
        setElapsed(totalElapsed);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerState]);

  // Sync total distracted seconds from hook into ref for use in session end
  useEffect(() => {
    totalDistractedAccumRef.current = totalDistractedSeconds;
  }, [totalDistractedSeconds]);

  // React to face detection distraction events
  useEffect(() => {
    if (!isActive || distractedSeconds === 0) return;

    const tier = getTier(distractedSeconds);
    if (!tier) return;

    // Don't trigger another warning while one is already showing
    if (warningVisible) return;

    // Only trigger penalty once per session
    const shouldTriggerPenalty = tier === 'aggressive' && !penaltyTriggered;

    if (shouldTriggerPenalty) {
      setPenaltyTriggered(true);
      setPenaltySent(false);

      if (sessionId) {
        triggerPenalty(sessionId, Math.floor(distractedSeconds / 60))
          .then(() => setPenaltySent(true))
          .catch(() => setPenaltySent(true)); // show sent even if failed (dev mode)
      }
    }

    setWarningTier(tier);
    setWarningMessage(getRandomMessage(tier));
    setWarningMinutes(Math.floor(distractedSeconds / 60));
    setWarningVisible(true);
  }, [distractedSeconds, isActive, warningVisible, penaltyTriggered, sessionId]);

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
      totalDistractedAccumRef.current = 0;
      setElapsed(0);
      setBreakSeconds(0);
      setTimerState('running');
      setPenaltyTriggered(false);
      // Start camera and pipe the stream into the visible video element
      startCamera(displayVideoRef.current);
    } catch (err) {
      setToast({ message: 'Failed to start session. Is the backend running?', type: 'error' });
    }
  };

  const handlePause = () => {
    if (timerState === 'running') {
      pausedAtRef.current = elapsed;
      pauseStartRef.current = Date.now();
      startTimeRef.current = null;
      setTimerState('paused');
    } else if (timerState === 'paused') {
      // Accumulate break time
      if (pauseStartRef.current) {
        const pausedFor = Math.floor((Date.now() - pauseStartRef.current) / 1000);
        setBreakSeconds(prev => prev + pausedFor);
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
    stopCamera();

    try {
      await endSession(sessionId, status, totalDistractedAccumRef.current, elapsed);
    } catch (err) {
      console.error('Failed to end session:', err);
    }

    setElapsed(0);
    setBreakSeconds(0);
    setSessionId(null);
    pausedAtRef.current = 0;
    pauseStartRef.current = null;
    startTimeRef.current = null;
    totalDistractedAccumRef.current = 0;

    if (status === 'completed') {
      setToast({ message: '🔥 Session complete! You actually did it.', type: 'success' });
    }
  }, [sessionId, elapsed, stopCamera]);

  const handleDismissWarning = () => {
    setWarningVisible(false);
    resetDistracted();
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

  // Circular progress - fills up over 60 minutes (one full session goal)
  // When distracted, the ring shows distraction progress instead
  const maxSeconds = 60 * 60;
  const distractionMax = 30 * 60; // 30min distracted = full ring in distraction mode
  const progress = isDistracted
    ? Math.min(distractedSeconds / distractionMax, 1)
    : Math.min(elapsed / maxSeconds, 1);
  const circumference = 2 * Math.PI * 140;
  const strokeDashoffset = circumference * (1 - progress);

  // Background color shifts from dark to danger red based on distraction time, not focus time
  const dangerLevel = Math.min(totalDistractedSeconds / (30 * 60), 1); // 30min distracted = max danger

  // Ring colour: red when distracted, green→orange→red when focused based on time
  const ringColour = isDistracted
    ? '#ff3333'
    : progress > 0.8 ? '#ff3333' : progress > 0.5 ? '#ff6b35' : '#00ff88';

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
              {formatTime(Math.max(0, elapsed - totalDistractedSeconds))}
            </span>
            {totalDistractedSeconds > 0 && (
              <span className="side-stat-sub side-stat-red">📵 {formatTime(totalDistractedSeconds)} off</span>
            )}
          </div>
        )}
      </div>

      {/* Camera feed — visible once session starts */}
      {timerState !== 'idle' && (
        <div className="camera-feed-wrapper">
          <video
            ref={displayVideoRef}
            className="camera-feed-video"
            autoPlay
            playsInline
            muted
          />
          <div className={`camera-feed-status ${isDistracted ? 'feed-status-bad' : cameraReady ? 'feed-status-ok' : 'feed-status-loading'}`}>
            {!cameraReady && !cameraError && '📷 Starting camera...'}
            {cameraError && `⚠ ${cameraError}`}
            {cameraReady && !isDistracted && '✅ Focused'}
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