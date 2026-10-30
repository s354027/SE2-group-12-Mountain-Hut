import { Op } from 'sequelize';

export function createSlotController({ Slot, DiningTable, Booking }) {
  /**
   * GET /api/slots
   * Reads the list of time slots (filterable by query param 'data' and 'meal').
   * Includes the list of tables assigned to each slot.
   */
  async function getSlots(req, res) {
    const { date, meal } = req.query;
    const where = {};

    if (date) {
      where.date = date;
    }
    if (meal) {
      where.meal = meal.toUpperCase();
    }

    try {
      const slots = await Slot.findAll({
        where,
        include: [
          {
            model: DiningTable,
            as: 'tables',
            attributes: ['id', 'tableNumber', 'seats'],
            through: { attributes: [] }
          }
        ],
        order: [
          ['date', 'ASC'],
          ['startTime', 'ASC']
        ]
      });

      return res.status(200).json(slots);
    } catch (err) {
      console.error('Error fetching slots:', err);
      return res.status(500).json({ error: 'Failed to retrieve slots' });
    }
  }

  /**
   * GET /api/slots/:id
   * Reads the detail of a single slot by its ID.
   */
  async function getSlotById(req, res) {
    const { id } = req.params;

    try {
      const slot = await Slot.findByPk(id, {
        include: [
          {
            model: DiningTable,
            as: 'tables',
            attributes: ['id', 'tableNumber', 'seats'],
            through: { attributes: [] }
          }
        ]
      });

      if (!slot) {
        return res.status(404).json({ error: 'Slot not found' });
      }

      return res.status(200).json(slot);
    } catch (err) {
      console.error('Error fetching slot by ID:', err);
      return res.status(500).json({ error: 'Failed to retrieve slot' });
    }
  }

  /**
   * POST /api/slots
   * Create a new time slot and possibly assign tables (tableIds).
   */
  async function createSlot(req, res) {
    const { date, startTime, duration, meal, totalCapacity, status, tableIds } = req.body ?? {};

    if (!date || !startTime || !duration || !meal) {
      return res.status(400).json({
        error: 'date, startTime, duration, and meal are required fields'
      });
    }

    const normalizedMeal = meal.toUpperCase();
    if (!['LUNCH', 'DINNER'].includes(normalizedMeal)) {
      return res.status(400).json({ error: 'meal must be LUNCH or DINNER' });
    }

    const parsedDuration = Number(duration);
    if (!Number.isInteger(parsedDuration) || parsedDuration < 1) {
      return res.status(400).json({ error: 'duration must be a positive integer (minutes)' });
    }

    try {
      let tables = [];
      let capacity = totalCapacity ? Number(totalCapacity) : 0;

      // If tables are provided, check their existence and calculate capacity
      if (Array.isArray(tableIds) && tableIds.length > 0) {
        tables = await DiningTable.findAll({
          where: { id: { [Op.in]: tableIds } }
        });

        if (tables.length !== tableIds.length) {
          return res.status(400).json({ error: 'One or more tableIds are invalid' });
        }

        if (!totalCapacity) {
          capacity = tables.reduce((sum, t) => sum + t.seats, 0);
        }
      }

      if (capacity <= 0) {
        return res.status(400).json({
          error: 'totalCapacity must be specified or calculated from assigned tables'
        });
      }

      // Create the Slot
      const newSlot = await Slot.create({
        date,
        startTime,
        duration: parsedDuration,
        meal: normalizedMeal,
        totalCapacity: capacity,
        status: status || 'OPEN'
      });

      // Associate tables with slot via N:M
      if (tables.length > 0) {
        await newSlot.setTables(tables);
      }

      // Reload the full slot with tables
      const createdSlot = await Slot.findByPk(newSlot.id, {
        include: [
          {
            model: DiningTable,
            as: 'tables',
            attributes: ['id', 'tableNumber', 'seats'],
            through: { attributes: [] }
          }
        ]
      });

      return res.status(201).json(createdSlot);
    } catch (err) {
      console.error('Error creating slot:', err);
      return res.status(500).json({ error: 'Failed to create slot' });
    }
  }

  /**
   * PUT /api/slots/:id
   * Update an existing slot (times, duration, meal, status, and/or the list of associated tables).
   */
  async function updateSlot(req, res) {
    const { id } = req.params;
    const { date, startTime, duration, meal, totalCapacity, status, tableIds } = req.body ?? {};

    try {
      const slot = await Slot.findByPk(id);
      if (!slot) {
        return res.status(404).json({ error: 'Slot not found' });
      }

      const updateData = {};

      if (date) updateData.date = date;
      if (startTime) updateData.startTime = startTime;
      if (duration) {
        const parsedDuration = Number(duration);
        if (!Number.isInteger(parsedDuration) || parsedDuration < 1) {
          return res.status(400).json({ error: 'duration must be a positive integer' });
        }
        updateData.duration = parsedDuration;
      }
      if (meal) {
        const normalizedMeal = meal.toUpperCase();
        if (!['LUNCH', 'DINNER'].includes(normalizedMeal)) {
          return res.status(400).json({ error: 'meal must be LUNCH or DINNER' });
        }
        updateData.meal = normalizedMeal;
      }
      if (status) updateData.status = status;

      // Updating tables if provided with a tableIds array
      if (Array.isArray(tableIds)) {
        const tables = await DiningTable.findAll({
          where: { id: { [Op.in]: tableIds } }
        });

        if (tables.length !== tableIds.length) {
          return res.status(400).json({ error: 'One or more tableIds are invalid' });
        }

        await slot.setTables(tables);

        // If totalCapacity is not specified in the body, recalculate from the sum of the table seats
        if (totalCapacity !== undefined) {
          updateData.totalCapacity = Number(totalCapacity);
        } else {
          updateData.totalCapacity = tables.reduce((sum, t) => sum + t.seats, 0);
        }
      } else if (totalCapacity !== undefined) {
        updateData.totalCapacity = Number(totalCapacity);
      }

      await slot.update(updateData);

      // Reload the updated slot with associations
      const updatedSlot = await Slot.findByPk(slot.id, {
        include: [
          {
            model: DiningTable,
            as: 'tables',
            attributes: ['id', 'tableNumber', 'seats'],
            through: { attributes: [] }
          }
        ]
      });

      return res.status(200).json(updatedSlot);
    } catch (err) {
      console.error('Error updating slot:', err);
      return res.status(500).json({ error: 'Failed to update slot' });
    }
  }

  /**
   * DELETE /api/slots/:id
   * Clear a slot if it does not have active reservations.
   */
  async function deleteSlot(req, res) {
    const { id } = req.params;

    try {
      const slot = await Slot.findByPk(id);
      if (!slot) {
        return res.status(404).json({ error: 'Slot not found' });
      }

      // Check if there are active reservations before canceling
      const activeBookingsCount = await Booking.count({
        where: {
          slotId: id,
          status: { [Op.in]: ['PENDING', 'CONFIRMED'] }
        }
      });

      if (activeBookingsCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete slot with active bookings'
        });
      }

      await slot.destroy();
      return res.status(204).send();
    } catch (err) {
      console.error('Error deleting slot:', err);
      return res.status(500).json({ error: 'Failed to delete slot' });
    }
  }

  return {
    getSlots,
    getSlotById,
    createSlot,
    updateSlot,
    deleteSlot
  };
}