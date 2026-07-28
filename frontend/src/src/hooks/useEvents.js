import { useState, useEffect, useCallback } from 'react';
import { eventService } from '../services/eventService';

export function useEvents(initialFilters = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async (filters = initialFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await eventService.getEvents(filters);
      setEvents(data);
    } catch (err) {
      setError(err.message || 'Error loading events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
}
