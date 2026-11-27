import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const SESSIONS_FILE = path.join(__dirname, '..', 'data', 'sessions.json');
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Active sessions keyed by SHA-256(token) so the raw bearer tokens are never written to disk.
// Persisted to data/sessions.json so a server restart does not sign everyone out.
const sessions = new Map();

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function loadSessions() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return;
    const entries = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8') || '[]');
    const now = Date.now();
    for (const [key, session] of entries) {
      if (session && session.expiresAt > now) sessions.set(key, session);
    }
  } catch (err) {
    console.error('Error reading sessions file (starting with no sessions):', err.message);
  }
}

function persistSessions() {
  try {
    const now = Date.now();
    for (const [key, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(key);
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify([...sessions.entries()]), 'utf8');
  } catch (err) {
    console.error('Error saving sessions file:', err.message);
  }
}

loadSessions();

export const ROLES = Object.freeze({
  CUSTOMER: 'customer',
  VENDOR: 'vendor',
  GOVERNMENT_OFFICER: 'government_officer',
  PLATFORM_ADMIN: 'platform_admin'
});

export const PERMISSIONS = Object.freeze({
  CIVIC_OFFICER: 'CIVIC_OFFICER'
});

function ensureDataFile() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function readUsers() {
  ensureDataFile();
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading users file:', err);
    return [];
  }
}

function writeUsers(users) {
  ensureDataFile();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

// OWASP-recommended work factor for PBKDF2-HMAC-SHA512.
const PBKDF2_ITERATIONS = 210000;
const LEGACY_PBKDF2_ITERATIONS = 1000;

// Format: pbkdf2$<iterations>$<salt>$<hash>. Older hashes use "<salt>:<hash>" at 1000 iterations.
export function hashPassword(password) {
  if (typeof password !== 'string') throw new Error('Password must be a string');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

function parseStoredHash(storedHash) {
  if (typeof storedHash !== 'string') return null;
  if (storedHash.startsWith('pbkdf2$')) {
    const [, iter, salt, hash] = storedHash.split('$');
    const iterations = Number(iter);
    if (!iterations || !salt || !hash) return null;
    return { iterations, salt, hash };
  }
  if (storedHash.includes(':')) {
    const [salt, hash] = storedHash.split(':');
    return { iterations: LEGACY_PBKDF2_ITERATIONS, salt, hash };
  }
  return null;
}

export function verifyPassword(password, storedHash) {
  if (typeof password !== 'string') return false;
  const parsed = parseStoredHash(storedHash);
  if (!parsed) return false;
  const expected = Buffer.from(parsed.hash, 'hex');
  const actual = crypto.pbkdf2Sync(password, parsed.salt, parsed.iterations, expected.length || 64, 'sha512');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function needsRehash(storedHash) {
  const parsed = parseStoredHash(storedHash);
  return !parsed || parsed.iterations < PBKDF2_ITERATIONS;
}

// Seed default admin and sample accounts if not already present
export function initAuth() {
  const users = readUsers();
  let modified = false;

  // 1. Admin account
  let admin = users.find(u => u.role === 'admin' || u.role === 'platform_admin' || u.email === 'admin@locallink.org');
  if (!admin) {
    // Never ship a hardcoded admin password. Use ADMIN_PASSWORD, or generate a one-time random one.
    let adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      adminPassword = crypto.randomBytes(12).toString('base64url');
      console.log('==================================================================');
      console.log(' No ADMIN_PASSWORD set. Generated initial admin credentials:');
      console.log(`   username: admin   password: ${adminPassword}`);
      console.log(' Save this now; it will not be shown again.');
      console.log('==================================================================');
    }
    admin = {
      id: 'USR-ADMIN-01',
      username: 'admin',
      name: 'LocalLink Platform Admin',
      email: 'admin@locallink.org',
      phone: '9876543210',
      role: 'platform_admin',
      permissions: ['PLATFORM_ADMIN', 'SYSTEM_SETTINGS', 'USER_MANAGEMENT', 'AUDIT_LOGS'],
      passwordHash: hashPassword(adminPassword),
      location: {
        state: 'Delhi',
        district: 'Central Delhi',
        city: 'Connaught Place',
        pincode: '110001'
      },
      status: 'active',
      createdAt: '2026-10-01T13:08:31.995Z',
      lastLogin: null
    };
    users.push(admin);
    modified = true;
  } else {
    // Ensure admin user attributes are up-to-date
    if (!admin.username) { admin.username = 'admin'; modified = true; }
    if (admin.role !== 'platform_admin') { admin.role = 'platform_admin'; modified = true; }
    if (!admin.permissions) { admin.permissions = ['PLATFORM_ADMIN', 'SYSTEM_SETTINGS', 'USER_MANAGEMENT', 'AUDIT_LOGS']; modified = true; }
  }

  if (modified) {
    writeUsers(users);
  }
}

export function registerUser({ name, email, phone, password, role, businessName, profession, location, skills, hourlyRate }) {
  if (!name || !email || !password) {
    throw new Error('Name, email, and password are required');
  }
  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    throw new Error('Name, email, and password must be text');
  }

  const cleanEmail = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address');
  }
  const users = readUsers();

  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    throw new Error('An account with this email address already exists');
  }

  // Strictly enforce role: public registration CANNOT create admin or government_officer!
  let validRole = 'customer';
  const roleLower = (role || '').toLowerCase();
  if (roleLower === 'vendor' || roleLower === 'provider') {
    validRole = 'vendor';
  }

  const newUser = {
    id: `USR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: name.trim(),
    email: cleanEmail,
    phone: (phone || '').trim(),
    role: validRole,
    passwordHash: hashPassword(password),
    location: cleanLocation(location) || { state: 'Delhi', district: 'Central Delhi', city: 'Connaught Place', pincode: '110001' },
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLogin: null
  };

  if (validRole === 'vendor') {
    newUser.businessName = (businessName || name).trim();
    newUser.profession = (profession || 'General Services').trim();
    newUser.hourlyRate = Number(hourlyRate) || 300;
    const parsedSkills = normalizeSkills(skills);
    newUser.skills = parsedSkills.length ? parsedSkills : ['General Services'];
    newUser.verified = false; // requires admin verification
    newUser.availability = 'Available';
  }

  users.push(newUser);
  writeUsers(users);

  // Auto-generate session token
  const token = generateToken(newUser);
  return { user: sanitizeUser(newUser), token };
}

// Administrative creation of Government Officer accounts (Platform Admin only)
export function createGovernmentOfficer({ name, email, phone, password, organization, department, designation, permissions, location }) {
  if (!name || !email || !password) {
    throw new Error('Name, email, and password are required');
  }

  if (!organization || !organization.trim()) {
    throw new Error('Organization is mandatory for government officer accounts');
  }

  const cleanEmail = email.toLowerCase().trim();
  const users = readUsers();

  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    throw new Error('An account with this email address already exists');
  }

  const perms = ['CIVIC_OFFICER'];

  const newOfficer = {
    id: `USR-GOV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: name.trim(),
    email: cleanEmail,
    phone: (phone || '').trim(),
    role: 'government_officer',
    permissions: perms,
    organization: (organization || 'Municipal Administration').trim(),
    department: (department || 'Civic Operations').trim(),
    designation: (designation || 'Government Civic Officer').trim(),
    passwordHash: hashPassword(password),
    location: location || { state: 'Delhi', district: 'Central Delhi', city: 'Connaught Place', pincode: '110001' },
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLogin: null
  };

  users.push(newOfficer);
  writeUsers(users);
  return sanitizeUser(newOfficer);
}

export function loginUser({ email, password }) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const cleanEmail = String(email).toLowerCase().trim();
  const users = readUsers();
  // Sign-in is by email or unique username only; display names are not unique.
  const user = users.find(u =>
    (u.email && u.email.toLowerCase() === cleanEmail) ||
    (u.username && u.username.toLowerCase() === cleanEmail)
  );

  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (user.status === 'deactivated' || user.status === 'suspended') {
    throw new Error('Your account has been deactivated. Please contact support.');
  }

  const isValid = verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  // Transparently upgrade legacy/weak hashes now that we have the plaintext.
  if (needsRehash(user.passwordHash)) {
    user.passwordHash = hashPassword(password);
  }

  // Update lastLogin
  user.lastLogin = new Date().toISOString();
  writeUsers(users);

  const token = generateToken(user);
  return { user: sanitizeUser(user), token };
}

export function generateToken(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;

  sessions.set(hashToken(token), {
    userId: user.id,
    role: user.role,
    expiresAt
  });
  persistSessions();

  return token;
}

export function verifySession(token) {
  if (!token || typeof token !== 'string') return null;
  const key = hashToken(token);
  const session = sessions.get(key);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessions.delete(key);
    persistSessions();
    return null;
  }

  const users = readUsers();
  const user = users.find(u => u.id === session.userId);
  if (!user || user.status === 'deactivated' || user.status === 'suspended') {
    sessions.delete(key);
    persistSessions();
    return null;
  }

  return sanitizeUser(user);
}

export function invalidateSession(token) {
  if (token && sessions.delete(hashToken(token))) {
    persistSessions();
  }
}

export function getUserById(userId) {
  const users = readUsers();
  const user = users.find(u => u.id === userId);
  return user ? sanitizeUser(user) : null;
}

export function getAllUsers() {
  const users = readUsers();
  return users.map(sanitizeUser);
}

export function updateUserStatus(userId, status) {
  const users = readUsers();
  const user = users.find(u => u.id === userId);
  if (!user) throw new Error('User not found');
  if (user.role === 'admin' || user.role === 'platform_admin') {
    throw new Error('Cannot deactivate platform admin account');
  }

  user.status = status;
  writeUsers(users);
  return sanitizeUser(user);
}

export function updateUserProfile(userId, updates) {
  const users = readUsers();
  const user = users.find(u => u.id === userId);
  if (!user) throw new Error('User not found');

  if (updates.name) user.name = updates.name.trim();
  if (updates.phone) user.phone = updates.phone.trim();
  if (updates.location) user.location = { ...user.location, ...updates.location };
  if (updates.businessName && user.role === 'vendor') user.businessName = updates.businessName.trim();
  if (updates.profession && user.role === 'vendor') user.profession = updates.profession.trim();
  if (updates.hourlyRate && user.role === 'vendor') user.hourlyRate = Number(updates.hourlyRate);
  if (updates.availability && user.role === 'vendor') user.availability = updates.availability;
  if (updates.skills && user.role === 'vendor') {
    user.skills = Array.isArray(updates.skills) ? updates.skills : updates.skills.split(',').map(s => s.trim());
  }
  if (updates.designation && user.role === 'government_officer') user.designation = updates.designation.trim();

  writeUsers(users);
  return sanitizeUser(user);
}

// Strips markup characters from free text and bounds its length.
export function cleanText(value, max = 200) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').trim().slice(0, max);
}

// Accepts an array or comma-separated string; returns at most 20 short, clean skill strings.
export function normalizeSkills(skills) {
  const list = Array.isArray(skills) ? skills : (typeof skills === 'string' ? skills.split(',') : []);
  return list
    .filter(s => typeof s === 'string')
    .map(s => cleanText(s, 50))
    .filter(Boolean)
    .slice(0, 20);
}

// Normalizes a location object to known string fields only.
export function cleanLocation(location) {
  if (!location || typeof location !== 'object' || Array.isArray(location)) return null;
  const out = {};
  for (const key of ['state', 'district', 'city', 'pincode']) {
    if (typeof location[key] === 'string' && location[key].trim()) out[key] = cleanText(location[key], 60);
  }
  return Object.keys(out).length ? out : null;
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, password, ...cleanUser } = user;
  return cleanUser;
}
