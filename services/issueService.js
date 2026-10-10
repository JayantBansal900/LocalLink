import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const issuesFilePath = path.join(__dirname, '..', 'data', 'issues.json');

// In-memory or file-backed set of user upvotes to prevent duplicate votes
// Key: `${issueId}:${userIdOrIp}`
const upvoteRecords = new Set();

function loadIssues() {
  try {
    if (!fs.existsSync(issuesFilePath)) {
      fs.writeFileSync(issuesFilePath, '[]', 'utf8');
      return [];
    }
    const raw = fs.readFileSync(issuesFilePath, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Error loading issues:', err);
    return [];
  }
}

function saveIssues(issues) {
  try {
    fs.writeFileSync(issuesFilePath, JSON.stringify(issues, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving issues:', err);
    return false;
  }
}

export const issueService = {
  getAll: (filters = {}) => {
    let list = loadIssues();
    const { category, state, city, pincode, status, search, sort = 'upvotes-desc' } = filters;

    if (category && category !== 'all') {
      const catLower = category.toLowerCase();
      list = list.filter(i => (i.category || '').toLowerCase().includes(catLower));
    }

    if (state && state !== 'all') {
      const stateLower = state.toLowerCase();
      list = list.filter(i => (i.location?.state || '').toLowerCase() === stateLower);
    }

    if (city && city !== 'all') {
      const cityLower = city.toLowerCase();
      list = list.filter(i => (i.location?.city || '').toLowerCase() === cityLower);
    }

    if (pincode && pincode !== 'all') {
      list = list.filter(i => (i.location?.pincode || '') === pincode);
    }

    if (status && status !== 'all') {
      const statusLower = status.toLowerCase();
      list = list.filter(i => (i.status || '').toLowerCase().includes(statusLower));
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(i =>
        (i.title && i.title.toLowerCase().includes(q)) ||
        (i.description && i.description.toLowerCase().includes(q)) ||
        (i.category && i.category.toLowerCase().includes(q)) ||
        (i.location?.city && i.location.city.toLowerCase().includes(q)) ||
        (i.location?.state && i.location.state.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sort === 'upvotes-desc') {
      list.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
    } else if (sort === 'date-desc') {
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (sort === 'date-asc') {
      list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    }

    return list;
  },

  getById: (id) => {
    const list = loadIssues();
    const idLower = String(id).toLowerCase();
    return list.find(i => 
      String(i.id).toLowerCase() === idLower || 
      (i.slug && i.slug.toLowerCase() === idLower)
    ) || null;
  },

  reportIssue: (data, file, user) => {
    const { category, title, description, location, state, district, city, pincode, contact } = data;

    if (!category || !title || !description) {
      throw new Error('Category, title, and detailed description are required fields');
    }

    if (title.trim().length < 5) {
      throw new Error('Title must be at least 5 characters long');
    }

    if (description.trim().length < 10) {
      throw new Error('Description must be at least 10 characters long');
    }

    if (!location || !location.trim()) {
      throw new Error('Specific location / landmark is required to locate the issue');
    }

    if (!state || !city) {
      throw new Error('State and City are required to accurately map the civic issue');
    }

    // Contact info validation
    const contactInfo = contact && contact.trim() ? contact.trim() : (user ? (user.phone || user.email) : null);
    if (!contactInfo) {
      throw new Error('Contact information (phone or email) is required so municipal teams can coordinate on-site verification');
    }

    let imageUrl = null;
    if (file) {
      imageUrl = `/uploads/issues/${file.filename}`;
    } else if (data.imageUrl && (data.imageUrl.startsWith('/uploads/') || data.imageUrl.startsWith('http') || data.imageUrl.startsWith('/assets/'))) {
      imageUrl = data.imageUrl;
    } else {
      throw new Error('Evidence image is mandatory. Please capture or upload a clear photo of the hazard.');
    }

    const issues = loadIssues();
    const newId = `ISS-${Date.now()}`;
    const newIssue = {
      id: newId,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50),
      title: title.trim(),
      category: category.trim(),
      description: description.trim(),
      location: {
        address: location.trim(),
        state: state.trim(),
        district: (district || city).trim(),
        city: city.trim(),
        pincode: (pincode || '110001').trim()
      },
      contact: contactInfo,
      imageUrl,
      upvotes: 1, // Initial reporter upvote
      threshold: 5,
      escalated: false,
      status: 'Community Voting',
      timeline: [
        {
          status: 'Community Voting',
          notes: 'Civic issue report filed with photo evidence. Community voting opened.',
          officer: 'Citizen Reported',
          date: new Date().toISOString()
        }
      ],
      reportedBy: user ? user.id : 'USR-GUEST',
      reporterName: user ? user.name : 'Verified Citizen',
      voters: [user ? user.id.toLowerCase() : 'reporter'],
      createdAt: new Date().toISOString()
    };

    issues.unshift(newIssue);
    saveIssues(issues);

    // Record reporter upvote
    const voteKey = `${newId}:${user ? user.id.toLowerCase() : 'reporter'}`;
    upvoteRecords.add(voteKey);

    return newIssue;
  },

  upvoteIssue: (id, voterIdentifier) => {
    const issues = loadIssues();
    const idLower = String(id).toLowerCase();
    const index = issues.findIndex(i => 
      String(i.id).toLowerCase() === idLower || 
      (i.slug && i.slug.toLowerCase() === idLower)
    );

    if (index === -1) {
      throw new Error('Issue not found');
    }

    const issue = issues[index];
    if (!issue.voters) {
      issue.voters = [];
    }

    const vId = String(voterIdentifier).trim().toLowerCase();
    const voteKey = `${issue.id}:${vId}`;

    if (upvoteRecords.has(voteKey) || issue.voters.includes(vId)) {
      return { issue, alreadyVoted: true };
    }

    issue.upvotes = (issue.upvotes || 0) + 1;
    issue.voters.push(vId);
    upvoteRecords.add(voteKey);

    // Threshold escalation check (threshold: 5)
    // CRITICAL: Escalation must NOT mean resolution!
    if (issue.upvotes >= (issue.threshold || 5) && !issue.escalated) {
      issue.escalated = true;
      issue.status = 'Escalated';
      if (!issue.timeline) issue.timeline = [];
      issue.timeline.push({
        status: 'Escalated',
        notes: `Community support threshold reached (${issue.upvotes} verified citizen votes). Escalated to municipal administration for official inspection.`,
        officer: 'System Automation',
        date: new Date().toISOString()
      });
    }

    saveIssues(issues);
    return { issue, alreadyVoted: false };
  },

  // Government Officer updates civic issue status
  officerUpdateStatus: (id, status, notes = '', officer = null) => {
    const validStatuses = [
      'Community Voting',
      'Escalated',
      'Under Review',
      'Verified',
      'In Progress',
      'Resolved',
      'Closed',
      'Rejected / Invalid'
    ];

    const match = validStatuses.find(s => s.toLowerCase() === String(status).toLowerCase().trim());
    if (!match) {
      throw new Error(`Invalid issue status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const issues = loadIssues();
    const idLower = String(id).toLowerCase();
    const index = issues.findIndex(i => 
      String(i.id).toLowerCase() === idLower || 
      (i.slug && i.slug.toLowerCase() === idLower)
    );

    if (index === -1) throw new Error('Issue not found');

    const issue = issues[index];
    if (['Closed', 'Rejected / Invalid'].includes(issue.status)) {
      throw new Error(`Cannot update an issue that is already ${issue.status}`);
    }
    issue.status = match;
    if (match === 'Escalated') {
      issue.escalated = true;
    }

    if (!issue.timeline) {
      issue.timeline = [];
    }

    const officerName = officer ? (officer.name || officer.email) : 'Government Officer';
    const officerDept = officer ? (officer.organization || officer.department || 'Civic Authority') : 'Municipal Authority';

    // Resolution and Rejection information enforcement
    if (match === 'Resolved') {
      if (!notes || notes.trim().length < 5) {
        throw new Error('Resolution information and completion details are required when marking an issue as Resolved');
      }
      issue.resolvedAt = new Date().toISOString();
      issue.resolutionDetails = notes.trim();
    } else if (match === 'Rejected / Invalid') {
      if (!notes || notes.trim().length < 5) {
        throw new Error('Explanation notes are required when marking an issue as Rejected / Invalid');
      }
      issue.rejectedAt = new Date().toISOString();
      issue.rejectionReason = notes.trim();
    } else if (match === 'Closed') {
      issue.closedAt = new Date().toISOString();
    }

    issue.timeline.push({
      status: match,
      notes: (notes || `Status advanced to ${match} by ${officerName}`).trim(),
      officer: `${officerName} (${officerDept})`,
      date: new Date().toISOString()
    });

    issue.updatedAt = new Date().toISOString();
    saveIssues(issues);
    return issue;
  },

  adminUpdateStatus: (id, status) => {
    return issueService.officerUpdateStatus(id, status, 'Administrative update');
  },

  updateStatus: (id, status, notes = '', officer = null) => {
    return issueService.officerUpdateStatus(id, status, notes, officer);
  },

  upvote: (id, voterIdentifier) => {
    return issueService.upvoteIssue(id, voterIdentifier);
  },

  getIssuesReportedByUser: (userId) => {
    const issues = loadIssues();
    return issues.filter(i => i.reportedBy === userId);
  },

  getSupportedIssueIds: (userId) => {
    const voterId = String(userId || '').trim().toLowerCase();
    if (!voterId) return [];
    return loadIssues()
      .filter(issue => Array.isArray(issue.voters) && issue.voters.includes(voterId))
      .map(issue => issue.id);
  },

  getStats: () => {
    const issues = loadIssues();
    return {
      total: issues.length,
      voting: issues.filter(i => (i.status || '').toLowerCase().includes('voting')).length,
      escalated: issues.filter(i => i.escalated || (i.status || '').toLowerCase().includes('escalat')).length,
      underReview: issues.filter(i => (i.status || '').toLowerCase().includes('review')).length,
      verified: issues.filter(i => (i.status || '').toLowerCase().includes('verified')).length,
      inProgress: issues.filter(i => (i.status || '').toLowerCase().includes('progress')).length,
      resolved: issues.filter(i => (i.status || '').toLowerCase().includes('resolved')).length,
      closed: issues.filter(i => (i.status || '').toLowerCase().includes('closed')).length,
      rejected: issues.filter(i => (i.status || '').toLowerCase().includes('reject') || (i.status || '').toLowerCase().includes('invalid')).length
    };
  }
};

