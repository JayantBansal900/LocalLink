import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, requirePermission } from '../middleware/role.js';
import { issueService } from '../services/issueService.js';

const router = express.Router();

function sanitize(str, max = 2000) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, max);
}

// Enforce authentication and Government Officer (or Admin) role on all /api/gov endpoints
router.use(requireAuth, requireRole('government_officer', 'admin'));

// GET /api/gov/stats - High-level metrics for civic governance
router.get('/stats', (req, res) => {
  try {
    const issueStats = issueService.getStats();

    res.json({
      success: true,
      data: {
        officer: {
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          department: req.user.department || 'Municipal Administration',
          organization: req.user.organization || 'Civic Authority',
          permissions: req.user.permissions || []
        },
        civic: issueStats
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve governance metrics' });
  }
});

// Helper to verify if Government Officer has authority over a specific issue
function isOfficerAuthorizedForIssue(officer, issue) {
  if (!officer || !issue) return false;
  const userRole = (officer.role || '').toLowerCase();
  // Super access for platform admin
  if (userRole === 'platform_admin' || userRole === 'admin') return true;

  // 1. Organization assignment check
  if (issue.assignedOrg && officer.organization) {
    if (issue.assignedOrg.toLowerCase() !== officer.organization.toLowerCase()) {
      return false;
    }
  }

  // 2. Geographic jurisdiction check:
  // An officer only has jurisdiction over issues in their designated state/location
  if (officer.location?.state && issue.location?.state) {
    if (officer.location.state.toLowerCase() !== issue.location.state.toLowerCase()) {
      return false;
    }
  }

  return true;
}

// ==========================================
// CIVIC ISSUE GOVERNANCE (CIVIC_OFFICER)
// ==========================================

// GET /api/gov/issues - List issues with status filtering for municipal officers
router.get('/issues', requirePermission('CIVIC_OFFICER'), (req, res) => {
  try {
    const { status, category, state, city, search } = req.query;
    let list = issueService.getAll({
      category: sanitize(category, 50),
      state: sanitize(state, 50),
      city: sanitize(city, 50),
      search: sanitize(search, 100)
    });

    // Enforce organization & geographic jurisdiction isolation
    list = list.filter(i => isOfficerAuthorizedForIssue(req.user, i));

    if (status && status !== 'all') {
      const sLower = status.toLowerCase().trim();
      list = list.filter(i => {
        const issueStat = (i.status || '').toLowerCase();
        if (sLower === 'escalated') return i.escalated || issueStat.includes('escalat');
        return issueStat.includes(sLower);
      });
    }

    res.json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve civic issues for review' });
  }
});

// PATCH /api/gov/issues/:id/status - Progress issue lifecycle with officer timeline note
router.patch('/issues/:id/status', requirePermission('CIVIC_OFFICER'), (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const issue = issueService.getById(req.params.id);
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Civic issue not found' });
    }

    // Check organization and geographic jurisdiction
    if (!isOfficerAuthorizedForIssue(req.user, issue)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You cannot access or modify civic issues outside your assigned organization and geographic jurisdiction.'
      });
    }

    const cleanStatus = sanitize(status, 50);
    const cleanNotes = sanitize(notes, 1000);
    const updated = issueService.officerUpdateStatus(
      req.params.id,
      cleanStatus,
      cleanNotes,
      req.user
    );

    res.json({
      success: true,
      message: `Civic issue status updated to "${updated.status}"`,
      data: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
