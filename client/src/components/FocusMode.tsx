import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTimer } from '../hooks/useTimer';
import { useVisibility } from '../hooks/useVisibility';
import { getRandomMessage, type EscalationLevel } from '../data/messages';
import { api } from '../api/client';
import SnarkyModal from './SnarkyModal';

// Away thresholds in milliseconds
const MILD_THRESHOLD = 5 * 60 * 1000;       // 5 min
const MEDIUM_THRESHOLD = 15 * 60 * 1000;    // 15 min
const AGGRESSIVE_THRESHOLD = 30 * 60 * 1000; // 30 min

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function msToSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

export default function FocusMode() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { elapsed, isRunning, start, pause, stop, reset } = useTimer();
  const { isVisible, awayDuration, resetAway } = useVisibility();

  const [sessionId, setSessionId] = useState<number | null>(null);
  // Keep a ref in sync so the penalty effect always has the latest value without
  // needing sessionId in its dependency array (which would cause unwanted re-runs).
  const sessionIdRef = useRef<number | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [totalAwaySeconds, setTotalAwaySeconds] = useState(0);

  // Modal state
  const [modal, setModal] = useState<{ level: EscalationLevel; message: string } | null>(null);

  // Track which escalation levels have been shown this "away period"
  // Reset when user comes back and acknowledges or resets.
  const shownLevels = useRef<Set<EscalationLevel>>(new Set());

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [user, loading, navigate]);

  // Start a session on mount (once auth is confirmed)
  useEffect(() => {
    if (!user || sessionStarted) return;
    setSessionStarted(true);

    api.post<{ session: { id: number } }>('/api/session/start')
      .then(({ session }) => {
        setSessionId(session.id);
        sessionIdRef.current = session.id;
      })
      .catch(() => {
        // Session couldn't be created — not a blocker for the UI
        console.warn('Could not create session on server');
      });
  }, [user, sessionStarted]);

  // Watch away duration and trigger appropriate modal
  useEffect(() => {
    if (awayDuration === 0) return;

    // Build up total away time for the stats display
    setTotalAwaySeconds((prev) => prev + msToSeconds(awayDuration));

    const awayMinutes = awayDuration / 60_000;

    if (awayDuration >= AGGRESSIVE_THRESHOLD && !shownLevels.current.has('aggressive')) {
      shownLevels.current.add('aggressive');
      setModal({ level: 'aggressive', message: getRandomMessage('aggressive') });

      // Fire the penalty — don't wait for it
      api.post('/api/penalty/trigger', { session_id: sessionIdRef.current }).catch(() => {});

    } else if (awayDuration >= MEDIUM_THRESHOLD && !shownLevels.current.has('medium')) {
      shownLevels.current.add('medium');
      setModal({ level: 'medium', message: getRandomMessage('medium') });

    } else if (awayDuration >= MILD_THRESHOLD && !shownLevels.current.has('mild')) {
      shownLevels.current.add('mild');
      setModal({ level: 'mild', message: getRandomMessage('mild') });
    }
    // Suppress lint warning: we intentionally only re-run when awayDuration changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awayDuration]);

  function handleAcknowledge() {
    setModal(null);
    resetAway();
    shownLevels.current.clear();
  }

  async function handleStop(outcome: 'completed' | 'abandoned') {
    stop();
    try {
      await api.post('/api/session/end', {
        session_id: sessionId,
        outcome,
        away_seconds: totalAwaySeconds,
        focus_duration: elapsed,
      });
    } catch {
      // Silently fail — the user still gets the UI feedback
    }
    reset();
    setSessionId(null);
    setSessionStarted(false);
    setTotalAwaySeconds(0);
    shownLevels.current.clear();
    navigate('/dashboard');
  }

  if (loading || !user) {
    return <div className="loading-spinner">Loading…</div>;
  }

  return (
    <div className="focus-page">
      {/* Status indicator */}
      <div className="status-bar">
        {isRunning ? (
          <>
            <div className="pulse-dot" />
            <span style={{ color: 'var(--accent)' }}>FOCUSED</span>
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>
            {elapsed > 0 ? 'PAUSED' : 'READY'}
          </span>
        )}
        {!isVisible && (
          <span style={{ color: 'var(--warning)', marginLeft: '0.5rem' }}>— AWAY</span>
        )}
      </div>

      {/* Big timer */}
      <div className={`timer-display ${isRunning ? 'running' : ''}`}>
        {formatTime(elapsed)}
      </div>

      {/* Controls */}
      <div className="focus-controls">
        {!isRunning ? (
          <button className="btn-primary" onClick={start} style={{ minWidth: 100 }}>
            {elapsed > 0 ? '▶ Resume' : '▶ Start'}
          </button>
        ) : (
          <button className="btn-secondary" onClick={pause} style={{ minWidth: 100 }}>
            ⏸ Pause
          </button>
        )}

        {elapsed > 0 && (
          <>
            <button
              className="btn-primary"
              onClick={() => handleStop('completed')}
              style={{ background: 'var(--success)' }}
            >
              ✓ Complete
            </button>
            <button className="btn-danger" onClick={() => handleStop('abandoned')}>
              ✗ Give up
            </button>
          </>
        )}
      </div>

      {/* Away time stats */}
      {totalAwaySeconds > 0 && (
        <div className="away-stats">
          <h4>Total Away Time</h4>
          <div className="stat-value">{formatTime(totalAwaySeconds)}</div>
        </div>
      )}

      {/* A gentle reminder of what's at stake */}
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', maxWidth: 400 }}>
        {isRunning
          ? 'Stay here. We\'re watching the tab. You know what happens.'
          : 'Hit start when you\'re ready to actually do the thing.'}
      </p>

      {/* Snarky modal */}
      {modal && (
        <SnarkyModal
          level={modal.level}
          message={modal.message}
          awayMinutes={awayDuration / 60_000}
          onClose={() => setModal(null)}
          onAcknowledge={handleAcknowledge}
        />
      )}
    </div>
  );
}
