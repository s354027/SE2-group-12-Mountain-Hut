/**
 * Authentication middleware.
 * Check for user presence in session.
 * Responds with 401 Unauthorized if not authenticated.
 */
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }
  next();
}