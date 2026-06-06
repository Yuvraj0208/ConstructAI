import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useSite } from '../site/SiteContext';
import type { Material } from '../types';

/** Loads the materials for the currently-selected site (from SiteContext). */
export function useMaterials() {
  const { selectedSiteId } = useSite();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (selectedSiteId == null) {
      setMaterials([]);
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    return api
      .get<Material[]>('/materials', { params: { site_id: selectedSiteId } })
      .then((res) => setMaterials(res.data))
      .finally(() => setLoading(false));
  }, [selectedSiteId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { materials, loading, reload };
}
