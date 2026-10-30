import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { createSlotController } from '../controllers/slotController.js';

export function createSlotRouter({ Slot, DiningTable, Booking }) {
  const router = Router();
  const { getSlots, getSlotById, createSlot, updateSlot, deleteSlot } =
    createSlotController({ Slot, DiningTable, Booking });

  // All endpoints require authentication such as EMPLOYEE or WARDEN (MH-34)
  router.use(requireAuth, requireRole('EMPLOYEE', 'WARDEN'));

  router.get('/', getSlots);
  router.get('/:id', getSlotById);
  router.post('/', createSlot);
  router.put('/:id', updateSlot);
  router.delete('/:id', deleteSlot);

  return router;
}