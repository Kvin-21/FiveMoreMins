import { Link, useLocation } from 'react-router-dom';

interface NavbarProps {
  userEmail?: string;
  onLogout: () => void;
}

export default function Navbar({ userEmail, onLogout }: NavbarProps) {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <Link to="/" className="nav-logo">
          <span className="logo-five">Five</span>MoreMins
        </Link>
        <span className="nav-badge">BETA</span>
      </div>

      <div className="nav-links">
        <Link to="/focus" className={`nav-link ${isActive('/focus') ? 'active' : ''}`}>
          ⏱ Focus
        </Link>
        <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
          📊 Stats
        </Link>
        {!userEmail ? (
          <Link to="/setup" className="nav-link nav-link-accent">
            🚀 Get Started
          </Link>
        ) : (
          <div className="nav-user">
            <span className="nav-email">{userEmail}</span>
            <button className="nav-logout" onClick={onLogout}>
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
