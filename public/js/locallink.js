// LocalLink - Unified Client Utilities
// Clean, Black/White/Grey Minimal Civic-Tech MVP System

(function() {
  function initLocalLink() {
    // 1. Highlight active navigation link
    highlightActiveNav();

    // 2. Sync authentication header state and navigation
    syncAuthHeader();

    // 3. Modal escape key listener
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const openModals = document.querySelectorAll('.modal-backdrop.open, .ll-modal-backdrop.open');
        openModals.forEach(modal => {
          if (modal) modal.classList.remove('open');
        });
      }
    });

    // 4. Background verification of auth session with server
    verifyServerSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLocalLink);
  } else {
    initLocalLink();
  }

  function highlightActiveNav() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-pill, .ll-nav-link');
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        const isDashboardRoute = href === '/dashboard' && (currentPath === '/dashboard' || currentPath === '/admin');
        if (href === currentPath || isDashboardRoute) {
          link.classList.add('active');
        } else if (href !== '/' && currentPath.startsWith(href)) {
          link.classList.add('active');
        } else if (href === '/' && (currentPath === '/' || currentPath === '/index.html' || currentPath === '/home')) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      }
    });
  }

  // Verify session with backend API
  async function verifyServerSession() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data && json.data.user) {
          localStorage.setItem('locallink_user', JSON.stringify(json.data.user));
          syncAuthHeader();
        }
      } else if (res.status === 401) {
        // If server says unauthorized, clear client state
        if (localStorage.getItem('locallink_user')) {
          localStorage.removeItem('locallink_user');
          syncAuthHeader();
        }
      }
    } catch (e) {
      // Offline or network error: retain local cache
    }
  }

  function syncPrimaryNavigation() {
    const primaryLinks = [
      { href: '/', label: 'Home' },
      { href: '/services', label: 'Consumer Mode' },
      { href: '/community', label: 'Community Mode' },
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/contact', label: 'Contact' }
    ];

    const navBars = document.querySelectorAll('.header .navigation, .ll-header .ll-nav');
    navBars.forEach(nav => {
      nav.replaceChildren(...primaryLinks.map(({ href, label }) => {
        const link = document.createElement('a');
        link.href = href;
        link.className = nav.classList.contains('ll-nav') ? 'll-nav-link' : 'nav-pill';
        link.textContent = label;
        return link;
      }));
    });

    highlightActiveNav();
  }

  // Sync the fixed primary navigation and role-aware authentication controls
  window.syncAuthHeader = function() {
    let user = null;
    try {
      const stored = localStorage.getItem('locallink_user');
      if (stored) user = JSON.parse(stored);
    } catch(e) {}

    syncPrimaryNavigation();

    // Update Auth Slot non-destructively
    const authContainers = document.querySelectorAll('.header .auth, .ll-header .ll-nav-actions');
    authContainers.forEach(container => {
      // Find or create dedicated auth slot
      let authSlot = container.querySelector('#ll-auth-slot');
      if (!authSlot) {
        // Check if there is already an existing non-auth action button (e.g. openReportModalBtn, back button)
        const existingActions = container.querySelectorAll('#openReportModalBtn, a[href^="/services"], a[href^="/community"]');
        
        authSlot = document.createElement('div');
        authSlot.id = 'll-auth-slot';
        authSlot.style.display = 'inline-flex';
        authSlot.style.alignItems = 'center';
        authSlot.style.gap = '16px';

        // If there were existing plain signin/register buttons, replace them with authSlot
        const signinBtn = container.querySelector('#signin-btn, a[href="/login"]');
        const registerBtn = container.querySelector('#register-btn, a[href="/signup"]');

        if (signinBtn || registerBtn) {
          if (signinBtn) signinBtn.remove();
          if (registerBtn) registerBtn.remove();
          container.appendChild(authSlot);
        } else if (existingActions.length > 0) {
          // Keep existing action button and prepend or append authSlot
          container.appendChild(authSlot);
        } else {
          container.appendChild(authSlot);
        }
      }

      if (user && (user.name || user.email)) {
        const role = String(user.role || '').toLowerCase();
        const roleDisplay = {
          admin: 'Admin',
          platform_admin: 'Admin',
          government_officer: 'Government Officer',
          vendor: 'Vendor',
          provider: 'Vendor',
          customer: 'Citizen',
          citizen: 'Citizen'
        }[role] || 'Account';
        const targetUrl = (role === 'admin' || role === 'platform_admin') ? '/admin' : '/dashboard';

        authSlot.innerHTML = `
          <a href="${targetUrl}" class="header-role-pill" title="Go to Dashboard">${roleDisplay}</a>
          <button type="button" class="button" onclick="locallinkLogout()" style="padding: 10px 20px; font-size: 15px; background: #ffffff; color: #000000; border: 2px solid #000000; border-radius: 12px; cursor: pointer;">
            Sign Out
          </button>
        `;
      } else {
        authSlot.innerHTML = `
          <a href="/login" class="button" id="signin-btn" style="padding: 12px 24px; font-size: 16px; background: #ffffff; color: #000000; border: 2px solid #000000; border-radius: 12px; text-decoration: none;">Sign in</a>
          <a href="/signup" class="button" id="register-btn" style="padding: 12px 24px; font-size: 16px; background: #000000; color: #ffffff; border: 2px solid #000000; border-radius: 12px; text-decoration: none;">Register</a>
        `;
      }
    });
  };

  // Global sign-out helper
  window.locallinkLogout = async function() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch(e) {}
    localStorage.removeItem('locallink_user');
    window.location.href = '/login';
  };

  // Global toast notification helper (Strict Black/White/Grey)
  window.showToast = function(message, type = 'success') {
    let toastContainer = document.getElementById('ll-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'll-toast-container';
      toastContainer.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
      document.body.appendChild(toastContainer);
    }

    const duplicateToast = [...toastContainer.children].find(toast => toast.dataset.message === message);
    if (duplicateToast) return;

    const toast = document.createElement('div');
    toast.dataset.message = message;
    toast.style.cssText = `
      background: #000000;
      color: #ffffff;
      border: 2px solid #333333;
      padding: 12px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      font-size: 14px;
      font-weight: 500;
      pointer-events: auto;
      transition: all 0.3s ease;
      transform: translateY(20px);
      opacity: 0;
      font-family: inherit;
    `;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  };
})();
