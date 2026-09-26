import { groupRepository } from '../repositories/groupRepository.js';

export const groupService = {
  async getAllGroups() {
    return await groupRepository.getAllGroups();
  },

  async getGroupById(id) {
    if (!id) {
      const err = new Error('Group ID is required');
      err.statusCode = 400;
      throw err;
    }
    const group = await groupRepository.getGroupById(id);
    if (!group) {
      const err = new Error('Group not found');
      err.statusCode = 404;
      throw err;
    }
    return group;
  },

  async createGroup({ name, description, color }) {
    if (!name || !name.trim()) {
      const err = new Error('Group name is required');
      err.statusCode = 400;
      throw err;
    }
    return await groupRepository.createGroup({
      name: name.trim(),
      description: description ? description.trim() : null,
      color: color || '#4f46e5'
    });
  },

  async updateGroup(id, { name, description, color }) {
    const existing = await groupRepository.getGroupById(id);
    if (!existing) {
      const err = new Error('Group not found');
      err.statusCode = 404;
      throw err;
    }
    return await groupRepository.updateGroup(id, {
      name: name ? name.trim() : existing.name,
      description: description !== undefined ? (description ? description.trim() : null) : existing.description,
      color: color !== undefined ? color : existing.color
    });
  },

  async deleteGroup(id) {
    const existing = await groupRepository.getGroupById(id);
    if (!existing) {
      const err = new Error('Group not found');
      err.statusCode = 404;
      throw err;
    }
    return await groupRepository.deleteGroup(id);
  },

  async getGroupMembers(groupId) {
    await this.getGroupById(groupId);
    return await groupRepository.getGroupMembers(groupId);
  },

  async addMembers(groupId, memberIds) {
    await this.getGroupById(groupId);
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      const err = new Error('memberIds array is required');
      err.statusCode = 400;
      throw err;
    }
    return await groupRepository.addMembersToGroup(groupId, memberIds);
  },

  async removeMember(groupId, memberId) {
    await this.getGroupById(groupId);
    if (!memberId) {
      const err = new Error('memberId is required');
      err.statusCode = 400;
      throw err;
    }
    return await groupRepository.removeMemberFromGroup(groupId, memberId);
  },

  async getAvailableMembers(groupId, search, chapter) {
    await this.getGroupById(groupId);
    return await groupRepository.getAvailableMembersForGroup(groupId, search, chapter);
  }
};
