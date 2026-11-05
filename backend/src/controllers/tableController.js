export function createTableController({ DiningTable, SlotTable, BookingTable }) {
  /**
   * GET /api/tables
   * Reads the list of dining tables.
   */
  async function getTables(req, res) {
    try {
      const tables = await DiningTable.findAll({
        order: [['tableNumber', 'ASC']]
      });

      return res.status(200).json(tables);
    } catch (err) {
      console.error('Error fetching tables:', err);
      return res.status(500).json({ error: 'Failed to retrieve tables' });
    }
  }

  /**
   * POST /api/tables
   * Create a new dining table.
   */
  async function createTable(req, res) {
    const { tableNumber, seats } = req.body ?? {};

    const parsedTableNumber = Number(tableNumber);
    const parsedSeats = Number(seats);

    if (!Number.isInteger(parsedTableNumber) || parsedTableNumber < 1) {
      return res.status(400).json({ error: 'tableNumber must be a positive integer' });
    }
    if (!Number.isInteger(parsedSeats) || parsedSeats < 1) {
      return res.status(400).json({ error: 'seats must be a positive integer' });
    }

    try {
      const existing = await DiningTable.findOne({ where: { tableNumber: parsedTableNumber } });
      if (existing) {
        return res.status(409).json({ error: 'A table with this number already exists' });
      }

      const table = await DiningTable.create({
        tableNumber: parsedTableNumber,
        seats: parsedSeats
      });

      return res.status(201).json(table);
    } catch (err) {
      console.error('Error creating table:', err);
      return res.status(500).json({ error: 'Failed to create table' });
    }
  }

  /**
   * PUT /api/tables/:id
   * Update an existing dining table.
   */
  async function updateTable(req, res) {
    const { id } = req.params;
    const { tableNumber, seats } = req.body ?? {};

    try {
      const table = await DiningTable.findByPk(id);
      if (!table) {
        return res.status(404).json({ error: 'Table not found' });
      }

      const updateData = {};

      if (tableNumber !== undefined) {
        const parsedTableNumber = Number(tableNumber);
        if (!Number.isInteger(parsedTableNumber) || parsedTableNumber < 1) {
          return res.status(400).json({ error: 'tableNumber must be a positive integer' });
        }

        if (parsedTableNumber !== table.tableNumber) {
          const existing = await DiningTable.findOne({ where: { tableNumber: parsedTableNumber } });
          if (existing) {
            return res.status(409).json({ error: 'A table with this number already exists' });
          }
        }

        updateData.tableNumber = parsedTableNumber;
      }

      if (seats !== undefined) {
        const parsedSeats = Number(seats);
        if (!Number.isInteger(parsedSeats) || parsedSeats < 1) {
          return res.status(400).json({ error: 'seats must be a positive integer' });
        }
        updateData.seats = parsedSeats;
      }

      await table.update(updateData);

      return res.status(200).json(table);
    } catch (err) {
      console.error('Error updating table:', err);
      return res.status(500).json({ error: 'Failed to update table' });
    }
  }

  /**
   * DELETE /api/tables/:id
   * Remove a dining table, if it is not assigned to any slot or booking.
   */
  async function deleteTable(req, res) {
    const { id } = req.params;

    try {
      const table = await DiningTable.findByPk(id);
      if (!table) {
        return res.status(404).json({ error: 'Table not found' });
      }

      const assignedSlotsCount = await SlotTable.count({ where: { tableId: id } });
      if (assignedSlotsCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete a table that is assigned to one or more slots'
        });
      }

      const bookedCount = await BookingTable.count({ where: { tableId: id } });
      if (bookedCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete a table that is linked to existing bookings'
        });
      }

      await table.destroy();
      return res.status(204).send();
    } catch (err) {
      console.error('Error deleting table:', err);
      return res.status(500).json({ error: 'Failed to delete table' });
    }
  }

  return { getTables, createTable, updateTable, deleteTable };
}
