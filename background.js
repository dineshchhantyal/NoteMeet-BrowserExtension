// Background script for handling extension events
chrome.runtime.onInstalled.addListener(() => {
  console.log('NoteMeet Extension installed');
}); 

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({ authToken: null });
  });
  
  // Save token after login
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "saveAuthToken") {
      chrome.storage.sync.set({ authToken: message.token });
      sendResponse({ success: true });
    }
  });
  
chrome.action.onClicked.addListener((tab) => {
    chrome.windows.create({
      url: "popup.html", // Your popup HTML file
      type: "popup",
      width: 400,
      height: 600
    });
  });
  