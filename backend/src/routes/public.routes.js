import { Router } from "express";
import { getPublicMealDetails } from "../controllers/publicController.js";

const router = Router();

// Public endpoints do not require authentication.
router.get("/meal-details", getPublicMealDetails);

export default router;