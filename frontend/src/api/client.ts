// Axios instance + token management for the ConstructAI API.
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({ baseURL });

const TOKEN_KEY = 'constructai_token';

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Pull a human-readable message out of an axios error. */
export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
    return err.message;
  }
  return 'Something went wrong';
}

// If a token expires or is rejected, clear the session and bounce to login
// (skip auth endpoints so a bad login on the login page doesn't redirect-loop).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error?.config?.url ?? '';
    if (error?.response?.status === 401 && !url.includes('/auth/')) {
      setAuthToken(null);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);
