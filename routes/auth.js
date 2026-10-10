import express from 'express';
import { registerUser, loginUser, invalidateSession, sanitizeUser } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function sanitize(str, max = 500) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, max);
}

// Common registration handler
function handleRegistration(req, res) {
  try {
    const { name, email, phone, password, role, businessName, profession, location, skills, hourlyRate } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email address, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Role safety: Public registration must never create an admin or government_officer!
    const roleLower = (role || '').toLowerCase();
    let safeRole = 'customer';
    if (roleLower === 'vendor' || roleLower === 'provider') {
      safeRole = 'vendor';
    }

    const result = registerUser({
      name: sanitize(name, 100),
      email: sanitize(email, 120),
      phone: sanitize(phone, 30),
      password,
      role: safeRole,
      businessName: sanitize(businessName, 150),
      profession: sanitize(profession, 80),
      location,
      skills,
      hourlyRate
    });

    // Set HTTP cookie for seamless sessions
    res.cookie('ll_token', result.token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      path: '/'
    });

    let displayRoleName = 'Customer';
    if (safeRole === 'vendor') displayRoleName = 'Service provider';

    res.status(201).json({
      success: true,
      message: `${displayRoleName} account created successfully`,
      data: {
        user: result.user,
        token: result.token
      }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message || 'Registration failed'
    });
  }
}

// POST /api/auth/register and /api/auth/signup
router.post('/register', handleRegistration);
router.post('/signup', handleRegistration);

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const identifier = req.body.email || req.body.username;
    const password = req.body.password;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email/username and password'
      });
    }

    const result = loginUser({
      email: sanitize(identifier, 120),
      password
    });

    // Set cookie
    res.cookie('ll_token', result.token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      path: '/'
    });

    res.json({
      success: true,
      message: 'Signed in successfully',
      data: {
        user: result.user,
        token: result.token
      }
    });
  } catch (err) {
    res.status(401).json({
      success: false,
      message: err.message || 'Invalid email or password'
    });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]?.trim();
  } else if (req.cookies && req.cookies.ll_token) {
    token = req.cookies.ll_token;
  } else if (req.token) {
    token = req.token;
  }

  if (token) {
    invalidateSession(token);
  }

  res.clearCookie('ll_token', { path: '/' });
  res.json({
    success: true,
    message: 'Signed out successfully'
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user
    }
  });
});

export default router;
