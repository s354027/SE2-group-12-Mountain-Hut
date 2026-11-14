/**
 * Blocks users that must still change the random password generated
 * when an employee created their account (MH-07).
 * Responds with 403 and code PASSWORD_CHANGE_REQUIRED.
 */
export function requirePasswordChanged(req, res, next) {
  if (req.session?.user?.mustChangePassword) {
    return res.status(403).json({
      error: 'You must change your password before continuing',
      code: 'PASSWORD_CHANGE_REQUIRED'
    });
  }
  next();
}
