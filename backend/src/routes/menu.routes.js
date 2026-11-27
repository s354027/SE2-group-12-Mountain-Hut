import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

import {
    createMenu,
    getMenuById,
    getMenusBySlot,
    getPreviousMenus,
    updateMenu,
    deleteMenu
} from '../controllers/menuController.js';

const router = Router();

// All menu management endpoints require staff permissions.
router.use(requireAuth, requireRole('EMPLOYEE', 'WARDEN'));

router.get('/', getMenusBySlot);
router.get('/history', getPreviousMenus);
router.get('/:id', getMenuById);
router.post('/', createMenu);
router.put('/:id', updateMenu);
router.delete('/:id', deleteMenu);

export default router;