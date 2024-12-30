const AUTH_BASE_URL = "http://localhost:3000";

// Add this at the top of your file
chrome.webRequest.onHeadersReceived.addListener(
  function(details) {
    for (const header of details.responseHeaders) {
      if (header.name.toLowerCase() === 'set-cookie' && header.value.includes('authjs.session-token')) {
        const cookie = parseCookie(header.value);
        // Store cookie specifically for the extension
        chrome.cookies.set({
          url: AUTH_BASE_URL,
          name: cookie.name,
          value: cookie.value,
          path: cookie.path || '/',
          httpOnly: cookie.httpOnly || false,
          secure: cookie.secure || false,
          sameSite: cookie.sameSite || 'lax',
          expirationDate: cookie.expires ? new Date(cookie.expires).getTime() / 1000 : undefined
        });
      }
    }
    return { responseHeaders: details.responseHeaders };
  },
  { urls: ["http://localhost:3000/*", "https://notemeet.dineshchhantyal.com/*"] },
  ["responseHeaders", "extraHeaders"]
);

function parseCookie(cookieStr) {
  const parts = cookieStr.split(';').map(p => p.trim());
  const [nameValue, ...attributes] = parts;
  const [name, value] = nameValue.split('=').map(s => s.trim());
  
  const cookie = { name, value };
  
  attributes.forEach(attr => {
    const [key, val] = attr.split('=').map(s => s.trim());
    const keyLower = key.toLowerCase();
    if (keyLower === 'path') cookie.path = val;
    if (keyLower === 'expires') cookie.expires = val;
    if (keyLower === 'httponly') cookie.httpOnly = true;
    if (keyLower === 'secure') cookie.secure = true;
    if (keyLower === 'samesite') cookie.sameSite = val.toLowerCase();
  });
  
  return cookie;
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message); // Debug log

  if (message.type === 'LOGIN') {
    handleLogin(message.data)
      .then(response => {sendResponse(response);
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            chrome.tabs.sendMessage(tab.id, {
              type: "AUTH_STATE_CHANGED",
              user: response.user
            }).catch(err => console.log(`Failed to send message to tab ${tab.id}:`, err));
          });
        });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Will respond asynchronously
  }
  
  if (message.type === 'CHECK_AUTH') {
    checkAuth()
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Will respond asynchronously
  }

  if (message.type === "SIGN_OUT") {
    try {
      // Clear any stored tokens/user data
      chrome.storage.local.remove(["noteMeetToken", "noteMeetUser"], () => {
        // Notify content script about auth state change
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: "AUTH_STATE_CHANGED",
              user: null
            });
          }
        });
        
        sendResponse({ success: true });
      });
    } catch (error) {
      console.error("Sign out error:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep the message channel open for async response
  }

  if (message.type === 'LOGOUT') {
    handleLogout()
      .then(response => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async response
  }

  if (message.type === 'GET_MEETINGS') {
    getMeetings()
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async response
  }

  if (message.type === 'GET_PRESIGNED_URL') {
    getPresignedUrl()
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async response
  }
});

async function handleLogin({ email, password }) {
  try {
    // 1. Get CSRF token
    const csrfResponse = await fetch(`${AUTH_BASE_URL}/api/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!csrfResponse.ok) throw new Error('Failed to get CSRF token');
    
    const { csrfToken } = await csrfResponse.json();

    // 2. Perform login with proper cookie handling
    const loginResponse = await fetch(`${AUTH_BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        csrfToken,
        email,
        password,
        json: true
      })
    });

    if (!loginResponse.ok) {
      throw new Error('Login failed: ' + loginResponse.statusText);
    }

    // 3. Verify authentication immediately after login
    const authResponse = await checkAuth();
    if (!authResponse.success) {
      throw new Error(authResponse.error || 'Authentication failed after login');
    }

    return { success: true, user: authResponse.user };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

async function getMeetings() {
  try {
    const response = await fetch(`${AUTH_BASE_URL}/api/meetings`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) throw new Error('Meetings fetch failed');
    const {data} = await response.json();
    console.log('Meetings data:', data);
    return { success: true, meetings: data };

  } catch (error) {
    console.error('Meetings fetch error:', error);
    return { success: false, error: error.message };
  }
}


async function checkAuth() {
  try {
    const response = await fetch(`${AUTH_BASE_URL}/api/auth/session`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) throw new Error('Auth check failed');
    const session = await response.json();
    
    return { success: true, user: session.user };
  } catch (error) {
    console.error('Auth check error:', error);
    return { success: false, error: error.message };
  }
}

async function handleSignOut() {
  try {
    // 1. Clear extension's storage
    await chrome.storage.local.clear();
    
    // 2. Clear extension-specific cookies
    const cookies = await chrome.cookies.getAll({
      domain: new URL(AUTH_BASE_URL).hostname
    });
    
    for (const cookie of cookies) {
      await chrome.cookies.remove({
        url: `${AUTH_BASE_URL}${cookie.path}`,
        name: cookie.name
      });
    }

    // 3. Reset any runtime variables or states
    currentUser = null;
    authToken = null;

    return true;
  } catch (error) {
    console.error("Sign out error:", error);
    throw error;
  }
}

// Helper functions to manage cookies
async function storeCookiesFromHeader(cookieHeader) {
  console.log('Storing cookies from header:', cookieHeader);
  
  // Split on comma only if not within a quoted string
  const cookies = cookieHeader.split(/,(?=\s*[^"]*(?:"[^"]*"[^"]*)*$)/);
  
  for (const cookie of cookies) {
    try {
      const [nameValue, ...parts] = cookie.split(';');
      const [name, value] = nameValue.split('=').map(s => s.trim());
      
      console.log(`Setting cookie: ${name}=${value}`);
      
      const cookieDetails = {
        url: AUTH_BASE_URL,
        name: name,
        value: value,
        path: '/',
        secure: false, // Set to true if using HTTPS
        httpOnly: false
      };
      
      // Extract additional parameters
      for (const part of parts) {
        const [key, val] = part.split('=').map(s => s.trim());
        if (key.toLowerCase() === 'path') cookieDetails.path = val;
        if (key.toLowerCase() === 'domain') cookieDetails.domain = val;
        if (key.toLowerCase() === 'secure') cookieDetails.secure = true;
        if (key.toLowerCase() === 'httponly') cookieDetails.httpOnly = true;
      }

      await chrome.cookies.set(cookieDetails);
    } catch (error) {
      console.error('Error setting cookie:', error, 'Cookie string:', cookie);
    }
  }
}

async function getCookiesForUrl(url) {
  return await chrome.cookies.getAll({
    url: url
  });
}
  

async function getPresignedUrl() {
  try {
    const response = await fetch(`${AUTH_BASE_URL}/api/meetings/upload/presigned-url`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Failed to get presigned URL', data);
      throw new Error(data.message);
    }

    return {
      success: true,
      ...data
    };

  } catch (error) {
    console.error('Error fetching presigned URL:', error);
    return { success: false, error: error.message };
  }
}