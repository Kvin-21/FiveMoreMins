import { useState, useEffect } from 'react';
import { getDashboard, DashboardData } from '../utils/api';

interface User {
  id: number;
  email: string;
  partner_email: string;
  image_path: string;
}

interface DashboardProps {
  user: User | null;
}

export default function Dashboard({ user }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    getDashboard()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Singapore time (UTC+8)
  // SQLite stores CURRENT_TIMESTAMP without a timezone suffix, so we must treat it as UTC explicitly
  const formatDate = (dateStr: string) => {
    const utcStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
    return new Date(utcStr).toLocaleDateString('en-SG', {
      timeZone: 'Asia/Singapore',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (!user) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-empty">
          <h2>No account found</h2>
          <p>You need to set up an account first.</p>
          <a href="/setup" className="btn-primary">Set Up →</a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-loading">
          <div className="spinner"></div>
          <p>Loading your shame...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-empty">
          <h2>Failed to load</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const d = data!;

  // Build last 7 days for calendar display
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayData = d.lastSevenDays.find(day => day.date === dateStr);
    last7Days.push({ date: dateStr, ...dayData });
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Your Stats</h2>
        <p className="dashboard-user">
          {user.email}
          {user.partner_email && (
            <span className="dashboard-partner"> · Partner: {user.partner_email}</span>
          )}
        </p>
      </div>

      {/* Streak cards */}
      <div className="stats-grid">
        <div className="stat-card stat-card-big">
          <div className="stat-icon">🔥</div>
          <div className="stat-value">{d.streak.current}</div>
          <div className="stat-label">Current Streak</div>
          <div className="stat-sublabel">days in a row</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🏆</div>
          <div className="stat-value">{d.streak.longest}</div>
          <div className="stat-label">Best Streak</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-value">{d.stats.successRate}%</div>
          <div className="stat-label">Success Rate</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏱</div>
          <div className="stat-value">{formatDuration(d.stats.totalFocusTime)}</div>
          <div className="stat-label">Total Focus Time</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💀</div>
          <div className="stat-value stat-danger">{d.stats.totalFailures}</div>
          <div className="stat-label">Total Failures</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-value">{d.stats.totalSessions}</div>
          <div className="stat-label">Total Sessions</div>
        </div>
      </div>

      {/* Last 7 days calendar */}
      <div className="dashboard-section">
        <h3 className="section-title">Last 7 Days</h3>
        <div className="week-calendar">
          {last7Days.map(day => {
            const hasSuccess = day.successes && day.successes > 0;
            const hasFailure = day.failures && day.failures > 0;
            const today = new Date().toISOString().split('T')[0];
            const isToday = day.date === today;

            let dayClass = 'day-empty';
            if (hasFailure && !hasSuccess) dayClass = 'day-fail';
            else if (hasSuccess) dayClass = 'day-success';

            const dayName = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });

            return (
              <div key={day.date} className={`calendar-day ${dayClass} ${isToday ? 'today' : ''}`}>
                <span className="day-name">{dayName}</span>
                <div className="day-dot"></div>
                <span className="day-num">{new Date(day.date + 'T12:00:00').getDate()}</span>
              </div>
            );
          })}
        </div>
        <div className="calendar-legend">
          <span className="legend-item legend-success">✓ Success</span>
          <span className="legend-item legend-fail">✕ Failed</span>
          <span className="legend-item legend-empty">○ No session</span>
        </div>
      </div>

      {/* Full session history */}
      {d.allSessions && d.allSessions.length > 0 && (
        <div className="dashboard-section">
          <h3 className="section-title">Session History</h3>
          <div className="failures-list">
            {d.allSessions.map(session => {
              const isSuccess = session.status === 'completed';
              const isFailed = session.status === 'failed' || session.penalty_triggered;
              const icon = isSuccess ? '✅' : isFailed ? (session.penalty_triggered ? '💀' : '😤') : '⏹';
              return (
                <div
                  key={session.id}
                  className={`failure-item ${session.penalty_triggered ? 'failure-penalty' : isSuccess ? 'failure-success' : ''}`}
                >
                  <div className="failure-icon">{icon}</div>
                  <div className="failure-details">
                    <div className="failure-date">{formatDate(session.started_at)}</div>
                    <div className="failure-stats">
                      <span className={`session-status-badge session-status-${session.status}`}>
                        {session.status}
                      </span>
                      {session.longest_away_seconds > 0 && (
                        <span className="session-distracted-time">
                          📵 {formatDuration(session.longest_away_seconds)} distracted
                        </span>
                      )}
                      {session.penalty_triggered === 1 && (
                        <span className="failure-badge">BLACKMAIL SENT</span>
                      )}
                    </div>
                  </div>
                  <div className="failure-duration-col">
                    <span className="failure-duration">{formatDuration(session.duration_seconds)} focused</span>
                    {session.break_seconds != null && session.break_seconds > 0 && (
                      <span className="failure-break">☕ {formatDuration(session.break_seconds)} break</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {d.stats.totalSessions === 0 && (
        <div className="dashboard-empty-state">
          <p>No sessions yet. <a href="/focus">Start your first session →</a></p>
        </div>
      )}
    </div>
  );
}