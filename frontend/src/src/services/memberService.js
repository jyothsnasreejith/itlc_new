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
  },

  async getApprovedMembersForExport(searchQuery = '') {
    let query = supabase
      .from('members')
      .select('*')
      .eq('status', 'approved');

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim();
      query = query.or(
        `full_name.ilike.%${q}%,company.ilike.%${q}%,phone_number.ilike.%${q}%,designation.ilike.%${q}%,location.ilike.%${q}%,country_of_work.ilike.%${q}%`
      );
    }

    query = query.order('full_name', { ascending: true });
    const { data, error } = await query;
    if (error) throw new Error(error.message || 'Failed to fetch members for export');
    return data || [];
  },

  exportMembersToCSV(members, filename = 'itlc-approved-members-contacts.csv') {
    if (!members || members.length === 0) {
      throw new Error('No member data available to export');
    }

    const headers = [
      'Full Name',
      'Email',
      'Phone Number',
      'Designation',
      'Company / Organization',
      'Location',
      'Country of Work',
      'ITLC Chapter',
      'Industry Sector',
      'Industry Type',
      'Area of Expertise',
      'Years of Experience',
      'Membership Tier',
      'Status',
      'Member Since / Joined Date'
    ];

    const rows = members.map((m) => {
      const joinedDate = m.created_at
        ? new Date(m.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
        : 'N/A';

      return [
        m.full_name || 'N/A',
        m.email || 'N/A',
        m.phone_number ? String(m.phone_number) : 'N/A',
        m.designation || 'N/A',
        m.company || 'N/A',
        m.location || 'N/A',
        m.country_of_work || 'N/A',
        m.itlc_chapter_name || 'N/A',
        m.industry_sector || 'N/A',
        m.industry_type || 'N/A',
        m.area_of_expertise || 'N/A',
        m.years_of_experience ?? 'N/A',
        m.membership_tier || 'Standard',
        (m.status || 'approved').toUpperCase(),
        joinedDate
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    // UTF-8 BOM for Microsoft Excel auto-formatting
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

