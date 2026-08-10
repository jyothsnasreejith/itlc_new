import { supabase } from '../lib/supabase';

export const eventService = {
  async getEvents(filters = {}) {
    let query = supabase.from('events').select('*');
    if (filters.status) query = query.eq('status', filters.status);
    
    const { data, error } = await query;
    if (error) throw new Error(error.message || 'Failed to fetch events');
    return data || [];
  },

  async getPaginatedEvents({ activeTab = 'upcoming', page = 0, pageSize = 25 }) {
    const start = page * pageSize;
    const end = start + pageSize - 1;
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const currentDate = `${year}-${month}-${day}`;

    let query = supabase
      .from('events')
      .select('id, title, description, date, time, image, location, fee')
      .range(start, end)
      .order('date', { ascending: activeTab === 'upcoming' });

    if (activeTab === 'upcoming') {
      query = query.gte('date', currentDate);
    } else {
      query = query.lt('date', currentDate);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message || 'Failed to fetch events');
    return data || [];
  },

  async getEventRegistrationCounts(eventIds = []) {
    if (!eventIds || eventIds.length === 0) return {};

    try {
      // Step 1: Try fast lookup in event_counters
      const { data: counters, error: countersError } = await supabase
        .from('event_counters')
        .select('event_id, registration_count')
        .in('event_id', eventIds);

      if (!countersError && counters) {
        const counts = {};
        counters.forEach(row => {
          counts[row.event_id] = row.registration_count || 0;
        });
        eventIds.forEach(id => {
          if (!(id in counts)) counts[id] = 0;
        });
        return counts;
      }
    } catch (err) {
      console.warn('event_counters unavailable, using lightweight fallback', err);
    }

    // Step 2: Lightweight fallback query - select ONLY event_id (NO heavy nested members join!)
    try {
      const { data: regs, error: regsError } = await supabase
        .from('event_registrations')
        .select('event_id')
        .in('event_id', eventIds);

      if (regsError) throw regsError;

      const counts = {};
      eventIds.forEach(id => { counts[id] = 0; });
      (regs || []).forEach(row => {
        if (row.event_id) {
          counts[row.event_id] = (counts[row.event_id] || 0) + 1;
        }
      });
      return counts;
    } catch (fallbackErr) {
      console.error('Error fetching registration counts:', fallbackErr);
      const counts = {};
      eventIds.forEach(id => { counts[id] = 0; });
      return counts;
    }
  },

  async getEventRegistrations(eventId) {
    if (!eventId) return [];

    const { data, error } = await supabase
      .from('event_registrations')
      .select('*, members (id, full_name, profile_image, phone, email, company_name, designation)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message || 'Failed to fetch event registrations');

    return (data || []).map(reg => ({
      id: reg.id,
      name: reg.name || reg.members?.full_name || 'Guest User',
      email: reg.email || reg.members?.email || 'N/A',
      phone: reg.phone || reg.members?.phone || 'N/A',
      company: reg.company || reg.members?.company_name || 'N/A',
      designation: reg.designation || reg.members?.designation || 'N/A',
      registration_type: reg.registration_type || (reg.member_id ? 'member' : 'guest'),
      payment_status: reg.payment_status,
      payment_id: reg.payment_id,
      payment_amount: reg.payment_amount,
      payment_at: reg.updated_at
    }));
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
