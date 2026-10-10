import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeUser } from './authService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
  } catch (e) {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

export function getUserProfile(userId) {
  const users = readUsers();
  const user = users.find(u => u.id === userId);
  if (!user) throw new Error('User not found');
  return sanitizeUser(user);
}

export function updateUserProfile(userId, updates) {
  const users = readUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) throw new Error('User not found');

  const user = users[index];
  if (updates.name) user.name = updates.name.trim();
  if (updates.phone) user.phone = updates.phone.trim();
  if (updates.location) user.location = { ...user.location, ...updates.location };

  if (user.role === 'vendor') {
    if (updates.businessName) user.businessName = updates.businessName.trim();
    if (updates.profession) user.profession = updates.profession.trim();
    if (updates.hourlyRate) user.hourlyRate = Number(updates.hourlyRate) || user.hourlyRate;
    if (updates.availability) user.availability = updates.availability.trim();
    if (updates.skills) {
      user.skills = Array.isArray(updates.skills) ? updates.skills : updates.skills.split(',').map(s => s.trim());
    }
  }

  writeUsers(users);
  return sanitizeUser(user);
}

export function adminListUsers(query = {}) {
  const users = readUsers();
  let result = users.map(sanitizeUser);

  if (query.role) {
    result = result.filter(u => u.role === query.role);
  }
  if (query.search) {
    const s = query.search.toLowerCase();
    result = result.filter(u => 
      u.name.toLowerCase().includes(s) || 
      u.email.toLowerCase().includes(s) ||
      (u.phone && u.phone.includes(s))
    );
  }
  if (query.status) {
    result = result.filter(u => u.status === query.status);
  }

  return result;
}

export function adminSetUserStatus(userId, status) {
  const users = readUsers();
  const user = users.find(u => u.id === userId);
  if (!user) throw new Error('User not found');
  if (user.role === 'admin') throw new Error('Admin status cannot be modified');

  user.status = status;
  writeUsers(users);
  return sanitizeUser(user);
}

export function adminVerifyVendor(vendorId, verified = true) {
  const users = readUsers();
  const user = users.find(u => u.id === vendorId && u.role === 'vendor');
  if (!user) throw new Error('Vendor not found');

  user.verified = Boolean(verified);
  writeUsers(users);
  return sanitizeUser(user);
}

export function getSavedProviderIds(userId) {
  const users = readUsers();
  const user = users.find(u => u.id === userId);
  return (user && user.savedProviders) || [];
}

export function saveProviderForUser(userId, providerId) {
  const users = readUsers();
  const user = users.find(u => u.id === userId);
  if (!user) throw new Error('User not found');
  if (!user.savedProviders) user.savedProviders = [];
  if (!user.savedProviders.includes(providerId)) {
    user.savedProviders.push(providerId);
    writeUsers(users);
  }
  return user.savedProviders;
}

export function removeSavedProviderForUser(userId, providerId) {
  const users = readUsers();
  const user = users.find(u => u.id === userId);
  if (!user) throw new Error('User not found');
  if (user.savedProviders) {
    user.savedProviders = user.savedProviders.filter(id => id !== providerId);
    writeUsers(users);
  }
  return user.savedProviders || [];
}
