import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVisibility } from '../hooks/useVisibility';
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = timerState === 'running';
  const { isHidden: _isHidden, awaySeconds, resetAway } = useVisibility(isActive);

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

  // React to tab visibility changes
  useEffect(() => {
    if (!isActive || awaySeconds === 0) return;

    const tier = getTier(awaySeconds);
    if (!tier) return;

    // Don't trigger another warning while one is already showing
    if (warningVisible) return;

    // Only trigger penalty once per session
    const shouldTriggerPenalty = tier === 'aggressive' && !penaltyTriggered;

    if (shouldTriggerPenalty) {
      setPenaltyTriggered(true);
      setPenaltySent(false);

      if (sessionId) {
        triggerPenalty(sessionId, Math.floor(awaySeconds / 60))
          .then(() => setPenaltySent(true))
          .catch(() => setPenaltySent(true)); // show sent even if failed (dev mode)
      }
    }

    setWarningTier(tier);
    setWarningMessage(getRandomMessage(tier));
    setWarningMinutes(Math.floor(awaySeconds / 60));
    setWarningVisible(true);
  }, [awaySeconds, isActive, warningVisible, penaltyTriggered, sessionId]);

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
      setElapsed(0);
      setTimerState('running');
      setPenaltyTriggered(false);
    } catch (err) {
      setToast({ message: 'Failed to start session. Is the backend running?', type: 'error' });
    }
  };

  const handlePause = () => {
    if (timerState === 'running') {
      pausedAtRef.current = elapsed;
      startTimeRef.current = null;
      setTimerState('paused');
    } else if (timerState === 'paused') {
      startTimeRef.current = Date.now();
      setTimerState('running');
    }
  };

  const handleStop = useCallback(async (status: 'completed' | 'abandoned' = 'completed') => {
    if (!sessionId) return;

    setTimerState('idle');
    if (intervalRef.current) clearInterval(intervalRef.current);

    try {
      await endSession(sessionId, status, 0, elapsed);
    } catch (err) {
      console.error('Failed to end session:', err);
    }

    setElapsed(0);
    setSessionId(null);
    pausedAtRef.current = 0;
    startTimeRef.current = null;

    if (status === 'completed') {
      setToast({ message: '🔥 Session complete! You actually did it.', type: 'success' });
    }
  }, [sessionId, elapsed]);

  const handleDismissWarning = () => {
    setWarningVisible(false);
    resetAway();
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
  const maxSeconds = 60 * 60;
  const progress = Math.min(elapsed / maxSeconds, 1);
  const circumference = 2 * Math.PI * 140;
  const strokeDashoffset = circumference * (1 - progress);

  // Background color shifts from dark to danger red based on focus time
  const dangerLevel = Math.min(elapsed / (30 * 60), 1); // 30min = max danger

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

      {/* THE TIMER */}
      <div className={`timer-container ${timerState === 'running' ? 'timer-active' : ''}`}>
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
            stroke={progress > 0.8 ? '#ff3333' : progress > 0.5 ? '#ff6b35' : '#00ff88'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 150 150)"
            style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
          />
        </svg>

        <div className="timer-display">
          <span className="timer-time">{formatTime(elapsed)}</span>
          <span className="timer-label">
            {timerState === 'idle' && 'start when ready'}
            {timerState === 'running' && 'focused'}
            {timerState === 'paused' && 'paused'}
          </span>
        </div>
      </div>

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
            <button
              className="btn-danger btn-small"
              onClick={() => {
                if (confirm('End session without completing? Your streak may be affected.')) {
                  handleStop('abandoned');
                }
              }}
            >
              ✕ Quit
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
            {dangerLevel >= 0.5 && dangerLevel < 0.8 && '🟡 Don\'t you dare leave this tab'}
            {dangerLevel >= 0.8 && '🔴 DANGER ZONE — blackmail photo is ready to deploy'}
          </div>
        </div>
      )}

      {/* Tip when idle */}
      {timerState === 'idle' && (
        <div className="focus-tips">
          <p>💡 Leave this tab for <strong>5+ minutes</strong> and you'll get a warning.</p>
          <p>💀 Leave for <strong>30+ minutes</strong> and the blackmail gets sent.</p>
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
