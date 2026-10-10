export function normalizeRole(role) {
  if (!role) return '';
  const lower = String(role).toLowerCase().trim();
  if (lower === 'admin' || lower === 'platform_admin') return 'platform_admin';
  if (lower === 'provider' || lower === 'vendor') return 'vendor';
  if (lower === 'citizen' || lower === 'customer') return 'customer';
  if (lower === 'gov' || lower === 'government' || lower === 'government_officer') return 'government_officer';
  return lower;
}

export function requireRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map(normalizeRole);
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userRole = normalizeRole(req.user.role);
    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires role: ${allowedRoles.join(' or ')}.`
      });
    }

    next();
  };
}

export function requirePermission(permission) {
  const targetPerm = String(permission).toUpperCase().trim();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Platform admin has super access
    const userRole = normalizeRole(req.user.role);
    if (userRole === 'platform_admin') {
      return next();
    }

    const perms = Array.isArray(req.user.permissions)
      ? req.user.permissions.map(p => String(p).toUpperCase().trim())
      : [];

    if (!perms.includes(targetPerm)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires official permission: ${permission}.`
      });
    }

    next();
  };
}

