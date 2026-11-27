import { getPublicMealDetails as getPublicMealDetailsService } from "../services/publicService.js";

// Validates a calendar date in YYYY-MM-DD format.
function isValidDate(date) {
    if (
        typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        return false;
    }

    const parsedDate = new Date(`${date}T00:00:00Z`);

    return (
        !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.toISOString().slice(0, 10) === date
    );
}

// GET /api/public/meal-details?date=YYYY-MM-DD
export async function getPublicMealDetails(req, res) {
    const { date } = req.query;

    if (!isValidDate(date)) {
        return res.status(400).json({
            error: "A valid date in YYYY-MM-DD format is required"
        });
    }

    try {
        const slots = await getPublicMealDetailsService(date);

        return res.status(200).json(slots);
    } catch (error) {
        console.error("Error retrieving public meal details:", error);

        return res.status(500).json({
            error: "Failed to retrieve meal details"
        });
    }
}