/* ============================================================
   ShopVault — API Layer (api.js)
   Secure fetch wrapper with in-memory token management.
   NEVER stores tokens in localStorage/sessionStorage.
   ============================================================ */

(function () {
    'use strict';

    // Module-scoped access token — NEVER stored in localStorage
    let accessToken = null;

    const API_BASE = (window.API_BASE_URL || '') + '/api/v1';

    /**
     * Store the access token in memory.
     * @param {string} token
     */
    function setAccessToken(token) {
        accessToken = token;
    }

    /**
     * Retrieve the in-memory access token.
     * @returns {string|null}
     */
    function getAccessToken() {
        return accessToken;
    }

    /**
     * Clear the in-memory access token.
     */
    function clearAccessToken() {
        accessToken = null;
    }

    /**
     * Authenticated fetch wrapper with automatic silent-refresh on 401.
     * @param {string} endpoint - API endpoint (e.g. '/products')
     * @param {object} options  - Standard fetch options
     * @returns {Promise<any>}
     */
    async function apiFetch(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        // Attach access token if available
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const config = {
            ...options,
            headers,
            credentials: 'include' // send httpOnly refresh cookie
        };

        let response = await fetch(url, config);

        // If 401, attempt silent refresh exactly once
        if (response.status === 401 && !options._retried) {
            const refreshed = await silentRefresh();
            if (refreshed) {
                headers['Authorization'] = `Bearer ${accessToken}`;
                const retryConfig = {
                    ...options,
                    headers,
                    credentials: 'include',
                    _retried: true
                };
                response = await fetch(url, retryConfig);
            }
        }

        if (!response.ok) {
            const error = await response.json().catch(function () {
                return { detail: 'Request failed' };
            });
            throw new Error(error.detail || 'HTTP ' + response.status);
        }

        // 204 No Content
        if (response.status === 204) return null;

        return response.json();
    }

    /**
     * Attempt to refresh the access token using the httpOnly refresh cookie.
     * @returns {Promise<boolean>}
     */
    async function silentRefresh() {
        try {
            const response = await fetch(API_BASE + '/auth/refresh', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                const data = await response.json();
                accessToken = data.access_token;
                return true;
            }
            return false;
        } catch (_err) {
            return false;
        }
    }

    /**
     * Display a toast notification.
     * Uses textContent exclusively — never innerHTML.
     * @param {string} message
     * @param {'success'|'error'|'info'} type
     */
    function showToast(message, type) {
        if (typeof type === 'undefined') type = 'info';

        var container = document.getElementById('toast-container');
        if (!container) return;

        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;

        var icon = document.createElement('span');
        icon.className = 'toast-icon';
        if (type === 'success') {
            icon.textContent = '✓';
        } else if (type === 'error') {
            icon.textContent = '✕';
        } else {
            icon.textContent = 'ℹ';
        }

        var text = document.createElement('span');
        text.className = 'toast-message';
        text.textContent = message; // Safe: textContent, not innerHTML

        toast.appendChild(icon);
        toast.appendChild(text);
        container.appendChild(toast);

        // Auto-remove after 3 seconds
        setTimeout(function () {
            toast.classList.add('toast-exit');
            setTimeout(function () {
                if (toast.parentNode) toast.remove();
            }, 300);
        }, 3000);
    }

    // Expose public API on window
    window.API = {
        apiFetch: apiFetch,
        setAccessToken: setAccessToken,
        getAccessToken: getAccessToken,
        clearAccessToken: clearAccessToken,
        silentRefresh: silentRefresh,
        showToast: showToast
    };
})();
