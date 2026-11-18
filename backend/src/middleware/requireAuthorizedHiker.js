/**
 * Checks that the hiker is accessing his resources.
 * It checks if the ID in the request parameters matches the hiker id.
 */
export function requireAuthorizedHiker(req, res, next) {
  const sessionUserId = Number(req.session?.user?.id);
  const requestedUserId = Number(req.params.id);

  if (
    !Number.isSafeInteger(sessionUserId) ||
    !Number.isSafeInteger(requestedUserId) ||
    sessionUserId < 1 ||
    requestedUserId < 1 ||
    sessionUserId !== requestedUserId
  ) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
}
