import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeUser, cleanText, cleanLocation, normalizeSkills } from './authService.js';

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
  // Every field is type-checked and stripped of markup before it is persisted.
  const name = cleanText(updates.name, 100);
  const phone = cleanText(updates.phone, 30);
  const location = cleanLocation(updates.location);
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (location) user.location = { ...user.location, ...location };

  if (user.role === 'vendor') {
    const businessName = cleanText(updates.businessName, 150);
    const profession = cleanText(updates.profession, 80);
    const availability = cleanText(updates.availability, 50);
    const hourlyRate = Number(updates.hourlyRate);
    if (businessName) user.businessName = businessName;
    if (profession) user.profession = profession;
    if (availability) user.availability = availability;
    if (Number.isFinite(hourlyRate) && hourlyRate > 0 && hourlyRate <= 100000) user.hourlyRate = hourlyRate;
    if (updates.skills !== undefined) {
      const skills = normalizeSkills(updates.skills);
      if (skills.length) user.skills = skills;
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
  if (user.role === 'admin' || user.role === 'platform_admin') throw new Error('Admin status cannot be modified');

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
