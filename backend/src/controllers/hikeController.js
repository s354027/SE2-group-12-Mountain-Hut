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

  return { getActiveHikes };
}
