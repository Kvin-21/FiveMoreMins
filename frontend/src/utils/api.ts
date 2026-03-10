// API helper - keeps all the fetch calls in one place
const BASE_URL = '/api';

// Get the stored auth token
function getToken(): string | null {
  return localStorage.getItem('fmm_token');
}

// Headers for authenticated GET requests
function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Headers for authenticated mutating requests
function mutatingHeaders(): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

// Auth
export async function signup(email: string, partnerEmail: string) {
  const res = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: mutatingHeaders(),
    credentials: 'include',
    body: JSON.stringify({ email, partnerEmail }),
  });
  return handleResponse<{ token: string; user: User }>(res);
}

export async function login(email: string) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: mutatingHeaders(),
    credentials: 'include',
    body: JSON.stringify({ email }),
  });
  return handleResponse<{ token: string; user: User }>(res);
}

export async function getMe() {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<{ user: User }>(res);
}

// Sessions
export async function startSession() {
  const res = await fetch(`${BASE_URL}/session/start`, {
    method: 'POST',
    headers: mutatingHeaders(),
    credentials: 'include',
  });
  return handleResponse<{ session: Session }>(res);
}

export async function endSession(sessionId: number, status: string, longestAway: number, duration: number, breakSeconds: number = 0) {
  const res = await fetch(`${BASE_URL}/session/end`, {
    method: 'POST',
    headers: mutatingHeaders(),
    credentials: 'include',
    body: JSON.stringify({ sessionId, status, longestAway, duration, breakSeconds }),
  });
  return handleResponse<{ success: boolean }>(res);
}

// Upload — multipart form, with no Content-Type header (browser sets it with boundary)
export async function uploadImage(file: File) {
  const token = getToken();
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: formData,
  });
  return handleResponse<{ success: boolean; imagePath: string; imageUrl: string }>(res);
}

// Penalty
export async function triggerPenalty(sessionId: number, awayMinutes: number) {
  const res = await fetch(`${BASE_URL}/penalty/trigger`, {
    method: 'POST',
    headers: mutatingHeaders(),
    credentials: 'include',
    body: JSON.stringify({ sessionId, awayMinutes }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

// Dashboard
export async function getDashboard() {
  const res = await fetch(`${BASE_URL}/dashboard`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<DashboardData>(res);
}

// Types
export interface User {
  id: number;
  email: string;
  partner_email: string;
  image_path: string;
}

export interface Session {
  id: number;
  user_id: number;
  started_at: string;
  ended_at?: string;
  duration_seconds: number;
  status: string;
  longest_away_seconds: number;
  penalty_triggered: boolean;
}

export interface DashboardData {
  streak: {
    current: number;
    longest: number;
    lastSessionDate: string | null;
  };
  lastSevenDays: Array<{
    date: string;
    total: number;
    successes: number;
    failures: number;
  }>;
  stats: {
    totalSessions: number;
    totalSuccesses: number;
    totalFailures: number;
    totalFocusTime: number;
    successRate: number;
  };
  recentFailures: Array<{
    id: number;
    started_at: string;
    ended_at: string;
    duration_seconds: number;
    longest_away_seconds: number;
    penalty_triggered: number;
  }>;
  allSessions: Array<{
    id: number;
    started_at: string;
    ended_at: string;
    duration_seconds: number;
    longest_away_seconds: number;
    penalty_triggered: number;
    status: string;
    break_seconds: number;
  }>;
}