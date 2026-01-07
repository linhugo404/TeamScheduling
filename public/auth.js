// Azure AD Authentication using MSAL.js

// Config will be loaded from server
let msalConfig = null;

// Scopes for Microsoft Graph
const loginRequest = {
    scopes: ['User.Read', 'User.Read.All', 'Directory.Read.All']
};

const graphConfig = {
    graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
    graphPhotoEndpoint: 'https://graph.microsoft.com/v1.0/me/photo/$value',
    graphUsersEndpoint: 'https://graph.microsoft.com/v1.0/users',
    graphDirectReportsEndpoint: 'https://graph.microsoft.com/v1.0/users/{id}/directReports'
};

// MSAL instance
let msalInstance = null;
let currentAccount = null;
let authConfigured = false;

// Fetch auth config from server
async function fetchAuthConfig() {
    try {
        const response = await fetch('/api/auth/config');
        const config = await response.json();
        
        if (!config.configured) {
            console.warn('Azure AD not configured on server');
            return null;
        }
        
        return {
            auth: {
                clientId: config.clientId,
                authority: config.authority,
                redirectUri: config.redirectUri,
                postLogoutRedirectUri: window.location.origin,
                navigateToLoginRequestUrl: true
            },
            cache: {
                cacheLocation: 'localStorage', // Use localStorage for better persistence
                storeAuthStateInCookie: true   // Fallback for older browsers
            },
            system: {
                loggerOptions: {
                    logLevel: msal.LogLevel.Warning
                }
            }
        };
    } catch (error) {
        console.error('Failed to fetch auth config:', error);
        return null;
    }
}

// Initialize MSAL
async function initializeMsal() {
    // Fetch config from server
    msalConfig = await fetchAuthConfig();
    
    if (!msalConfig) {
        // Azure AD not configured - skip auth and go straight to app
        console.log('Azure AD not configured, skipping authentication');
        authConfigured = false;
        hideLoginUI();
        if (typeof initApp === 'function') {
            initApp();
        }
        return;
    }
    
    authConfigured = true;
    msalInstance = new msal.PublicClientApplication(msalConfig);
    
    // Handle redirect response
    msalInstance.handleRedirectPromise()
        .then(handleResponse)
        .catch(error => {
            console.error('Auth redirect error:', error);
        });
}

// Handle auth response
async function handleResponse(response) {
    if (response) {
        currentAccount = response.account;
        await onUserAuthenticated(currentAccount);
    } else {
        // Check if user is already signed in
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
            currentAccount = accounts[0];
            await onUserAuthenticated(currentAccount);
        } else {
            // Not logged in - show login UI
            showLoginUI();
        }
    }
}

// Sign in
async function signIn() {
    try {
        // Try popup first (better UX)
        const response = await msalInstance.loginPopup(loginRequest);
        currentAccount = response.account;
        await onUserAuthenticated(currentAccount);
    } catch (error) {
        if (error.name === 'BrowserAuthError' && error.errorCode === 'popup_window_error') {
            // Popup blocked, fall back to redirect
            msalInstance.loginRedirect(loginRequest);
        } else {
            console.error('Sign in error:', error);
            showToast('Sign in failed: ' + error.message, 'error');
        }
    }
}

// Sign out
function signOut() {
    if (!msalInstance) return;
    
    const logoutRequest = {
        account: currentAccount,
        postLogoutRedirectUri: msalConfig.auth.postLogoutRedirectUri
    };
    
    msalInstance.logoutRedirect(logoutRequest);
}

// Get access token silently
async function getAccessToken() {
    if (!msalInstance || !currentAccount) return null;
    
    const tokenRequest = {
        scopes: loginRequest.scopes,
        account: currentAccount
    };
    
    try {
        const response = await msalInstance.acquireTokenSilent(tokenRequest);
        return response.accessToken;
    } catch (error) {
        if (error instanceof msal.InteractionRequiredAuthError) {
            // Token expired, need to re-authenticate
            try {
                const response = await msalInstance.acquireTokenPopup(tokenRequest);
                return response.accessToken;
            } catch (popupError) {
                console.error('Token acquisition failed:', popupError);
                signIn();
                return null;
            }
        }
        console.error('Token acquisition error:', error);
        return null;
    }
}

// Fetch user profile from Microsoft Graph
async function fetchUserProfile() {
    const token = await getAccessToken();
    if (!token) return null;
    
    try {
        const response = await fetch(graphConfig.graphMeEndpoint, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Failed to fetch user profile:', error);
    }
    return null;
}

// Fetch user photo from Microsoft Graph
async function fetchUserPhoto() {
    const token = await getAccessToken();
    if (!token) return null;
    
    try {
        const response = await fetch(graphConfig.graphPhotoEndpoint, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            // Convert to base64 data URL so it persists after reload
            return await blobToDataUrl(blob);
        }
    } catch (error) {
        // Photo not available is common, don't log as error
    }
    return null;
}

// Convert blob to base64 data URL
function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Fetch all unique job titles from Azure AD
async function fetchAllJobTitles() {
    const token = await getAccessToken();
    if (!token) return [];
    
    try {
        const response = await fetch(
            `${graphConfig.graphUsersEndpoint}?$select=jobTitle&$top=999`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'ConsistencyLevel': 'eventual'
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            const titles = new Set();
            data.value.forEach(user => {
                if (user.jobTitle) {
                    titles.add(user.jobTitle);
                }
            });
            return Array.from(titles).sort();
        }
    } catch (error) {
        console.error('Failed to fetch job titles:', error);
    }
    return [];
}

// Fetch users by job titles
async function fetchUsersByJobTitles(jobTitles) {
    const token = await getAccessToken();
    if (!token || !jobTitles.length) return [];
    
    try {
        // Build filter for multiple job titles
        const filter = jobTitles.map(title => `jobTitle eq '${title}'`).join(' or ');
        const response = await fetch(
            `${graphConfig.graphUsersEndpoint}?$filter=${encodeURIComponent(filter)}&$select=id,displayName,jobTitle,mail,userPrincipalName&$top=999`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'ConsistencyLevel': 'eventual'
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            return data.value;
        }
    } catch (error) {
        console.error('Failed to fetch users by job titles:', error);
    }
    return [];
}

// Fetch user's photo by ID
async function fetchUserPhotoById(userId) {
    const token = await getAccessToken();
    if (!token) return null;
    
    try {
        const response = await fetch(
            `${graphConfig.graphUsersEndpoint}/${userId}/photo/$value`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        if (response.ok) {
            const blob = await response.blob();
            // Convert to base64 data URL so it persists after reload
            return await blobToDataUrl(blob);
        }
    } catch (error) {
        // Photo not available is common
    }
    return null;
}

// Fetch direct reports count for a user
async function fetchDirectReportsCount(userId) {
    const token = await getAccessToken();
    if (!token) return 0;
    
    try {
        // Fetch all direct reports (we need to count them)
        const response = await fetch(
            `${graphConfig.graphUsersEndpoint}/${userId}/directReports?$select=id`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'ConsistencyLevel': 'eventual'
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            return data.value?.length || 0;
        }
    } catch (error) {
        console.error('Failed to fetch direct reports:', error);
    }
    return 0;
}

// Fetch direct reports for a user (full details)
async function fetchDirectReports(userId) {
    const token = await getAccessToken();
    if (!token) return [];
    
    try {
        const response = await fetch(
            `${graphConfig.graphUsersEndpoint}/${userId}/directReports?$select=id,displayName,jobTitle,mail`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            return data.value || [];
        }
    } catch (error) {
        console.error('Failed to fetch direct reports:', error);
    }
    return [];
}

// Called when user is authenticated
async function onUserAuthenticated(account) {
    console.log('User authenticated:', account.username);
    
    // Fetch additional profile info
    const profile = await fetchUserProfile();
    const photo = await fetchUserPhoto();
    
    const user = {
        id: account.localAccountId,
        email: account.username,
        name: account.name || profile?.displayName || account.username.split('@')[0],
        photo: photo,
        jobTitle: profile?.jobTitle,
        department: profile?.department
    };
    
    // Store user info globally and in localStorage for persistence
    window.currentUser = user;
    localStorage.setItem('employeeName', user.name);
    localStorage.setItem('employeeEmail', user.email);
    
    // Update UI
    showUserUI(user);
    hideLoginUI();
    
    // Initialize the app
    if (typeof initApp === 'function') {
        initApp();
    }
}

// Show login screen
function showLoginUI() {
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) {
        loginOverlay.classList.add('visible');
    }
    
    // Hide main app content
    const appContent = document.querySelector('.app');
    if (appContent) {
        appContent.style.display = 'none';
    }
}

// Hide login screen
function hideLoginUI() {
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) {
        loginOverlay.classList.remove('visible');
    }
    
    // Show main app content
    const appContent = document.querySelector('.app');
    if (appContent) {
        appContent.style.display = '';
    }
}

// Show user info in header
function showUserUI(user) {
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    
    if (userName) {
        userName.textContent = user.name;
    }
    
    if (userAvatar) {
        if (user.photo) {
            userAvatar.innerHTML = `<img src="${user.photo}" alt="${user.name}">`;
        } else {
            const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            userAvatar.innerHTML = `<span>${initials}</span>`;
        }
    }
    
    if (userInfo) {
        userInfo.classList.add('visible');
    }
}

// Check if user is authenticated
function isAuthenticated() {
    return currentAccount !== null;
}

// Get current user
function getCurrentUser() {
    return window.currentUser || null;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Wait for MSAL library to load
    if (typeof msal !== 'undefined') {
        initializeMsal();
    } else {
        console.error('MSAL library not loaded');
    }
});

// Expose Azure AD functions globally for use by other modules
window.fetchAllJobTitles = fetchAllJobTitles;
window.fetchUsersByJobTitles = fetchUsersByJobTitles;
window.fetchUserPhotoById = fetchUserPhotoById;
window.fetchDirectReportsCount = fetchDirectReportsCount;
window.isAuthenticated = isAuthenticated;
window.getCurrentUser = getCurrentUser;

