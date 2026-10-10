import { verifySession } from '../services/authService.js';

export function requireAuth(req, res, next) {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.ll_token) {
    token = req.cookies.ll_token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in to access this resource.'
    });
  }

  const user = verifySession(token);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Session expired or invalid. Please sign in again.'
    });
  }

  req.user = user;
  req.token = token;
  next();
}

export function optionalAuth(req, res, next) {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.ll_token) {
    token = req.cookies.ll_token;
  }

  if (token) {
    const user = verifySession(token);
    if (user) {
      req.user = user;
      req.token = token;
    }
  }

  next();
}
