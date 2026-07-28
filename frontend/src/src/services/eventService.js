import { supabase } from '../lib/supabase';

export const eventService = {
  async getEvents(filters = {}) {
    let query = supabase.from('events').select('*');
    if (filters.status) query = query.eq('status', filters.status);
    
    const { data, error } = await query;
    if (error) throw new Error(error.message || 'Failed to fetch events');
    return data || [];
  },

  async getEventById(id) {
    if (!id) return null;
    const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
    if (error) throw new Error(error.message || 'Event not found');
    return data;
  },

  async registerForEvent({ eventId, memberId, status = 'pending' }) {
    const { data, error } = await supabase.from('event_registrations').insert([
      {
        event_id: eventId,
        member_id: memberId,
        status: status,
        registration_date: new Date().toISOString()
      }
    ]).select();

    if (error) throw new Error(error.message || 'Failed to register for event');
    return data && data.length > 0 ? data[0] : null;
  }
};
