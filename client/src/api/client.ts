// Thin fetch wrapper. Nothing fancy — just keeps credentials, base URL, and CSRF token consistent.

const BASE_URL = import.meta.env.VITE_API_URL || '';

// Cache the CSRF token so we're not fetching it on every request
let csrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch(`${BASE_URL}/api/csrf-token`, { credentials: 'include' });
  const data = await res.json() as { token: string };
  csrfToken = data.token;
  return csrfToken;
}

// Reset cached token — call this after receiving a 403 to retry with a fresh one
export function resetCsrfToken() {
  csrfToken = null;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  // Include CSRF token for state-changing requests
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers['x-csrf-token'] = await getCsrfToken();
  }

  const options: RequestInit = {
    method,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  const res = await fetch(`${BASE_URL}${path}`, options);

  // If we got a CSRF error, reset the token and retry once
  if (res.status === 403) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (data?.error?.toLowerCase().includes('csrf') || data?.error?.toLowerCase().includes('invalid')) {
      resetCsrfToken();
      headers['x-csrf-token'] = await getCsrfToken();
      const retry = await fetch(`${BASE_URL}${path}`, { ...options, headers });
      if (!retry.ok) {
        let message = `Request failed: ${retry.status}`;
        try {
          const retryData = await retry.json() as { error?: string; message?: string };
          if (retryData?.error) message = retryData.error;
          else if (retryData?.message) message = retryData.message;
        } catch { /* not JSON */ }
        throw new Error(message);
      }
      if (retry.status === 204) return undefined as T;
      return retry.json() as Promise<T>;
    }
    throw new Error(data?.error || `Request failed: 403`);
  }

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = await res.json() as { error?: string; message?: string };
      if (data?.error) message = data.error;
      else if (data?.message) message = data.message;
    } catch {
      // Response wasn't JSON — use the status string
    }
    throw new Error(message);
  }

  // Some endpoints return 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

