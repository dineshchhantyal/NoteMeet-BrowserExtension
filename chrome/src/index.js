const isProduction = false;

// Constants
const CONFIG = {
  AUTH_BASE_URL: isProduction
    ? "https://notemeet.dineshchhantyal.com"
    : "http://localhost:3000",
  LOGO_URL: chrome.runtime.getURL("icons/icon.png"),
};

// Imports
import UIManager from "./js/UIManager.js"; // Ensure proper import syntax
import MessageHandler from "./js/MessageHandler.js"; // Ensure proper import syntax

// State management
const AppState = {
  isRecording: false,
  isRecordingSetupInProgress: false,
  isExpanded: false,
  recordedVideoBase64: null,
  x: 0,
  y: 0,
  recordedChunks: [],
  presignedUrl: null,
  mediaState: {
    recorder: null,
    screenStream: null,
    micStream: null,
    audioContext: null,
  },
  meetingId: null,
  userLimits: {
    meetingsAllowed: 0,
    storageLimit: 0,
    meetingDuration: 0,
  },
  userSubscription: null,
};

// Initialize the application
const initialize = () => {
  UIManager.init();
  MessageHandler.init();
};

initialize(); // Call the initialize function directly

export { AppState, CONFIG };
