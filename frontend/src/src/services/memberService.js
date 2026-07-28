import { supabase } from '../lib/supabase';

export const memberService = {
  async getMembers(filters = {}) {
    let query = supabase.from('members').select('*');
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.chapter) query = query.eq('itlc_chapter_name', filters.chapter);
    
    const { data, error } = await query;
    if (error) throw new Error(error.message || 'Failed to fetch members');
    return data || [];
  },

  async getMemberById(id) {
    if (!id) return null;
    const { data, error } = await supabase.from('members').select('*').eq('id', id).single();
    if (error) throw new Error(error.message || 'Member not found');
    return data;
  },

  async registerMember(payload) {
    const { data, error } = await supabase.from('members').insert([payload]).select();
    if (error) throw new Error(error.message || 'Failed to submit registration');
    return data && data.length > 0 ? data[0] : null;
  },

  async updateMember(id, updates) {
    const { data, error } = await supabase.from('members').update(updates).eq('id', id).select();
    if (error) throw new Error(error.message || 'Failed to update profile');
    return data && data.length > 0 ? data[0] : null;
  }
};
