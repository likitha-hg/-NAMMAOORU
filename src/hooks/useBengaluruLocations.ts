import { useCallback, useEffect, useState } from 'react';
import {
  addBengaluruLocality,
  fetchBengaluruLocations,
  getCachedBengaluruLocations,
  subscribeBengaluruLocations,
} from '../services/locationMasterService';
import { BengaluruLocationDataset, NewLocalityInput } from '../types/locations';

export function useBengaluruLocations() {
  const [dataset, setDataset] = useState<BengaluruLocationDataset | null>(
    () => getCachedBengaluruLocations()
  );
  const [loading, setLoading] = useState<boolean>(() => !getCachedBengaluruLocations());
  const [error, setError] = useState<string>('');

  const reload = useCallback(async (force = false) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchBengaluruLocations(force);
      setDataset(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load Bengaluru ward and locality master data.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeBengaluruLocations((updated) => {
      setDataset(updated);
      setLoading(false);
    });

    if (!getCachedBengaluruLocations()) {
      void reload(false);
    }

    return unsubscribe;
  }, [reload]);

  const addLocality = useCallback(async (input: NewLocalityInput) => {
    const result = await addBengaluruLocality(input);
    setDataset(result.dataset);
    return result;
  }, []);

  return {
    dataset,
    loading,
    error,
    reload,
    addLocality,
  };
}
