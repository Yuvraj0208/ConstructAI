import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Site } from '../types';

const SITE_KEY = 'constructai_site';

interface SiteContextValue {
  sites: Site[];
  selectedSiteId: number | null;
  selectedSite: Site | null;
  setSelectedSiteId: (id: number) => void;
  loading: boolean;
}

const SiteContext = createContext<SiteContextValue | undefined>(undefined);

export function SiteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(SITE_KEY);
    return stored ? Number(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const setSelectedSiteId = useCallback((id: number) => {
    setSelectedSiteIdState(id);
    localStorage.setItem(SITE_KEY, String(id));
  }, []);

  // Load the sites the user can switch between, once they're authenticated.
  useEffect(() => {
    if (!user) {
      setSites([]);
      return;
    }
    setLoading(true);
    api
      .get<Site[]>('/sites')
      .then((res) => {
        setSites(res.data);
        setSelectedSiteIdState((cur) => {
          if (cur && res.data.some((s) => s.id === cur)) return cur;
          const first = res.data[0]?.id ?? null;
          if (first != null) localStorage.setItem(SITE_KEY, String(first));
          return first;
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const selectedSite = sites.find((s) => s.id === selectedSiteId) ?? null;

  return (
    <SiteContext.Provider
      value={{ sites, selectedSiteId, selectedSite, setSelectedSiteId, loading }}
    >
      {children}
    </SiteContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSite(): SiteContextValue {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used within a SiteProvider');
  return ctx;
}
