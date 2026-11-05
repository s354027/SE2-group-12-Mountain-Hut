import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { createTableController } from '../controllers/tableController.js';

export function createTableRouter({ DiningTable, SlotTable, BookingTable, Slot, Booking }) {
  const router = Router();
  const { getTables, createTable, updateTable, deleteTable } =
    createTableController({ DiningTable, SlotTable, BookingTable, Slot, Booking });

  // All endpoints require authentication as EMPLOYEE or WARDEN (MH-36)
  router.use(requireAuth, requireRole('EMPLOYEE', 'WARDEN'));

  router.get('/', getTables);
  router.post('/', createTable);
  router.put('/:id', updateTable);
  router.delete('/:id', deleteTable);

  return router;
}
