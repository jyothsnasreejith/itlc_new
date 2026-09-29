const API_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
  || (typeof process !== 'undefined' && process.env && process.env.VITE_API_URL)
  || 'http://localhost:5000/api';

export const groupService = {
  async getGroups() {
    const response = await fetch(`${API_URL}/groups`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch groups');
    }
    return await response.json();
  },

  async getGroupById(id) {
    const response = await fetch(`${API_URL}/groups/${id}`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch group details');
    }
    return await response.json();
  },

  async createGroup({ name, description, color }) {
    const response = await fetch(`${API_URL}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, color })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create group');
    }
    return await response.json();
  },

  async updateGroup(id, { name, description, color }) {
    const response = await fetch(`${API_URL}/groups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, color })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update group');
    }
    return await response.json();
  },

  async deleteGroup(id) {
    const response = await fetch(`${API_URL}/groups/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete group');
    }
    return await response.json();
  },

  async getGroupMembers(groupId) {
    const response = await fetch(`${API_URL}/groups/${groupId}/members`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch group members');
    }
    return await response.json();
  },

  async addMembersToGroup(groupId, memberIds = []) {
    const response = await fetch(`${API_URL}/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberIds })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add members to group');
    }
    return await response.json();
  },

  async removeMemberFromGroup(groupId, memberId) {
    const response = await fetch(`${API_URL}/groups/${groupId}/members/${memberId}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to remove member from group');
    }
    return await response.json();
  },

  async getAvailableMembers(groupId, { search = '', chapter = '' } = {}) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (chapter) params.append('chapter', chapter);

    const response = await fetch(`${API_URL}/groups/${groupId}/available-members?${params.toString()}`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch available members');
    }
    return await response.json();
  }
};
