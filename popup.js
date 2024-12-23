// Popup script for handling user interactions
document.getElementById('startNote').addEventListener('click', () => {
  // Add your note-taking logic here
  console.log('Start taking notes');
});

document.getElementById('viewNotes').addEventListener('click', () => {
  // Add your notes viewing logic here
  console.log('View notes');
}); 


document.getElementById("login").addEventListener("click", () => {
    // Open the NoteMeet login page
    chrome.tabs.create({ url: "https://notemeet.dineshchhantyal.com/auth/login" });
  });
  
// Example: Save token after login
chrome.runtime.sendMessage({ action: "saveAuthToken", token: "user-token-here" });

document.getElementById("open-persistent-popup").addEventListener("click", () => {
    chrome.windows.create({
      url: "popup.html",
      type: "popup",
      width: 220,
      height: 180,
      focused: true
    });
  });
  