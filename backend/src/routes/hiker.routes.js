import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { createHikerController } from "../controllers/hikerController.js";
import { requirePasswordChanged } from "../middleware/requirePasswordChanged.js";
import { requireAuthorizedHiker } from "../middleware/requireAuthorizedHiker.js";

export function createHikerRouter({ User, sequelize }) {
  const router = Router();
  const { searchHikers, getHikerBookings } = createHikerController({ User, sequelize });

  // GET /api/hikers/search?q=... - match a hiker by name, phone or email (MH-07)
  router.get("/search", requireAuth, requireRole("EMPLOYEE"), searchHikers);

  /**
   * GET /api/hikers/:id/bookings?upcoming=true
   * Get all bookings, optionally filtering to future slots
   */
  router.get(
    "/:id/bookings",
    requireAuth,
    requireRole("HIKER"),
    requirePasswordChanged,
    requireAuthorizedHiker,
    getHikerBookings,
  );

  return router;
}
