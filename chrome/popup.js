// Popup script for handling user interactions
document.getElementById('startNote').addEventListener('click', () => {
  // Add your note-taking logic here
  console.log('Start taking notes');
});

document.getElementById('viewNotes').addEventListener('click', () => {
  // Add your notes viewing logic here
  console.log('View notes');
}); 



// Handle incoming messages from the authentication process
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "authComplete") {
        // Save the auth token and user information
        chrome.storage.local.set({
            authToken: request.token,
            userInfo: request.userInfo
        }, () => {
            console.log('Authentication data saved');
        });
    }
});

document.getElementById("open-persistent-popup").addEventListener("click", () => {
    chrome.windows.create({
      url: "popup.html",
      type: "popup",
      width: 220,
      height: 180,
      focused: true
    });
  });

document.getElementById('signout-btn')?.addEventListener('click', async () => {
    // Clear all cookies
    chrome.cookies.getAll({}, function(cookies) {
        for(let cookie of cookies) {
            chrome.cookies.remove({
                url: `https://${cookie.domain}${cookie.path}`,
                name: cookie.name
            });
        }
    });
    
    // Clear local storage
    localStorage.clear();
    
    // Reload the popup UI
    window.location.reload();
});

document.getElementById('signOutButton').addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    if (response.success) {
      console.log('Signed out successfully');
      // Update your UI accordingly
      // For example, redirect to login page or update state
    } else {
      console.error('Sign out failed:', response.error);
    }
  } catch (error) {
    console.error('Error during sign out:', error);
  }
});
  