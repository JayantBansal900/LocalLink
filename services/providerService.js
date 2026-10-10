import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const providersFilePath = path.join(__dirname, '..', 'data', 'providers.json');
const usersFilePath = path.join(__dirname, '..', 'data', 'users.json');

function loadProviders() {
  try {
    const raw = fs.readFileSync(providersFilePath, 'utf8');
    const staticProviders = JSON.parse(raw || '[]');

    // Also include registered active vendors from users.json
    try {
      const userRaw = fs.readFileSync(usersFilePath, 'utf8');
      const users = JSON.parse(userRaw || '[]');
      const registeredVendors = users
        .filter(u => u.role === 'vendor' && u.status === 'active')
        .map(u => ({
          id: u.id,
          name: u.name,
          businessName: u.businessName || u.name,
          profession: u.profession || 'General Services',
          experienceYears: u.experienceYears || 3,
          rating: u.rating || 5.0,
          reviewsCount: u.reviewsCount || 1,
          hourlyRate: u.hourlyRate || 300,
          state: u.location?.state || 'Delhi',
          district: u.location?.district || 'Central Delhi',
          city: u.location?.city || 'Connaught Place',
          pincode: u.location?.pincode || '110001',
          address: u.address || `${u.location?.city || 'Connaught Place'}, ${u.location?.state || 'Delhi'}`,
          phone: u.phone || '+91 XXXXX XXXXX',
          email: u.email,
          verified: Boolean(u.verified),
          availability: u.availability || 'Available',
          bio: u.bio || `${u.profession || 'Specialist'} offering professional local services.`,
          skills: u.skills || [u.profession || 'General Services'],
          profileImage: u.profileImage || 'https://images.pexels.com/photos/257736/pexels-photo-257736.jpeg?auto=compress&cs=tinysrgb&w=800',
          createdAt: u.createdAt
        }));

      // Merge avoiding duplicate IDs
      const existingIds = new Set(staticProviders.map(p => p.id));
      const combined = [...staticProviders];
      for (const v of registeredVendors) {
        if (!existingIds.has(v.id)) {
          combined.push(v);
        }
      }

      // Normalize location property for all providers
      return combined.map(p => ({
        ...p,
        location: p.location || (p.city && p.state ? `${p.city}, ${p.state}` : (p.city || 'India'))
      }));
    } catch (e) {
      return staticProviders.map(p => ({
        ...p,
        location: p.location || (p.city && p.state ? `${p.city}, ${p.state}` : (p.city || 'India'))
      }));
    }
  } catch (err) {
    console.error('Error loading providers:', err);
    return [];
  }
}

export const providerService = {
  getAll: (filters = {}) => {
    let list = loadProviders();
    const { profession, state, district, city, pincode, verified, rating, search, sort } = filters;

    // Filter: Profession
    if (profession && profession !== 'all') {
      const profLower = profession.toLowerCase();
      list = list.filter(p => (p.profession || '').toLowerCase() === profLower);
    }

    // Filter: State
    if (state && state !== 'all') {
      const stateLower = state.toLowerCase();
      list = list.filter(p => (p.state || '').toLowerCase() === stateLower);
    }

    // Filter: District
    if (district && district !== 'all') {
      const distLower = district.toLowerCase();
      list = list.filter(p => (p.district || '').toLowerCase() === distLower);
    }

    // Filter: City
    if (city && city !== 'all') {
      const cityLower = city.toLowerCase();
      list = list.filter(p => (p.city || '').toLowerCase() === cityLower);
    }

    // Filter: Pincode
    if (pincode && pincode !== 'all') {
      list = list.filter(p => (p.pincode || '') === pincode);
    }

    // Filter: Verified
    if (verified === true || verified === 'true') {
      list = list.filter(p => p.verified === true);
    }

    // Filter: Minimum Rating
    if (rating && !isNaN(Number(rating))) {
      const minRating = Number(rating);
      list = list.filter(p => (p.rating || 0) >= minRating);
    }

    // Filter: Search Keyword
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.businessName && p.businessName.toLowerCase().includes(q)) ||
        (p.profession && p.profession.toLowerCase().includes(q)) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.state && p.state.toLowerCase().includes(q)) ||
        (p.bio && p.bio.toLowerCase().includes(q)) ||
        (p.skills && p.skills.some(s => s.toLowerCase().includes(q)))
      );
    }

    // Sorting
    if (sort === 'rating-desc') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sort === 'rate-asc') {
      list.sort((a, b) => (a.hourlyRate || 0) - (b.hourlyRate || 0));
    } else if (sort === 'rate-desc') {
      list.sort((a, b) => (b.hourlyRate || 0) - (a.hourlyRate || 0));
    } else if (sort === 'experience-desc') {
      list.sort((a, b) => (b.experienceYears || 0) - (a.experienceYears || 0));
    } else if (sort === 'name-asc') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else {
      // Default: rating desc
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return list;
  },

  getById: (id) => {
    const list = loadProviders();
    const idLower = String(id).toLowerCase();
    
    // Check exact id match, slug match, or numeric index alias
    return list.find(p => 
      String(p.id).toLowerCase() === idLower ||
      (id === '1' && p.profession === 'Plumber') ||
      (id === '2' && p.profession === 'Electrician') ||
      (id === '3' && p.profession === 'Carpenter')
    ) || null;
  },

  getRequests: () => {
    try {
      const p = path.join(__dirname, '..', 'data', 'requests.json');
      return JSON.parse(fs.readFileSync(p, 'utf8') || '[]');
    } catch (e) {
      return [];
    }
  },

  updateVerification: (id, isVerified) => {
    try {
      const raw = fs.readFileSync(providersFilePath, 'utf8');
      const list = JSON.parse(raw || '[]');
      const provider = list.find(p => String(p.id).toLowerCase() === String(id).toLowerCase());
      if (provider) {
        provider.verified = isVerified;
        fs.writeFileSync(providersFilePath, JSON.stringify(list, null, 2), 'utf8');
        return provider;
      }
    } catch (e) {}

    try {
      const userRaw = fs.readFileSync(usersFilePath, 'utf8');
      const users = JSON.parse(userRaw || '[]');
      const user = users.find(u => String(u.id).toLowerCase() === String(id).toLowerCase());
      if (user && user.role === 'vendor') {
        user.verified = isVerified;
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
        return user;
      }
    } catch (e) {}

    return null;
  }
};
