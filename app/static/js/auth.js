/* ============================================================
   ShopVault — Authentication Module (auth.js)
   Handles login, register, logout, and UI state.
   NEVER uses innerHTML — all DOM via textContent / createElement.
   ============================================================ */

(function () {
    'use strict';

    /**
     * Parse JWT payload from an access token (base64url decode).
     * Only used to read non-sensitive claims like role/email.
     * @param {string} token
     * @returns {object|null}
     */
    function parseJWT(token) {
        try {
            var parts = token.split('.');
            if (parts.length !== 3) return null;
            var payload = parts[1];
            // Base64url → Base64
            payload = payload.replace(/-/g, '+').replace(/_/g, '/');
            var decoded = atob(payload);
            return JSON.parse(decoded);
        } catch (_e) {
            return null;
        }
    }

    /**
     * Initialize authentication state on page load.
     * Attempts silent refresh; if successful show logged-in UI.
     */
    async function initAuth() {
        // Wire up event listeners
        setupEventListeners();

        // Attempt silent refresh
        var refreshed = await window.API.silentRefresh();
        if (refreshed) {
            var claims = parseJWT(window.API.getAccessToken());
            var role = claims ? (claims.role || 'customer') : 'customer';
            var email = claims ? (claims.sub || '') : '';
            updateAuthUI(true, role, email);
            showView('catalog');
        } else {
            updateAuthUI(false, 'customer', '');
            showView('catalog');
        }
    }

    /**
     * Set up all auth-related event listeners.
     */
    function setupEventListeners() {
        // Login form
        var loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }

        // Register form
        var registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', handleRegister);
        }

        // Logout button
        var logoutBtn = document.getElementById('nav-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }

        // Login nav button
        var loginBtn = document.getElementById('nav-login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', function (e) {
                e.preventDefault();
                showView('auth');
            });
        }

        // Auth tabs
        var loginTab = document.getElementById('login-tab');
        var registerTab = document.getElementById('register-tab');
        var loginFormEl = document.getElementById('login-form');
        var registerFormEl = document.getElementById('register-form');

        if (loginTab && registerTab) {
            loginTab.addEventListener('click', function () {
                loginTab.classList.add('active');
                registerTab.classList.remove('active');
                if (loginFormEl) loginFormEl.classList.remove('hidden');
                if (registerFormEl) registerFormEl.classList.add('hidden');
            });

            registerTab.addEventListener('click', function () {
                registerTab.classList.add('active');
                loginTab.classList.remove('active');
                if (registerFormEl) registerFormEl.classList.remove('hidden');
                if (loginFormEl) loginFormEl.classList.add('hidden');
            });
        }
    }

    /**
     * Handle login form submission.
     * @param {Event} e
     */
    async function handleLogin(e) {
        e.preventDefault();

        var emailInput = document.getElementById('login-email');
        var passwordInput = document.getElementById('login-password');
        var email = emailInput.value.trim();
        var password = passwordInput.value;

        if (!email || !password) {
            window.API.showToast('Please fill in all fields', 'error');
            return;
        }

        try {
            var data = await window.API.apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: email, password: password })
            });

            window.API.setAccessToken(data.access_token);

            var claims = parseJWT(data.access_token);
            var role = claims ? (claims.role || 'customer') : 'customer';
            var userEmail = claims ? (claims.sub || email) : email;

            updateAuthUI(true, role, userEmail);
            window.API.showToast('Welcome back!', 'success');
            showView('catalog');

            // Clear form
            emailInput.value = '';
            passwordInput.value = '';
        } catch (err) {
            window.API.showToast(err.message || 'Login failed', 'error');
        }
    }

    /**
     * Handle register form submission.
     * @param {Event} e
     */
    async function handleRegister(e) {
        e.preventDefault();

        var emailInput = document.getElementById('register-email');
        var passwordInput = document.getElementById('register-password');
        var email = emailInput.value.trim();
        var password = passwordInput.value;

        if (!email || !password) {
            window.API.showToast('Please fill in all fields', 'error');
            return;
        }

        if (password.length < 8) {
            window.API.showToast('Password must be at least 8 characters', 'error');
            return;
        }

        try {
            await window.API.apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ email: email, password: password })
            });

            window.API.showToast('Account created! Signing you in…', 'success');

            // Auto-login after successful registration
            var loginData = await window.API.apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: email, password: password })
            });

            window.API.setAccessToken(loginData.access_token);

            var claims = parseJWT(loginData.access_token);
            var role = claims ? (claims.role || 'customer') : 'customer';
            var userEmail = claims ? (claims.sub || email) : email;

            updateAuthUI(true, role, userEmail);
            showView('catalog');

            // Clear form
            emailInput.value = '';
            passwordInput.value = '';
        } catch (err) {
            window.API.showToast(err.message || 'Registration failed', 'error');
        }
    }

    /**
     * Handle logout.
     */
    async function handleLogout() {
        try {
            await window.API.apiFetch('/auth/logout', {
                method: 'POST'
            });
        } catch (_err) {
            // Logout endpoint may fail — still clear local state
        }

        window.API.clearAccessToken();
        updateAuthUI(false, 'customer', '');
        window.API.showToast('Signed out successfully', 'info');
        showView('catalog');
    }

    /**
     * Update the navbar and views based on authentication state.
     * @param {boolean} isLoggedIn
     * @param {string} role
     * @param {string} email
     */
    function updateAuthUI(isLoggedIn, role, email) {
        var loginBtn = document.getElementById('nav-login-btn');
        var logoutBtn = document.getElementById('nav-logout-btn');
        var ordersLink = document.getElementById('nav-orders');
        var adminLink = document.getElementById('nav-admin');
        var userEmailEl = document.getElementById('nav-user-email');

        if (isLoggedIn) {
            if (loginBtn) loginBtn.classList.add('hidden');
            if (logoutBtn) logoutBtn.classList.remove('hidden');
            if (ordersLink) ordersLink.classList.remove('hidden');
            if (userEmailEl) {
                userEmailEl.classList.remove('hidden');
                userEmailEl.textContent = email || '';
            }

            // Show admin link only for admin role
            if (adminLink) {
                if (role === 'admin') {
                    adminLink.classList.remove('hidden');
                } else {
                    adminLink.classList.add('hidden');
                }
            }
        } else {
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (logoutBtn) logoutBtn.classList.add('hidden');
            if (ordersLink) ordersLink.classList.add('hidden');
            if (adminLink) adminLink.classList.add('hidden');
            if (userEmailEl) {
                userEmailEl.classList.add('hidden');
                userEmailEl.textContent = '';
            }
        }
    }

    // Expose public API
    window.Auth = {
        initAuth: initAuth,
        handleLogout: handleLogout,
        updateAuthUI: updateAuthUI
    };
})();
