import {
    createMenu as createMenuService,
    getMenuById as getMenuByIdService,
    getMenusBySlot as getMenusBySlotService,
    getPreviousMenus as getPreviousMenusService,
    updateMenu as updateMenuService,
    deleteMenu as deleteMenuService,
    MenuError
} from "../services/menuService.js";

// Handles menu service errors and unexpected errors.
function handleMenuError(res, error) {
    if (error instanceof MenuError) {
        return res.status(error.status).json({
            error: error.message
        });
    }

    if (error.name === "SequelizeValidationError") {
        return res.status(400).json({
            error: "Invalid menu data"
        });
    }

    console.error("Menu operation failed:", error);

    return res.status(500).json({
        error: "Menu operation failed"
    });
}

// POST /api/menus
export async function createMenu(req, res) {
    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return res.status(400).json({
            error: "Invalid request body"
        });
    }

    const { slotId, description, price = null } = body;

    try {
        const menu = await createMenuService({
            slotId,
            managerId: req.session.user.id,
            description,
            price
        });

        return res.status(201).json(menu);
    } catch (error) {
        return handleMenuError(res, error);
    }
}

// GET /api/menus/:id
export async function getMenuById(req, res) {
    const menuId = Number(req.params.id);

    try {
        const menu = await getMenuByIdService(menuId);
        return res.status(200).json(menu);
    } catch (error) {
        return handleMenuError(res, error);
    }
}

// GET /api/menus?slotId=...
export async function getMenusBySlot(req, res) {
    const { slotId } = req.query;

    if (typeof slotId !== "string" || !/^[0-9]+$/.test(slotId)) {
        return res.status(400).json({ error: "Invalid slot ID" });
    }

    try {
        const menus = await getMenusBySlotService(Number(slotId));
        return res.status(200).json(menus);
    } catch (error) {
        return handleMenuError(res, error);
    }
}

// GET /api/menus/history
export async function getPreviousMenus(req, res) {
    try {
        const menus = await getPreviousMenusService();
        return res.status(200).json(menus);
    } catch (error) {
        return handleMenuError(res, error);
    }
}

// PUT /api/menus/:id
export async function updateMenu(req, res) {
    const menuId = Number(req.params.id);
    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return res.status(400).json({
            error: "Invalid request body"
        });
    }

    const { description, price } = body;

    try {
        const menu = await updateMenuService(menuId, {
            description,
            price
        });

        return res.status(200).json(menu);
    } catch (error) {
        return handleMenuError(res, error);
    }
}

// DELETE /api/menus/:id
export async function deleteMenu(req, res) {
    const menuId = Number(req.params.id);

    try {
        await deleteMenuService(menuId);

        return res.status(204).send();
    } catch (error) {
        return handleMenuError(res, error);
    }
}