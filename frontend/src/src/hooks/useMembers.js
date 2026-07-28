import { useState, useEffect, useCallback } from 'react';
import { memberService } from '../services/memberService';

export function useMembers(initialFilters = {}) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMembers = useCallback(async (filters = initialFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await memberService.getMembers(filters);
      setMembers(data);
    } catch (err) {
      setError(err.message || 'Error loading members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return { members, loading, error, refetch: fetchMembers };
}
