import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useQuery<T>(table: string, select = '*', orderProperty?: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase.from(table).select(select);
    if (orderProperty) {
      query = query.order(orderProperty, { ascending: true });
    }

    const { data: result, error: err } = await query;
    if (err) {
      setError(err.message);
    } else {
      setData(result as unknown as T[]);
    }
    setLoading(false);
  }, [table, select, orderProperty]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
