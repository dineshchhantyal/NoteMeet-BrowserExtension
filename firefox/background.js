const AUTH_BASE_URL = "https://notemeet.dineshchhantyal.com";

// Add this at the top of your file
browser.webRequest.onHeadersReceived.addListener(
  function(details) {
    for (const header of details.responseHeaders) {
      if (header.name.toLowerCase() === 'set-cookie' && header.value.includes('authjs.session-token')) {
        const cookie = parseCookie(header.value);
        // Use browser.cookies instead of chrome.cookies
        browser.cookies.set({
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
  ["responseHeaders"]
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
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);

  if (message.type === 'LOGIN') {
    handleLogin(message.data)
      .then(response => {
        sendResponse(response);
        browser.tabs.query({}).then(tabs => {
          tabs.forEach(tab => {
            browser.tabs.sendMessage(tab.id, {
              type: "AUTH_STATE_CHANGED",
              user: response.user
            }).catch(err => console.log(`Failed to send message to tab ${tab.id}:`, err));
          });
        });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.type === 'CHECK_AUTH') {
    checkAuth()
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === "SIGN_OUT") {
    try {
      browser.storage.local.remove(["noteMeetToken", "noteMeetUser"]).then(() => {
        browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
          if (tabs[0]) {
            browser.tabs.sendMessage(tabs[0].id, {
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
    return true;
  }

  if (message.type === 'LOGOUT') {
    handleLogout()
      .then(response => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
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
    await browser.storage.local.clear();
    
    const cookies = await browser.cookies.getAll({
      domain: new URL(AUTH_BASE_URL).hostname
    });
    
    for (const cookie of cookies) {
      await browser.cookies.remove({
        url: `${AUTH_BASE_URL}${cookie.path}`,
        name: cookie.name
      });
    }

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
        secure: false,
        httpOnly: false
      };
      
      for (const part of parts) {
        const [key, val] = part.split('=').map(s => s.trim());
        if (key.toLowerCase() === 'path') cookieDetails.path = val;
        if (key.toLowerCase() === 'domain') cookieDetails.domain = val;
        if (key.toLowerCase() === 'secure') cookieDetails.secure = true;
        if (key.toLowerCase() === 'httponly') cookieDetails.httpOnly = true;
      }

      await browser.cookies.set(cookieDetails);
    } catch (error) {
      console.error('Error setting cookie:', error, 'Cookie string:', cookie);
    }
  }
}

async function getCookiesForUrl(url) {
  return await browser.cookies.getAll({
    url: url
  });
}
  