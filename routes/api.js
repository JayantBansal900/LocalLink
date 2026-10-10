import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import authRouter from './auth.js';
import adminRouter from './admin.js';
import govRouter from './government.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { issueUpload, handleIssueUpload } from '../middleware/upload.js';
import { providerService } from '../services/providerService.js';
import { issueService } from '../services/issueService.js';
import { requestService } from '../services/requestService.js';
import { locationService } from '../services/locationService.js';
import { getUserProfile, updateUserProfile, getSavedProviderIds, saveProviderForUser, removeSavedProviderForUser } from '../services/userService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

function sanitize(str, max = 2000) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, max);
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidIdentifier(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_\-\.]{1,80}$/.test(id.trim());
}

// Mount Sub-routers
router.use('/auth', authRouter);
router.use('/admin', adminRouter);
router.use('/gov', govRouter);

// --- CATEGORIES ---
router.get('/categories', (req, res) => {
  try {
    const catPath = path.join(__dirname, '..', 'data', 'categories.json');
    const categories = JSON.parse(fs.readFileSync(catPath, 'utf8') || '{}');
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve categories' });
  }
});

// --- LOCATIONS HIERARCHY ---
router.get('/locations', (req, res) => {
  try {
    const data = locationService.getAll();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve locations' });
  }
});

router.get('/locations/states', (req, res) => {
  try {
    const states = locationService.getStates();
    res.json({ success: true, data: states });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve states' });
  }
});

router.get('/locations/districts', (req, res) => {
  try {
    const { state } = req.query;
    const districts = locationService.getDistrictsByState(state);
    res.json({ success: true, data: districts });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve districts' });
  }
});

router.get('/locations/cities', (req, res) => {
  try {
    const { state, district } = req.query;
    const cities = locationService.getCities(state, district);
    res.json({ success: true, data: cities });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve cities' });
  }
});

router.get('/locations/pincodes', (req, res) => {
  try {
    const { state, district } = req.query;
    const pincodes = locationService.getPincodes(state, district);
    res.json({ success: true, data: pincodes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve pincodes' });
  }
});

// --- RESOLVE GPS COORDINATES (USE MY LOCATION) ---
router.post('/locations/resolve', async (req, res) => {
  try {
    const { latitude, longitude } = req.body || {};
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        success: false,
        message: 'Valid latitude and longitude numbers are required'
      });
    }

    const result = await locationService.resolveCoordinates(lat, lon);
    if (!result.success) {
      return res.status(result.inIndia === false ? 200 : 400).json(result);
    }

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to resolve location from coordinates' });
  }
});

router.get('/locations/resolve', async (req, res) => {
  try {
    const lat = Number(req.query.latitude ?? req.query.lat);
    const lon = Number(req.query.longitude ?? req.query.lon);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        success: false,
        message: 'Valid latitude and longitude query parameters are required'
      });
    }

    const result = await locationService.resolveCoordinates(lat, lon);
    if (!result.success) {
      return res.status(result.inIndia === false ? 200 : 400).json(result);
    }

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to resolve location from coordinates' });
  }
});

// --- USER PROFILE & OWNERSHIP ---
router.get('/users/me', requireAuth, (req, res) => {
  try {
    const profile = getUserProfile(req.user.id);
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

router.patch('/users/me', requireAuth, (req, res) => {
  try {
    const updated = updateUserProfile(req.user.id, req.body);
    res.json({ success: true, message: 'Profile updated successfully', data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// --- PROVIDERS (CONSUMER MODE) ---
router.get('/providers', (req, res) => {
  try {
    const { profession, state, district, city, pincode, location, verified, rating, search, sort, order } = req.query;
    const list = providerService.getAll({
      profession: sanitize(profession, 50),
      state: sanitize(state, 50),
      district: sanitize(district, 50),
      city: sanitize(city, 50),
      pincode: sanitize(pincode, 20),
      location: sanitize(location, 100),
      verified: sanitize(verified, 10),
      rating: sanitize(rating, 10),
      search: sanitize(search, 100),
      sort: sanitize(sort, 30),
      order: sanitize(order, 10)
    });
    res.json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (err) {
    console.error('API Error in GET /providers:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve service providers' });
  }
});

router.get('/providers/:id', (req, res) => {
  try {
    const provider = providerService.getById(req.params.id);
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Service provider not found' });
    }
    res.json({ success: true, data: provider });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve provider details' });
  }
});

// Create booking request for provider
router.post('/providers/:id/request', optionalAuth, (req, res) => {
  try {
    const provider = providerService.getById(req.params.id);
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Target service provider not found' });
    }

    const { service, preferredDate, preferredTime, message, clientName, clientContact } = req.body;
    if (!service || !preferredDate || !preferredTime) {
      return res.status(400).json({
        success: false,
        message: 'Please provide service type, preferred date, and preferred time.'
      });
    }

    const requestData = {
      providerId: provider.id,
      providerName: provider.businessName || provider.name,
      service: sanitize(service, 100),
      preferredDate: sanitize(preferredDate, 30),
      preferredTime: sanitize(preferredTime, 30),
      message: sanitize(message, 1000),
      clientName: sanitize(clientName, 100),
      clientContact: sanitize(clientContact, 50)
    };

    const newRequest = requestService.create(requestData, req.user);
    res.status(201).json({
      success: true,
      message: 'Service request created and notified to provider successfully.',
      data: newRequest
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// --- SERVICE REQUESTS (USER / VENDOR) ---
router.get('/requests', requireAuth, (req, res) => {
  try {
    // If authenticated, filter according to user role and ID
    if (req.user) {
      if (req.user.role === 'vendor') {
        const vendorRequests = requestService.getByProvider(req.user.id, req.user);
        return res.json({ success: true, count: vendorRequests.length, data: vendorRequests });
      } else if (req.user.role === 'admin' || req.user.role === 'platform_admin') {
        const all = requestService.getAll();
        return res.json({ success: true, count: all.length, data: all });
      } else {
        const userRequests = requestService.getByCustomer(req.user.id);
        return res.json({ success: true, count: userRequests.length, data: userRequests });
      }
    }

  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve service requests' });
  }
});

router.patch('/requests/:id/status', requireAuth, (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const updated = requestService.updateStatus(req.params.id, status, req.user);
    res.json({
      success: true,
      message: `Request status updated to ${status}`,
      data: updated
    });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
});

// --- SAVED PROVIDERS (CUSTOMER) ---
router.get('/user/saved-providers', requireAuth, (req, res) => {
  try {
    const savedIds = getSavedProviderIds(req.user.id);
    const all = providerService.getAll();
    const providers = all.filter(p => savedIds.includes(p.id));
    res.json({ success: true, count: providers.length, data: providers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve saved providers' });
  }
});

router.post('/user/saved-providers', requireAuth, (req, res) => {
  try {
    const { providerId } = req.body;
    if (!providerId) return res.status(400).json({ success: false, message: 'providerId is required' });
    const saved = saveProviderForUser(req.user.id, providerId);
    res.json({ success: true, message: 'Provider saved successfully', data: saved });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/user/saved-providers/:providerId', requireAuth, (req, res) => {
  try {
    const saved = removeSavedProviderForUser(req.user.id, req.params.providerId);
    res.json({ success: true, message: 'Provider removed from saved list', data: saved });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// --- COMMUNITY ISSUES ---
router.get('/issues', (req, res) => {
  try {
    const { category, state, city, pincode, status, search, sort } = req.query;
    const list = issueService.getAll({
      category: sanitize(category, 50),
      state: sanitize(state, 50),
      city: sanitize(city, 50),
      pincode: sanitize(pincode, 20),
      status: sanitize(status, 30),
      search: sanitize(search, 100),
      sort: sanitize(sort, 30)
    });

    res.json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (err) {
    console.error('API Error in GET /issues:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve community issues' });
  }
});

router.get('/issues/:id', (req, res) => {
  try {
    const issue = issueService.getById(req.params.id);
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Community issue not found' });
    }
    res.json({ success: true, data: issue });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve community issue' });
  }
});

// Return the authenticated community participant's persisted support records.
router.get('/issues-supported/me', requireAuth, requireRole('customer', 'vendor'), (req, res) => {
  const issueIds = issueService.getSupportedIssueIds(req.user.id);
  res.json({ success: true, count: issueIds.length, data: issueIds });
});

// Report new community issue with REAL image upload!
router.post('/issues/report', optionalAuth, handleIssueUpload, (req, res) => {
  try {
    const { category, title, description, location, state, district, city, pincode, contact } = req.body;

    if (!category || !title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Category, title, and detailed description are required to submit an issue report.'
      });
    }

    if (!location || !location.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Specific location / landmark is required.'
      });
    }

    if (!state || !city) {
      return res.status(400).json({
        success: false,
        message: 'State and City are required to accurately map the civic issue.'
      });
    }

    // Contact info validation
    const citizenContact = contact && contact.trim() ? contact.trim() : (req.user ? (req.user.phone || req.user.email) : null);
    if (!citizenContact) {
      return res.status(400).json({
        success: false,
        message: 'Contact information (phone or email) is required so municipal teams can coordinate on-site verification.'
      });
    }

    if (!req.file && !req.body.imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Evidence image is mandatory. Please capture a photo or choose an image file from your device.'
      });
    }

    const newIssue = issueService.reportIssue({
      category: sanitize(category, 50),
      title: sanitize(title, 150),
      description: sanitize(description, 3000),
      location: sanitize(location, 200),
      state: sanitize(state, 50),
      district: sanitize(district, 50),
      city: sanitize(city, 50),
      pincode: sanitize(pincode, 20),
      contact: sanitize(citizenContact, 100),
      imageUrl: req.body.imageUrl
    }, req.file, req.user);

    res.status(201).json({
      success: true,
      message: 'Civic issue report registered successfully with image verification.',
      data: newIssue
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Upvote issue with duplicate vote prevention
router.post('/issues/:id/upvote', requireAuth, requireRole('customer', 'vendor'), (req, res) => {
  try {
    const result = issueService.upvote(req.params.id, req.user.id);
    if (!result || !result.issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    if (result.alreadyVoted) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate vote prevented. You have already supported this civic issue.',
        data: result.issue
      });
    }

    res.json({
      success: true,
      message: 'Support recorded successfully',
      data: result.issue
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// --- DASHBOARD REAL STATS ---
router.get('/dashboard/stats', (req, res) => {
  try {
    const allProviders = providerService.getAll();
    const allIssues = issueService.getAll();
    const allRequests = requestService.getAll();

    res.json({
      success: true,
      data: {
        totalProviders: allProviders.length,
        totalIssues: allIssues.length,
        escalatedIssues: allIssues.filter(i => i.escalated).length,
        totalServiceRequests: allRequests.length,
        totalRequests: allRequests.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to calculate platform statistics' });
  }
});

// --- CONTACT & PLATFORM INQUIRIES ---
const contactMessages = [];
router.post('/contact', (req, res) => {
  try {
    const { name, email, message, subject } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and message are required'
      });
    }

    const newMsg = {
      id: `MSG-${Date.now()}`,
      name: sanitize(name, 100),
      email: sanitize(email, 120),
      subject: sanitize(subject, 150) || 'General Inquiry',
      message: sanitize(message, 3000),
      createdAt: new Date().toISOString()
    };

    contactMessages.push(newMsg);
    res.status(201).json({
      success: true,
      message: 'Thank you for reaching out! Your message has been received.',
      data: { id: newMsg.id }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit contact message' });
  }
});

export default router;
