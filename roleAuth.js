function authenticateRole(role) {
  return function (req, res, next) {
    if (req.user && req.user.role === role) {
      return next();
    }
    return res.status(403).json({ message: 'Forbidden' });
  };
}

module.exports = authenticateRole;