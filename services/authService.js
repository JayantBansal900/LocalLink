import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

// In-memory active session token store: token -> { userId, email, role, expiresAt }
const sessions = new Map();

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

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

// Seed default admin and sample accounts if not already present
export function initAuth() {
  const users = readUsers();
  let modified = false;

  // 1. Admin account
  let admin = users.find(u => u.role === 'admin' || u.role === 'platform_admin' || u.email === 'admin@locallink.org');
  if (!admin) {
    admin = {
      id: 'USR-ADMIN-01',
      username: 'admin',
      name: 'LocalLink Platform Admin',
      email: 'admin@locallink.org',
      phone: '9876543210',
      role: 'platform_admin',
      permissions: ['PLATFORM_ADMIN', 'SYSTEM_SETTINGS', 'USER_MANAGEMENT', 'AUDIT_LOGS'],
      passwordHash: hashPassword('Admin@LocalLink2026!'),
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

  const cleanEmail = email.toLowerCase().trim();
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
    location: location || { state: 'Delhi', district: 'Central Delhi', city: 'Connaught Place', pincode: '110001' },
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLogin: null
  };

  if (validRole === 'vendor') {
    newUser.businessName = (businessName || name).trim();
    newUser.profession = (profession || 'General Services').trim();
    newUser.hourlyRate = Number(hourlyRate) || 300;
    newUser.skills = Array.isArray(skills) ? skills : (skills ? skills.split(',').map(s => s.trim()) : ['General Services']);
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

  const cleanEmail = email.toLowerCase().trim();
  const users = readUsers();
  const user = users.find(u => 
    (u.email && u.email.toLowerCase() === cleanEmail) || 
    (u.username && u.username.toLowerCase() === cleanEmail) || 
    (u.name && u.name.toLowerCase() === cleanEmail)
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

  // Update lastLogin
  user.lastLogin = new Date().toISOString();
  writeUsers(users);

  const token = generateToken(user);
  return { user: sanitizeUser(user), token };
}

export function generateToken(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  sessions.set(token, {
    userId: user.id,
    email: user.email,
    role: user.role,
    expiresAt
  });

  return token;
}

export function verifySession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  const users = readUsers();
  const user = users.find(u => u.id === session.userId);
  if (!user || user.status === 'deactivated' || user.status === 'suspended') {
    sessions.delete(token);
    return null;
  }

  return sanitizeUser(user);
}

export function invalidateSession(token) {
  if (token) {
    sessions.delete(token);
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

export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, password, ...cleanUser } = user;
  return cleanUser;
}
