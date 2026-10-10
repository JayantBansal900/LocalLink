import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const requestsFilePath = path.join(__dirname, '..', 'data', 'requests.json');

function loadRequests() {
  try {
    if (!fs.existsSync(requestsFilePath)) {
      fs.writeFileSync(requestsFilePath, '[]', 'utf8');
      return [];
    }
    const raw = fs.readFileSync(requestsFilePath, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Error loading requests:', err);
    return [];
  }
}

function saveRequests(requests) {
  try {
    fs.writeFileSync(requestsFilePath, JSON.stringify(requests, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving requests:', err);
    return false;
  }
}

export const requestService = {
  create: (data, user) => {
    const { providerId, providerName, service, preferredDate, preferredTime, message, clientName, clientContact } = data;

    if (!providerId || !service || !preferredDate || !preferredTime) {
      throw new Error('Provider, service type, preferred date, and preferred time are required');
    }

    const requests = loadRequests();
    const newRequest = {
      id: `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerId: user ? user.id : 'USR-GUEST',
      customerName: user ? user.name : (clientName || 'Valued Customer'),
      customerContact: user ? (user.phone || user.email) : (clientContact || 'Provided upon booking'),
      providerId: String(providerId).trim(),
      providerName: providerName || 'LocalLink Provider',
      service: service.trim(),
      preferredDate: preferredDate.trim(),
      preferredTime: preferredTime.trim(),
      message: (message || '').trim(),
      status: 'Pending', // Pending, Accepted, Rejected, Completed, Cancelled
      createdAt: new Date().toISOString()
    };

    requests.unshift(newRequest);
    saveRequests(requests);
    return newRequest;
  },

  getAll: () => {
    return loadRequests();
  },

  getByCustomerId: (customerId) => {
    const requests = loadRequests();
    return requests.filter(r => r.customerId === customerId);
  },

  getByCustomer: (customerId) => {
    return requestService.getByCustomerId(customerId);
  },

  getByVendorId: (vendorId, user = null) => {
    const requests = loadRequests();
    const vId = String(vendorId).toLowerCase();
    const bName = user && user.businessName ? String(user.businessName).toLowerCase() : null;
    const uName = user && user.name ? String(user.name).toLowerCase() : null;
    return requests.filter(r => 
      String(r.providerId).toLowerCase() === vId ||
      (bName && r.providerName && String(r.providerName).toLowerCase() === bName) ||
      (uName && r.providerName && String(r.providerName).toLowerCase() === uName) ||
      (r.providerName && r.providerName.toLowerCase().includes(vId))
    );
  },

  getByProvider: (vendorId, user = null) => {
    return requestService.getByVendorId(vendorId, user);
  },

  updateStatus: (requestId, status, user) => {
    const validStatuses = ['Pending', 'Accepted', 'Rejected', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      const err = new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      err.status = 400;
      throw err;
    }

    const requests = loadRequests();
    const index = requests.findIndex(r => r.id === requestId);
    if (index === -1) {
      const err = new Error('Service request not found');
      err.status = 404;
      throw err;
    }

    const req = requests[index];

    // Authorization: only the assigned provider, customer (to cancel), or admin can update
    const userRole = (user && user.role ? user.role : '').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'platform_admin') {
      const isCustomer = user && req.customerId === user.id;
      const isAssignedVendor = user && user.role === 'vendor' && (
        String(req.providerId).toLowerCase() === String(user.id).toLowerCase() ||
        (user.businessName && req.providerName && req.providerName.toLowerCase() === user.businessName.toLowerCase()) ||
        (user.name && req.providerName && req.providerName.toLowerCase() === user.name.toLowerCase()) ||
        (user.email && req.providerEmail && req.providerEmail.toLowerCase() === user.email.toLowerCase())
      );

      // Rule: Customer cannot modify vendor-only status
      if (isCustomer && status !== 'Cancelled') {
        const err = new Error('Customer cannot modify vendor-only status. Customers can only cancel pending requests.');
        err.status = 403;
        throw err;
      }

      if (isCustomer && req.status !== 'Pending') {
        const err = new Error('Customers can only cancel pending requests.');
        err.status = 400;
        throw err;
      }

      // Rule: Vendor cannot modify another vendor's requests
      if (user && user.role === 'vendor' && !isAssignedVendor) {
        const err = new Error("Access denied: Vendors cannot modify another vendor's service requests.");
        err.status = 403;
        throw err;
      }

      // Rule: General unauthorized access
      if (!isAssignedVendor && !isCustomer) {
        const err = new Error('You do not have permission to update this service request');
        err.status = 403;
        throw err;
      }

      if (isAssignedVendor) {
        const allowedTransitions = {
          Pending: ['Accepted', 'Rejected'],
          Accepted: ['Completed']
        };
        if (!(allowedTransitions[req.status] || []).includes(status)) {
          const err = new Error(`Cannot change a ${req.status} request to ${status}.`);
          err.status = 400;
          throw err;
        }
      }
    }

    req.status = status;
    req.updatedAt = new Date().toISOString();
    saveRequests(requests);
    return req;
  },

  getAll: () => {
    return loadRequests();
  }
};
