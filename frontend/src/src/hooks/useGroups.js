import { useState, useEffect, useCallback } from 'react';
import { groupService } from '../services/groupService';

export function useGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await groupService.getGroups();
      setGroups(data || []);
    } catch (err) {
      setError(err.message || 'Error loading groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const createGroup = async (payload) => {
    try {
      const newGroup = await groupService.createGroup(payload);
      await fetchGroups();
      return newGroup;
    } catch (err) {
      throw err;
    }
  };

  const updateGroup = async (id, payload) => {
    try {
      const updated = await groupService.updateGroup(id, payload);
      await fetchGroups();
      return updated;
    } catch (err) {
      throw err;
    }
  };

  const deleteGroup = async (id) => {
    try {
      await groupService.deleteGroup(id);
      await fetchGroups();
    } catch (err) {
      throw err;
    }
  };

  return {
    groups,
    loading,
    error,
    refetch: fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup
  };
}

export function useGroupDetails(groupId) {
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDetails = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    try {
      const [groupData, membersData] = await Promise.all([
        groupService.getGroupById(groupId),
        groupService.getGroupMembers(groupId)
      ]);
      setGroup(groupData);
      setMembers(membersData || []);
    } catch (err) {
      setError(err.message || 'Error loading group details');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const fetchAvailableMembers = useCallback(async ({ search = '', chapter = '' } = {}) => {
    if (!groupId) return [];
    try {
      const data = await groupService.getAvailableMembers(groupId, { search, chapter });
      setAvailableMembers(data || []);
      return data;
    } catch (err) {
      console.error('Error fetching available members:', err);
      return [];
    }
  }, [groupId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const addMembers = async (memberIds) => {
    const res = await groupService.addMembersToGroup(groupId, memberIds);
    await fetchDetails();
    return res;
  };

  const removeMember = async (memberId) => {
    const res = await groupService.removeMemberFromGroup(groupId, memberId);
    await fetchDetails();
    return res;
  };

  return {
    group,
    members,
    availableMembers,
    loading,
    error,
    refetch: fetchDetails,
    fetchAvailableMembers,
    addMembers,
    removeMember
  };
}
