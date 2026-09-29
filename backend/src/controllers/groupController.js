import { groupService } from '../services/groupService.js';

export async function getGroupsHandler(req, res, next) {
  try {
    const groups = await groupService.getAllGroups();
    return res.status(200).json(groups);
  } catch (err) {
    next(err);
  }
}

export async function getGroupByIdHandler(req, res, next) {
  try {
    const group = await groupService.getGroupById(req.params.id);
    return res.status(200).json(group);
  } catch (err) {
    next(err);
  }
}

export async function createGroupHandler(req, res, next) {
  try {
    const group = await groupService.createGroup(req.body);
    return res.status(201).json(group);
  } catch (err) {
    next(err);
  }
}

export async function updateGroupHandler(req, res, next) {
  try {
    const group = await groupService.updateGroup(req.params.id, req.body);
    return res.status(200).json(group);
  } catch (err) {
    next(err);
  }
}

export async function deleteGroupHandler(req, res, next) {
  try {
    await groupService.deleteGroup(req.params.id);
    return res.status(200).json({ success: true, message: 'Group deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getGroupMembersHandler(req, res, next) {
  try {
    const members = await groupService.getGroupMembers(req.params.id);
    return res.status(200).json(members);
  } catch (err) {
    next(err);
  }
}

export async function addMembersToGroupHandler(req, res, next) {
  try {
    const { memberIds } = req.body;
    const result = await groupService.addMembers(req.params.id, memberIds);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function removeMemberFromGroupHandler(req, res, next) {
  try {
    await groupService.removeMember(req.params.id, req.params.memberId);
    return res.status(200).json({ success: true, message: 'Member removed from group' });
  } catch (err) {
    next(err);
  }
}

export async function getAvailableMembersHandler(req, res, next) {
  try {
    const { search, chapter } = req.query;
    const members = await groupService.getAvailableMembers(req.params.id, search, chapter);
    return res.status(200).json(members);
  } catch (err) {
    next(err);
  }
}
