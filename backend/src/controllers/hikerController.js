import { Op } from 'sequelize';

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 20;

/**
 * Lets an employee find a hiker already present in the system
 * by name, phone or email before entering a reservation (MH-07).
 */
export function createHikerController({ User, sequelize }) {
  async function searchHikers(req, res) {
    const query = typeof req.query?.q === 'string' ? req.query.q.trim() : '';

    if (query.length < MIN_QUERY_LENGTH) {
      return res.status(400).json({
        error: `Search query must contain at least ${MIN_QUERY_LENGTH} characters`
      });
    }

    // SQLite LIKE is case-insensitive for ASCII characters
    const like = { [Op.like]: `%${query}%` };

    try {
      const hikers = await User.findAll({
        where: {
          role: 'HIKER',
          [Op.or]: [
            { firstName: like },
            { lastName: like },
            { email: like },
            { phone: like },
            // full name, e.g. "Anna Rossi"
            sequelize.where(
              sequelize.literal("\"User\".\"firstName\" || ' ' || \"User\".\"lastName\""),
              like
            )
          ]
        },
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'notes', 'emergencyContact', 'isTemporary'],
        order: [['lastName', 'ASC'], ['firstName', 'ASC']],
        limit: MAX_RESULTS
      });

      return res.status(200).json(hikers.map(hiker => hiker.toJSON()));
    } catch (err) {
      console.error('Hiker search error:', err);
      return res.status(500).json({ error: 'Unable to search hikers' });
    }
  }

  return { searchHikers };
}
