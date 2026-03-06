import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Landing from './components/Landing';
import Setup from './components/Setup';
import FocusMode from './components/FocusMode';
import Dashboard from './components/Dashboard';
import './App.css';

interface User {
  id: number;
  email: string;
  partner_email: string;
  image_path: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Check localStorage on mount - persist login across refreshes
  useEffect(() => {
    const storedToken = localStorage.getItem('fmm_token');
    const storedUser = localStorage.getItem('fmm_user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        // Bad data, clear it
        localStorage.removeItem('fmm_token');
        localStorage.removeItem('fmm_user');
      }
    }
  }, []);

  const handleLogin = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('fmm_token', newToken);
    localStorage.setItem('fmm_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('fmm_token');
    localStorage.removeItem('fmm_user');
  };

  return (
    <BrowserRouter>
      <div className="app">
        <Navbar userEmail={user?.email} onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route
              path="/setup"
              element={
                token ? <Navigate to="/focus" replace /> : <Setup onLogin={handleLogin} />
              }
            />
            <Route path="/focus" element={<FocusMode user={user} />} />
            <Route path="/dashboard" element={<Dashboard user={user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
