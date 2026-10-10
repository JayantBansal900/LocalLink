import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { getAllUsers, updateUserStatus, createGovernmentOfficer } from '../services/authService.js';
import { providerService } from '../services/providerService.js';
import { issueService } from '../services/issueService.js';
import { requestService } from '../services/requestService.js';

const router = express.Router();

function sanitize(str, max = 2000) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, max);
}

// Enforce both Authentication and Platform Admin role on all endpoints in this router
router.use(requireAuth, requireRole('platform_admin', 'admin'));

// GET /api/admin/stats - Real platform-wide statistics calculated directly from persisted files
router.get('/stats', (req, res) => {
  try {
    const allUsers = getAllUsers();
    const allProviders = providerService.getAll();
    const allIssues = issueService.getAll();
    const allRequests = requestService.getAll();

    // 1. Users Analytics
    const totalCustomers = allUsers.filter(u => u.role === 'customer').length;
    const totalVendors = allUsers.filter(u => u.role === 'vendor').length;
    const totalGovOfficers = allUsers.filter(u => u.role === 'government_officer').length;
    const activeUsers = allUsers.filter(u => u.status === 'active').length;
    const inactiveUsers = allUsers.filter(u => u.status !== 'active').length;

    // 2. Services Analytics
    const verifiedVendors = allProviders.filter(p => p.verified).length;
    const unverifiedVendors = allProviders.filter(p => !p.verified).length;
    const pendingRequests = allRequests.filter(r => (r.status || '').toLowerCase() === 'pending').length;
    const acceptedRequests = allRequests.filter(r => (r.status || '').toLowerCase() === 'accepted').length;
    const rejectedRequests = allRequests.filter(r => (r.status || '').toLowerCase() === 'rejected').length;
    const completedRequests = allRequests.filter(r => (r.status || '').toLowerCase() === 'completed').length;

    // 3. Community / Civic Analytics
    const issueStats = issueService.getStats();
    // 4. Geographic Location Activity Distribution
    const stateCounts = {};
    const cityCounts = {};

    // Count providers by state/city
    for (const p of allProviders) {
      const st = p.state || 'Other';
      const ct = p.city || 'Other';
      stateCounts[st] = (stateCounts[st] || 0) + 1;
      cityCounts[ct] = (cityCounts[ct] || 0) + 1;
    }

    // Count issues by state/city
    for (const i of allIssues) {
      const st = i.location?.state || 'Other';
      const ct = i.location?.city || 'Other';
      stateCounts[st] = (stateCounts[st] || 0) + 1;
      cityCounts[ct] = (cityCounts[ct] || 0) + 1;
    }

    // Convert to sorted arrays
    const locationActivity = Object.entries(stateCounts)
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count);

    const topCities = Object.entries(cityCounts)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    res.json({
      success: true,
      data: {
        users: {
          total: allUsers.length,
          totalCustomers,
          totalVendors,
          totalGovOfficers,
          activeUsers,
          inactiveUsers
        },
        services: {
          totalProviders: allProviders.length,
          verifiedVendors,
          unverifiedVendors,
          totalRequests: allRequests.length,
          pendingRequests,
          acceptedRequests,
          rejectedRequests,
          completedRequests
        },
        community: issueStats,
        locations: {
          states: locationActivity,
          topCities
        }
      }
    });
  } catch (err) {
    console.error('Admin stats calculation error:', err);
    res.status(500).json({ success: false, message: 'Failed to compute platform statistics' });
  }
});

// GET /api/admin/users
router.get('/users', (req, res) => {
  try {
    const { role, search } = req.query;
    let list = getAllUsers();

    if (role && role !== 'all') {
      const rLower = role.toLowerCase().trim();
      list = list.filter(u => String(u.role).toLowerCase() === rLower);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(u => 
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q)) ||
        (u.company && u.company.toLowerCase().includes(q)) ||
        (u.organization && u.organization.toLowerCase().includes(q))
      );
    }

    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve users' });
  }
});

// POST /api/admin/users/officer - Provision Government Officer account
router.post('/users/officer', (req, res) => {
  try {
    const { name, email, phone, password, organization, department, designation, permissions, state, city } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }
    if (!organization || !organization.trim()) {
      return res.status(400).json({ success: false, message: 'Organization is mandatory for government officer accounts' });
    }

    const officer = createGovernmentOfficer({
      name: sanitize(name, 100),
      email: sanitize(email, 120),
      phone: sanitize(phone, 30),
      password,
      organization: sanitize(organization, 150),
      department: sanitize(department, 150),
      designation: sanitize(designation, 100),
      permissions: Array.isArray(permissions) ? permissions : (permissions ? [permissions] : ['CIVIC_OFFICER']),
      location: {
        state: sanitize(state, 50) || 'Delhi',
        city: sanitize(city, 50) || 'Delhi'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Government Officer account created and provisioned successfully',
      data: officer
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/users/:id/status
router.patch('/users/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'deactivated', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const updated = updateUserStatus(req.params.id, status);
    res.json({
      success: true,
      message: `User status changed to ${status}`,
      data: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/admin/vendors
router.get('/vendors', (req, res) => {
  try {
    const vendors = providerService.getAll();
    res.json({ success: true, count: vendors.length, data: vendors });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve vendors' });
  }
});

// PATCH /api/admin/vendors/:id/verify
router.patch('/vendors/:id/verify', (req, res) => {
  try {
    const { verified } = req.body;
    const isVerified = Boolean(verified !== false);
    const updated = providerService.updateVerification(req.params.id, isVerified);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    res.json({
      success: true,
      message: `Vendor verification status updated to ${isVerified ? 'Verified' : 'Unverified'}`,
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update vendor verification' });
  }
});

// GET /api/admin/issues - Platform Admin oversight view
router.get('/issues', (req, res) => {
  try {
    const list = issueService.getAll();
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve community issues' });
  }
});

// GET /api/admin/activity - User-specific recent activity compiled from actual persisted datasets
router.get('/activity', (req, res) => {
  try {
    const allUsers = getAllUsers();
    const allRequests = requestService.getAll();
    const allIssues = issueService.getAll();

    const activities = [];

    // 1. User registration events
    for (const u of allUsers) {
      if (u.createdAt) {
        activities.push({
          id: `act-reg-${u.id}`,
          type: 'USER_REGISTRATION',
          actor: u.name,
          actorEmail: u.email,
          actorRole: u.role,
          description: `New ${u.role.replace('_', ' ')} registered (${u.name})`,
          timestamp: u.createdAt,
          badge: 'Registration'
        });
      }
    }

    // 2. Service request events
    for (const r of allRequests) {
      activities.push({
        id: `act-req-${r.id}`,
        type: 'SERVICE_REQUEST',
        actor: r.customerName || 'Customer',
        actorEmail: r.customerContact,
        actorRole: 'customer',
        description: `Service requested: "${r.service}" for provider ${r.providerName || r.providerId} (${r.status})`,
        timestamp: r.createdAt || new Date().toISOString(),
        badge: `Booking (${r.status || 'Pending'})`
      });
    }

    // 3. Civic issue reports
    for (const i of allIssues) {
      activities.push({
        id: `act-iss-${i.id}`,
        type: 'CIVIC_ISSUE',
        actor: i.reporterName || 'Citizen',
        actorEmail: null,
        actorRole: 'customer',
        description: `Civic issue reported: "${i.title}" at ${i.location?.city || 'Local Area'} (${i.status})`,
        timestamp: i.createdAt || new Date().toISOString(),
        badge: `Civic Issue (${i.status})`
      });
    }

    // Sort descending by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const limit = parseInt(req.query.limit, 10) || 40;
    const sliced = activities.slice(0, limit);

    res.json({
      success: true,
      count: sliced.length,
      total: activities.length,
      data: sliced
    });
  } catch (err) {
    console.error('Error fetching admin activity:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve platform activity' });
  }
});

export default router;

