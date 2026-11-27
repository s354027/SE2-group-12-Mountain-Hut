import { models, sequelize } from "../db/index.js";
import { Transaction } from "sequelize";

export class MenuError extends Error {
    constructor(status, message) {
        super(message);
        this.name = "MenuError";
        this.status = status;
    }
}

function validateId(id, field) {
    if (!Number.isSafeInteger(id) || id < 1) {
        throw new MenuError(400, `Invalid ${field}`);
    }
}

function validateMenuDetails({ description, price }) {
    if (typeof description !== "string" || !description.trim()) {
        throw new MenuError(400, "Menu description is required");
    }

    if (
        price !== null &&
        (
            typeof price !== "number" ||
            !Number.isFinite(price) ||
            price < 0
        )
    ) {
        throw new MenuError(400, "Invalid menu price");
    }
}

function ensureFutureSlot(slot) {
    const slotStart = new Date(`${slot.date}T${slot.startTime}`);

    if (
        Number.isNaN(slotStart.getTime()) ||
        Date.now() >= slotStart.getTime()
    ) {
        throw new MenuError(409, "Slot has already started");
    }
}

async function findEditableMenu(menuId, transaction) {
    const { Menu, Slot } = models;

    validateId(menuId, "menu ID");

    const menu = await Menu.findByPk(menuId, {
        include: [{
            model: Slot,
            as: "slot"
        }],
        transaction
    });

    if (!menu) {
        throw new MenuError(404, "Menu not found");
    }

    if (!menu.slot) {
        throw new MenuError(404, "Slot not found");
    }

    ensureFutureSlot(menu.slot);

    return menu;
}


// Creates a new menu associated with an existing future slot.
export async function createMenu({
    slotId,
    managerId,
    description,
    price = null
}) {
    const { Menu, Slot } = models;

    validateId(slotId, "slot ID");
    validateId(managerId, "manager ID");
    validateMenuDetails({ description, price });

    return sequelize.transaction(
        { type: Transaction.TYPES.IMMEDIATE },
        async transaction => {
            const slot = await Slot.findByPk(slotId, {
                transaction
            });

            if (!slot) {
                throw new MenuError(404, "Slot not found");
            }

            ensureFutureSlot(slot);

            return Menu.create({
                slotId,
                managerId,
                description,
                price
            }, { transaction });
        }
    );
}

// Retrieves a menu by its ID.
export async function getMenuById(menuId) {
    validateId(menuId, "menu ID");

    const menu = await models.Menu.findByPk(menuId);

    if (!menu) {
        throw new MenuError(404, "Menu not found");
    }

    return menu;
}

// Retrieves all menus associated with a slot.
export async function getMenusBySlot(slotId) {
    validateId(slotId, "slot ID");

    const { Menu, Slot } = models;

    const slot = await Slot.findByPk(slotId);

    if (!slot) {
        throw new MenuError(404, "Slot not found");
    }

    return Menu.findAll({
        where: { slotId }
    });
}

// Retrieves previously defined menus for reuse.
export async function getPreviousMenus() {
  const { Menu, Slot } = models;

  return Menu.findAll({
    include: [
      {
        model: Slot,
        as: "slot",
        attributes: ["id", "date", "startTime", "meal"],
      },
    ],
    order: [
      [{ model: Slot, as: "slot" }, "date", "DESC"],
      [{ model: Slot, as: "slot" }, "startTime", "DESC"],
      ["id", "DESC"],
    ],
  });
}

// Updates a menu only before its associated slot starts.
export async function updateMenu(menuId, {
    description,
    price
}) {
    validateMenuDetails({
        description,
        price: price === undefined ? null : price
    });

    return sequelize.transaction(
        { type: Transaction.TYPES.IMMEDIATE },
        async transaction => {
            const menu = await findEditableMenu(menuId, transaction);

            const updateData = { description };

            if (price !== undefined) {
                updateData.price = price;
            }

            return menu.update(updateData, { transaction });
        }
    );
}

// Deletes a menu only before its associated slot starts.
export async function deleteMenu(menuId) {
    return sequelize.transaction(
        { type: Transaction.TYPES.IMMEDIATE },
        async transaction => {
            const menu = await findEditableMenu(menuId, transaction);

            await menu.destroy({ transaction });
        }
    );
}