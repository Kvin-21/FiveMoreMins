import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import type { DashboardData } from '../types';

function snarkyStreakComment(streak: number): string {
  if (streak === 0) return "Embarrassing.";
  if (streak <= 3) return "It's a start. Barely.";
  if (streak <= 7) return "Okay fine, you're doing something.";
  if (streak <= 14) return "Genuinely surprised. Keep going.";
  return "Alright, we'll admit it — that's impressive.";
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    api.get<DashboardData>('/api/dashboard')
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setFetching(false));
  }, [user]);

  if (loading || fetching) return <div className="loading-spinner">Loading your shame…</div>;
  if (error) return <div className="page"><p className="error-text">{error}</p></div>;
  if (!data) return null;

  const { streak, last7Days, recentFailures, totalSessions } = data;

  return (
    <div className="page">
      <h1 className="page-title">Your Stats</h1>
      <p className="page-subtitle">{snarkyStreakComment(streak.current_streak)}</p>

      {/* Top stats */}
      <div className="dashboard-grid">
        <div className="streak-card">
          <div className="streak-label">Current Streak</div>
          <div className="streak-number">
            {streak.current_streak > 0 ? '🔥' : '❄️'} {streak.current_streak}
          </div>
          <div className="streak-label">day{streak.current_streak !== 1 ? 's' : ''}</div>
        </div>

        <div className="streak-card">
          <div className="streak-label">Longest Streak</div>
          <div className="streak-number" style={{ color: 'var(--warning)' }}>
            {streak.longest_streak}
          </div>
          <div className="streak-label">day{streak.longest_streak !== 1 ? 's' : ''}</div>
        </div>

        <div className="streak-card">
          <div className="streak-label">Total Sessions</div>
          <div className="streak-number" style={{ color: 'var(--text-secondary)', fontSize: '2.5rem' }}>
            {totalSessions}
          </div>
          <div className="streak-label">sessions</div>
        </div>
      </div>

      {/* Last 7 days */}
      <div className="card mt-3">
        <h3 style={{ marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Last 7 Days
        </h3>
        <div className="week-grid">
          {last7Days.map(({ date, outcome }) => {
            let cellClass: string;
            if (outcome === 'completed') cellClass = 'completed';
            else if (outcome === 'failed') cellClass = 'failed';
            else cellClass = 'none';
            const dayLabel = new Date(date).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
            return (
              <div key={date} className={`week-cell ${cellClass}`} title={`${date}: ${outcome ?? 'no session'}`}>
                <span>{dayLabel}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>🟩 Completed</span>
          <span>🟥 Failed</span>
          <span>⬛ None</span>
        </div>
      </div>

      {/* Recent failures */}
      {recentFailures.length > 0 && (
        <div className="card mt-3">
          <h3 style={{ marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recent Failures (for your reflection)
          </h3>
          <div className="failure-list">
            {recentFailures.map((f) => (
              <div key={f.id} className="failure-item">
                <span style={{ color: 'var(--text-secondary)' }}>{formatDate(f.started_at)}</span>
                <span className="away-time">⏱ {formatSeconds(f.away_seconds)} away</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentFailures.length === 0 && totalSessions > 0 && (
        <div className="card mt-3" style={{ textAlign: 'center', color: 'var(--success)', padding: '2rem' }}>
          No recent failures. Either you're doing great or you haven't started yet. 🤔
        </div>
      )}
    </div>
  );
}
