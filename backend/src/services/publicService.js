import { models } from "../db/index.js";

// Retrieves public meal details for open slots on a given date.
export async function getPublicMealDetails(date) {
    const { Slot, Menu } = models;

    const slots = await Slot.findAll({
        where: {
            date,
            status: "OPEN"
        },
        attributes: [
            "date",
            "startTime",
            "duration",
            "meal"
        ],
        include: [{
            model: Menu,
            as: "menus",
            attributes: [
                "description",
                "price"
            ],
            required: false
        }],
        order: [["startTime", "ASC"]]
    });

    // Exposes only public information.
    return slots.map(slot => ({
        date: slot.date,
        startTime: slot.startTime,
        duration: slot.duration,
        meal: slot.meal,
        menus: slot.menus.map(menu => ({
            description: menu.description,
            price: menu.price
        }))
    }));
}