import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getStoredToken, setAuthToken } from '../api/client';
import type { User } from '../types';

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setAuthToken(token);
    api
      .get<User>('/auth/me')
      .then((r) => setUser(r.data))
      .catch(() => setAuthToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<User> {
    const res = await api.post('/auth/login', { email, password });
    setAuthToken(res.data.access_token);
    setUser(res.data.user);
    return res.data.user as User;
  }

  function logout() {
    setAuthToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
