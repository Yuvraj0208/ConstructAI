import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Industry, Material } from '../types';

/** Loads industries + the materials for the currently-selected industry. */
export function useMaterials(defaultIndustryId?: number | null) {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [industryId, setIndustryId] = useState<number | null>(defaultIndustryId ?? null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Industry[]>('/industries')
      .then((res) => {
        setIndustries(res.data);
        setIndustryId((cur) => cur ?? res.data[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  const reload = useCallback(() => {
    if (industryId == null) return Promise.resolve();
    setLoading(true);
    return api
      .get<Material[]>('/materials', { params: { industry_id: industryId } })
      .then((res) => setMaterials(res.data))
      .finally(() => setLoading(false));
  }, [industryId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { industries, industryId, setIndustryId, materials, loading, reload };
}
