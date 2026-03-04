export interface User {
  id: number;
  email: string;
  created_at: number;
}

export interface Session {
  id: number;
  user_id: number;
  started_at: number;
  ended_at?: number;
  focus_duration?: number;
  outcome: 'completed' | 'failed' | 'abandoned' | 'active';
  away_seconds: number;
  penalty_triggered: number;
}

export interface PartnerStatus {
  partner_email?: string;
  consented_at?: number;
  revoked_at?: number;
  invite_token?: string;
}

export interface DashboardData {
  streak: {
    current_streak: number;
    longest_streak: number;
    last_session_date: string | null;
  };
  last7Days: Array<{ date: string; outcome: string | null }>;
  recentFailures: Array<{ id: number; started_at: number; ended_at: number; away_seconds: number }>;
  totalSessions: number;
}

export interface ImageRecord {
  id: number;
  user_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  uploaded_at: number;
}
