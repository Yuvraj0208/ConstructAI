import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getStoredToken, setAuthToken } from '../api/client';
import type { Role, User } from '../types';

export interface SignupData {
  email: string;
  password: string;
  full_name: string;
  role: Role;
  city?: string;
  industry_id?: number;
  company_name?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (data: SignupData) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from a stored token on first load.
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setAuthToken(token);
    api
      .get<User>('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => setAuthToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<User> {
    const res = await api.post('/auth/login', { email, password });
    setAuthToken(res.data.access_token);
    setUser(res.data.user);
    return res.data.user as User;
  }

  async function signup(data: SignupData): Promise<User> {
    const res = await api.post('/auth/signup', data);
    setAuthToken(res.data.access_token);
    setUser(res.data.user);
    return res.data.user as User;
  }

  function logout() {
    setAuthToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
