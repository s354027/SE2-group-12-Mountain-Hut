/**
 * Controller for route: GET /api/auth/me
 * Returns the req.session.user object if present.
 */
export function getMe(req, res) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }

  return res.status(200).json(req.session.user);
}