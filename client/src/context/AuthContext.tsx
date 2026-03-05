import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if there's an active session on mount
    api.get<{ user: User }>('/api/me')
      .then(({ user: u }) => setUser(u))
      .catch(() => setUser(null)) // not logged in, no big deal
      .finally(() => setLoading(false));
  }, []);

  function login(u: User) {
    setUser(u);
  }

  function logout() {
    // Fire-and-forget — if the server call fails we still clear local state
    api.post('/api/logout').catch(() => {});
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
