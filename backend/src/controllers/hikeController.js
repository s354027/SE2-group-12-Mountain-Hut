export function createHikeController({ Hike, User }) {
  /**
   * GET /api/hikes/active
   * Lists ongoing hikes (not yet returned), with the hiker's identity and
   * contacts, sorted by expected return time. Staff only (MH-91/MH-122).
   */
  async function getActiveHikes(req, res) {
    try {
      const hikes = await Hike.findAll({
        where: { status: 'ONGOING' },
        include: [
          {
            model: User,
            as: 'hiker',
            attributes: ['id', 'firstName', 'lastName', 'phone', 'email', 'emergencyContact']
          }
        ],
        order: [['expectedReturnTime', 'ASC']]
      });

      return res.status(200).json(hikes);
    } catch (err) {
      console.error('Error fetching active hikes:', err);
      return res.status(500).json({ error: 'Failed to retrieve active hikes' });
    }
  }

  /**
   * POST /api/hikes
   * Registers a new hike for the authenticated hiker. The departure must be
   * in the future and the expected return must come after it (MH-107).
   */
  async function createHike(req, res) {
    const body = req.body;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const { destination, departureTime, expectedReturnTime } = body;
    const route = body.route ?? null;
    const waypoints = body.waypoints ?? [];

    if (typeof destination !== 'string' || !destination.trim()) {
      return res.status(400).json({ error: 'destination is required' });
    }

    if (route !== null && typeof route !== 'string') {
      return res.status(400).json({ error: 'Invalid route' });
    }

    // A whitespace-only route carries no information, same as omitting it.
    const normalizedRoute = typeof route === 'string' && !route.trim() ? null : route;

    if (!Array.isArray(waypoints) || waypoints.some(point => typeof point !== 'string' || !point.trim())) {
      return res.status(400).json({ error: 'waypoints must be an array of non-empty strings' });
    }

    const departure = new Date(departureTime);
    const expectedReturn = new Date(expectedReturnTime);

    if (Number.isNaN(departure.getTime())) {
      return res.status(400).json({ error: 'departureTime must be a valid date' });
    }

    if (Number.isNaN(expectedReturn.getTime())) {
      return res.status(400).json({ error: 'expectedReturnTime must be a valid date' });
    }

    if (departure.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'departureTime must be in the future' });
    }

    if (expectedReturn.getTime() <= departure.getTime()) {
      return res.status(400).json({ error: 'expectedReturnTime must be after departureTime' });
    }

    try {
      const hike = await Hike.create({
        hikerId: req.session.user.id,
        destination: destination.trim(),
        route: normalizedRoute === null ? null : normalizedRoute.trim(),
        waypoints: waypoints.map(point => point.trim()),
        departureTime: departure,
        expectedReturnTime: expectedReturn
      });

      return res.status(201).json(hike);
    } catch (err) {
      if (err.name === 'SequelizeValidationError') {
        return res.status(400).json({ error: 'Invalid hike data' });
      }

      console.error('Error creating hike:', err);
      return res.status(500).json({ error: 'Failed to register hike' });
    }
  }

  /**
   * GET /api/hikes/mine
   * Lists all hikes registered by the authenticated hiker (MH-107).
   */
  async function getMyHikes(req, res) {
    try {
      const hikes = await Hike.findAll({
        where: { hikerId: req.session.user.id },
        order: [['departureTime', 'DESC']]
      });

      return res.status(200).json(hikes);
    } catch (err) {
      console.error('Error fetching hikes:', err);
      return res.status(500).json({ error: 'Failed to retrieve hikes' });
    }
  }

  return { getActiveHikes, createHike, getMyHikes };
}
