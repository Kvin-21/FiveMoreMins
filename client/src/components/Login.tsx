import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();

  // Handle magic link verification — /login/verify?token=xxx
  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) return;

    setVerifying(true);
    api.post<{ user: User }>('/api/login/verify', { token })
      .then(({ user }) => {
        login(user);
        navigate('/focus');
      })
      .catch((err: Error) => {
        setError(err.message || 'That link is invalid or expired. Try again.');
        setVerifying(false);
      });
  }, [searchParams, login, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError('');

    try {
      await api.post('/api/signup', { email: email.trim() });
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  if (verifying) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Verifying your link…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Welcome back.</h1>
        <p className="auth-subtitle">
          No passwords here — that's one less thing to procrastinate about.
          Enter your email and we'll send a magic link.
        </p>

        {sent ? (
          <div className="auth-success">
            ✉️ Check your email. We sent a link.<br />
            <strong>Don't make us wait.</strong>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div>
              <label className="form-label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
