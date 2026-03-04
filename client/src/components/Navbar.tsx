import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function isActive(path: string) {
    return location.pathname === path ? 'active' : '';
  }

  async function handleLogout() {
    try {
      await api.post('/api/logout');
    } catch {
      // doesn't matter — clear state either way
    }
    logout();
    navigate('/');
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        FiveMoreMins 🔥
      </Link>

      <div className="navbar-links">
        {user ? (
          <>
            <Link to="/focus" className={isActive('/focus')}>Focus</Link>
            <Link to="/dashboard" className={isActive('/dashboard')}>Dashboard</Link>
            <Link to="/settings" className={isActive('/settings')}>Settings</Link>
            <button
              className="btn-secondary"
              onClick={handleLogout}
              style={{ fontSize: '0.875rem', padding: '0.4rem 0.9rem', marginLeft: '0.25rem' }}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className={isActive('/login')}>Log in</Link>
            <Link
              to="/signup"
              style={{
                background: 'var(--accent)',
                color: '#fff',
                padding: '0.4rem 0.9rem',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.875rem',
              }}
            >
              Get started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
