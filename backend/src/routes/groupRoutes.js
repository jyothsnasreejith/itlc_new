import { Router } from 'express';
import {
  getGroupsHandler,
  getGroupByIdHandler,
  createGroupHandler,
  updateGroupHandler,
  deleteGroupHandler,
  getGroupMembersHandler,
  addMembersToGroupHandler,
  removeMemberFromGroupHandler,
  getAvailableMembersHandler
} from '../controllers/groupController.js';

const router = Router();

router.get('/', getGroupsHandler);
router.post('/', createGroupHandler);
router.get('/:id', getGroupByIdHandler);
router.put('/:id', updateGroupHandler);
router.delete('/:id', deleteGroupHandler);

router.get('/:id/members', getGroupMembersHandler);
router.post('/:id/members', addMembersToGroupHandler);
router.delete('/:id/members/:memberId', removeMemberFromGroupHandler);
router.get('/:id/available-members', getAvailableMembersHandler);

export default router;
