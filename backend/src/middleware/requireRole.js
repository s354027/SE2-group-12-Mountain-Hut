/**
 * Middleware for role-based access control.
 * Responds with 403 Forbidden if the user's role is not among those allowed.
 * Responds with 401 Unauthorized if the session is missing.
 * 
 * @param {...string} allowedRoles - Roles allowed (es. 'HIKER', 'EMPLOYEE', 'WARDEN')
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    const { role } = req.session.user;

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
}