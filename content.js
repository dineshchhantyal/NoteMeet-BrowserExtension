// Content script that runs on Google Meet pages
console.log("NoteMeet content script loaded");

console.log("NoteMeet Extension Activated");

const AUTH_BASE_URL = "https://notemeet.dineshchhantyal.com";

// Add at the top of the file, after the AUTH_BASE_URL declaration
let panel; // Declare panel as a global variable
const LOGO_URL = chrome.runtime.getURL('icons/icon.png');

// Add this helper function at the top level
const createHeader = () => `
  <div style="text-align: center; margin-bottom: 16px;">
    <img src="${LOGO_URL}" alt="NoteMeet" style="width: 120px;">
    <h2 style="color: rgb(7, 59, 76); margin: 8px 0 0 0; font-size: 14px;">
      NoteMeet
    </h2>
  </div>
`;

// Add these functions at the top level
async function checkAuthStatus() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "CHECK_AUTH" }, (response) => {
      resolve(response.user || null);
    });
  });
}

async function handleAuth() {
  // The function can now access the global panel variable
  const loginForm = `
    <div style="text-align: center; padding: 12px 0;">
      ${createHeader()}
      <form id="loginForm" style="display: flex; flex-direction: column; gap: 12px;">
        <input 
          type="email" 
          id="email" 
          placeholder="Email"
          style="padding: 8px; border-radius: 4px; border: 1px solid #ddd;"
        >
        <input 
          type="password" 
          id="password" 
          placeholder="Password"
          style="padding: 8px; border-radius: 4px; border: 1px solid #ddd;"
        >
        <button type="submit" style="
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          background-color: rgb(46, 196, 182);
          color: white;
          cursor: pointer;
          position: relative;
          min-width: 100px;
        " id="loginSubmitButton">
          <span>Sign In</span>
          <div class="loading-spinner" style="
            display: none;
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            width: 12px;
            height: 12px;
            border: 2px solid #ffffff;
            border-top: 2px solid transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          "></div>
        </button>
        <a href=${AUTH_BASE_URL}
            style="font-size: 12px; color: #666; text-decoration: none;">
          Use web signin
        </a>
        <div id="loginError" style="color: red; font-size: 12px; margin-top: 8px; display: none;"></div>
      </form>
      <p style="margin-top: 12px; font-size: 13px;">
        Don't have an account? 
        <a href=${AUTH_BASE_URL}/auth/register
           target="_blank"
           style="color: rgb(46, 196, 182); text-decoration: none;">
          Sign up
        </a>
      </p>
    </div>
  `;
  panel.innerHTML = loginForm;

  const form = document.getElementById("loginForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Add loading state
    const submitButton = document.getElementById("loginSubmitButton");
    const spinner = submitButton.querySelector(".loading-spinner");
    const buttonText = submitButton.querySelector("span");
    submitButton.disabled = true;
    spinner.style.display = "block";
    buttonText.textContent = "Signing in...";

    try {
      // Send message to background script to handle the authentication 
      const message = {
        type: "LOGIN",
        data: {
          email: document.getElementById("email").value,
          password: document.getElementById("password").value,
        },
      };

      // Use chrome.runtime.sendMessage to communicate with background script
      chrome.runtime.sendMessage(message, async (response) => {
        if (response.success) {
          updatePanelContent(response.user);
        } else {
          const errorDiv = document.getElementById("loginError");
          errorDiv.textContent = response.error || "Login failed";
          errorDiv.style.display = "block";
          
          // Reset button state on error
          submitButton.disabled = false;
          spinner.style.display = "none";
          buttonText.textContent = "Sign In";
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      const errorDiv = document.getElementById("loginError");
      errorDiv.textContent = "Login failed";
      errorDiv.style.display = "block";

      // Reset button state on error
      submitButton.disabled = false;
      spinner.style.display = "none";
      buttonText.textContent = "Sign In";
    }
  });
}

// Function to upload recording
function uploadToNoteMeet(blob) {
  const token = localStorage.getItem("noteMeetToken");
  if (!token) {
    console.error("No auth token found");
    return;
  }

  const formData = new FormData();
  formData.append("file", blob);

  fetch("https://notemeet.dineshchhantyal.com/upload", {
    method: "POST",
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then((response) => response.json())
    .then((data) => console.log("Recording uploaded:", data))
    .catch((error) => console.error("Upload failed:", error));
}

// Add these variables at the top level
window.recordedVideoBase64 = null;
let mediaRecorder = null;
let recordedChunks = [];

// Add these at the top level (global scope)
let recorder = null;
let screenStream = null;
let micStream = null;
let audioContext = null;
let stopRecordingPromise = null;

// Add this at the top with other global variables
let isRecording = false;
let recordButton = null;

// Add styles to document head
const style = document.createElement('style');
style.textContent = `
  @keyframes recording-pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(234, 67, 53, 0.4);
      border-color: rgba(234, 67, 53, 0.8);
    }
    70% {
      box-shadow: 0 0 0 15px rgba(234, 67, 53, 0);
      border-color: rgba(234, 67, 53, 1);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(234, 67, 53, 0);
      border-color: rgba(234, 67, 53, 0.8);
    }
  }

  @keyframes status-dot-pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.2);
      opacity: 0.8;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .recording-status {
    position: absolute;
    right: 4px;
    top: 4px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #ea4335;
    animation: status-dot-pulse 1s ease-in-out infinite;
  }

  .processing-status {
    position: absolute;
    right: 4px;
    top: 4px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #fbbc04;
    animation: status-dot-pulse 1s ease-in-out infinite;
  }
`;
document.head.appendChild(style);

// Define stopScreenRecording in global scope
window.stopScreenRecording = async () => {
    console.log('Stopping recording...');
    try {
        // Update UI immediately when stopping
        const recordButton = document.querySelector("#startRecordingButton");
        if (recordButton) {
            recordButton.textContent = "New Recording";
            recordButton.style.backgroundColor = "#1a73e8";
            isRecording = false;
        }

        if (recorder && recorder.state === 'recording') {
            console.log('Recorder state:', recorder.state);
            
            // Create the stop recording promise before stopping
            stopRecordingPromise = new Promise((resolve) => {
                recorder.onstop = () => {
                    console.log('Recording stopped');
                    resolve();
                };
            });
            
            // Stop the recording
            recorder.stop();
            
            // Wait for the recording to stop
            await stopRecordingPromise;
            console.log('Stop promise resolved');
            
            const recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
            console.log('Blob created:', recordedBlob.size, 'bytes');

            // Convert to Base64
            const reader = new FileReader();
            reader.onloadend = () => {
                window.recordedVideoBase64 = reader.result;
                console.log('Base64 conversion complete');
            };
            reader.readAsDataURL(recordedBlob);

            // Cleanup resources
            if (screenStream) {
                screenStream.getTracks().forEach(track => {
                    track.stop();
                    console.log('Screen track stopped');
                });
            }
            if (micStream) {
                micStream.getTracks().forEach(track => {
                    track.stop();
                    console.log('Mic track stopped');
                });
            }
            if (audioContext) {
                await audioContext.close();
                console.log('Audio context closed');
            }
            
            console.log('Cleanup complete');
        } else {
            console.log('Recorder not active:', recorder?.state);
        }
    } catch (error) {
        console.error('Error stopping recording:', error);
    }
};

async function startRecording() {
    try {
        // Update UI BEFORE starting the recording
        if (!recordButton) {
            recordButton = document.querySelector("#startRecordingButton");
        }

        // Immediately update UI to show recording state
        if (recordButton) {
            isRecording = true;
            recordButton.textContent = "Stop Recording";
            recordButton.style.backgroundColor = "#ea4335";
            recordButton.style.animation = "pulse 2s infinite"; // Add pulsing effect
        }

        // Add CSS for pulsing effect if it doesn't exist
        if (!document.querySelector('#recording-pulse-style')) {
            const style = document.createElement('style');
            style.id = 'recording-pulse-style';
            style.textContent = `
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.7; }
                    100% { opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        recordedChunks = []; // Reset chunks array
        console.log('Starting recording...');

        // Hide the div with aria-label="Meet keeps you safe"
        const hidePopupStyle = document.createElement('style');
        hidePopupStyle.textContent = `
            div[aria-label="Meet keeps you safe"],
            div[role="dialog"][data-is-persistent="true"] { 
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
            }
        `;
        document.documentElement.appendChild(hidePopupStyle);

        console.log('Requesting screen and audio capture...');

        // Get system audio and screen
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                displaySurface: "browser",
                width: { ideal: 1920, max: 1920 },
                height: { ideal: 1080, max: 1080 },
                selfBrowserSurface: "include"
            },
            audio: true,
            selfBrowserSurface: "include"

        });

        // Get microphone audio
        micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 2
            },
            video: false,
        });

        // Create AudioContext and destination first
        audioContext = new AudioContext();
        const audioDest = audioContext.createMediaStreamDestination();
        
        // Then create and connect sources
        if (screenStream.getAudioTracks().length > 0) {
            const screenAudioSource = audioContext.createMediaStreamSource(screenStream);
            screenAudioSource.connect(audioDest);
        }

        if (micStream.getAudioTracks().length > 0) {
            const micAudioSource = audioContext.createMediaStreamSource(micStream);
            micAudioSource.connect(audioDest);
        }

        // Get audio from DOM elements (meeting participants)
        const audioElements = Array.from(document.querySelectorAll('audio, video'));
        audioElements.forEach(element => {
            if (element.srcObject && element.srcObject.getAudioTracks().length > 0) {
                const source = audioContext.createMediaStreamSource(element.srcObject);
                source.connect(audioDest);
            }
        });

        // Combine screen video and all audio
        const combinedStream = new MediaStream([
            ...screenStream.getVideoTracks(),
            ...audioDest.stream.getAudioTracks()
        ]);

        // Create the MediaRecorder instance and store it in the global variable
        recorder = new MediaRecorder(combinedStream, {
            mimeType: 'video/webm; codecs=vp8,opus',
            audioBitsPerSecond: 128000
        });

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                console.log('Data available, chunk size:', event.data.size);
                recordedChunks.push(event.data);
            }
        };

        stopRecordingPromise = new Promise((resolve) => recorder.onstop = resolve);

        recorder.start();
        console.log('Recording started, recorder state:', recorder.state);

    } catch (error) {
        console.error('Error during screen recording:', error);
        // Reset UI if recording fails
        if (recordButton) {
            isRecording = false;
            recordButton.textContent = "New Recording";
            recordButton.style.backgroundColor = "#1a73e8";
            recordButton.style.animation = "none";
        }
    }
}

// Move these variables and functions to the global scope (outside of floatingWindow)
let loggedOutContent;
let attachEventListeners;
let updatePanelContent;

function floatingWindow() {
  const minimizedPanel = document.createElement("div");
  minimizedPanel.id = "noteMeetMinimizedPanel";
  minimizedPanel.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 48px;
    height: 48px;
    background-color: #ffffff;
    border: 2px solid rgb(46, 196, 182);
    border-radius: 50%;
    box-shadow: 0 4px 12px rgba(7, 59, 76, 0.12);
    z-index: 9999;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 1;
    transform: scale(1);
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
  `;

  // Update panel styles for smoother transitions
  panel = document.createElement("div");
  panel.id = "noteMeetPanel";
  panel.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 280px;
    height: auto;
    background-color: #ffffff;
    border: 2px solid rgb(46, 196, 182);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(7, 59, 76, 0.12);
    z-index: 9998;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-10px) scale(0.95);
    transform-origin: top right;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
  `;

  const showPanel = () => {
    panel.style.opacity = "1";
    panel.style.visibility = "visible";
    panel.style.pointerEvents = "auto";
    minimizedPanel.style.opacity = "0";
    minimizedPanel.style.pointerEvents = "none";
    isExpanded = true;
    updatePosition(xOffset, yOffset);
  };

  const hidePanel = () => {
    panel.style.opacity = "0";
    panel.style.visibility = "hidden";
    panel.style.pointerEvents = "none";
    minimizedPanel.style.opacity = "1";
    minimizedPanel.style.pointerEvents = "auto";
    isExpanded = false;
    updatePosition(xOffset, yOffset);
  };

  // Improved event handling
  let timeoutId = null;

  minimizedPanel.addEventListener("mouseenter", () => {
    clearTimeout(timeoutId);
    showPanel();
  });

  panel.addEventListener("mouseenter", () => {
    clearTimeout(timeoutId);
  });

  panel.addEventListener("mouseleave", (event) => {
    // Check if we're not moving to the minimized panel
    if (!minimizedPanel.contains(event.relatedTarget)) {
      timeoutId = setTimeout(hidePanel, 300); // Reduced delay for better responsiveness
    }
  });

  minimizedPanel.addEventListener("mouseleave", (event) => {
    // Check if we're not moving to the main panel
    if (!panel.contains(event.relatedTarget)) {
      timeoutId = setTimeout(hidePanel, 300);
    }
  });

  // Focus handling for accessibility
  minimizedPanel.addEventListener("focus", showPanel);
  panel.addEventListener("focus", () => {
    clearTimeout(timeoutId);
  });

  panel.addEventListener("blur", (event) => {
    if (!panel.contains(event.relatedTarget)) {
      timeoutId = setTimeout(hidePanel, 300);
    }
  });

  // Add status indicator inside minimized panel
  const statusIndicator = document.createElement("div");
  statusIndicator.id = "noteMeetStatusIndicator";
  statusIndicator.style.cssText = `
    width: 32px;
    height: 32px;
    background-image: url(${LOGO_URL});
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
  `;
  minimizedPanel.appendChild(statusIndicator);

  // Update status indicator based on recording state
  const updateStatus = (status) => {
    // Remove any existing status indicators
    const existingStatus = minimizedPanel.querySelector('.recording-status, .processing-status');
    if (existingStatus) {
        existingStatus.remove();
    }

    // Reset any existing animations and styles
    minimizedPanel.style.animation = 'none';
    minimizedPanel.style.borderColor = '';
    minimizedPanel.style.boxShadow = '';

    switch(status) {
        case 'recording':
            // Apply recording styles
            minimizedPanel.style.animation = 'recording-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite';
            minimizedPanel.style.borderColor = '#ea4335';
            
            const recordingDot = document.createElement('div');
            recordingDot.className = 'recording-status';
            minimizedPanel.appendChild(recordingDot);
            break;

        case 'processing':
            // Apply processing styles
            minimizedPanel.style.borderColor = '#fbbc04';
            
            const processingDot = document.createElement('div');
            processingDot.className = 'processing-status';
            minimizedPanel.appendChild(processingDot);
            break;

        default: // idle
            // Reset to default styles
            minimizedPanel.style.borderColor = 'rgb(46, 196, 182)';
            minimizedPanel.style.boxShadow = '0 4px 12px rgba(7, 59, 76, 0.12)';
            break;
    }
  };

  // Event listeners for panel interactions
  minimizedPanel.addEventListener("click", showPanel);
  
  panel.addEventListener("mouseleave", () => {
    timeoutId = setTimeout(hidePanel, 1000);
  });

  panel.addEventListener("mouseenter", () => {
    clearTimeout(timeoutId);
  });

  // Add both panels to the document
  document.body.appendChild(minimizedPanel);
  document.body.appendChild(panel);

  // Update the startRecording function to handle status
  const originalStartRecording = startRecording;
  window.startRecording = async function() {
    updateStatus('recording');
    await originalStartRecording();
  };

  // Update stopScreenRecording to handle status
  const originalStopScreenRecording = window.stopScreenRecording;
  window.stopScreenRecording = async function() {
    updateStatus('processing');
    await originalStopScreenRecording();
    updateStatus('idle');
  };

  // Helper function to create styled buttons
  const createButton = (text, id, primary = false) => `
    <button 
      id="${id}"
      style="
        width: 100%;
        padding: 10px 16px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        background-color: ${primary ? "rgb(46, 196, 182)" : "rgb(7, 59, 76)"};
        color: white;
        margin-bottom: 8px;
        &:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }
      "
    >
      ${text}
    </button>
  `;

  // Different panel content based on login state
  loggedOutContent = `
    <div style="text-align: center; padding: 12px 0;">
      ${createHeader()}
      <p style="color: rgb(7, 59, 76); margin: 0 0 16px 0; font-size: 14px;">
        Sign in to start recording your meetings
      </p>
      ${createButton("Sign In", "signInButton", true)}
      <p style="margin-top: 12px; font-size: 13px;">
        Don't have an account? 
        <a href=${AUTH_BASE_URL}/auth/register
           target="_blank"
           style="color: rgb(46, 196, 182); text-decoration: none;">
          Sign up
        </a>
      </p>
    </div>
  `;

  attachEventListeners = function() {
    const startBtn = panel.querySelector("button:nth-of-type(1)");
    const stopBtn = panel.querySelector("button:nth-of-type(2)");
    const signOutBtn = panel.querySelector("button:nth-of-type(3)");

    startBtn?.addEventListener("click", startRecording);
    stopBtn?.addEventListener("click", () => window.stopScreenRecording());
    signOutBtn?.addEventListener("click", () => {
        console.log("Sign out clicked");
        chrome.runtime.sendMessage({ type: "SIGN_OUT" }, (response) => {
            console.log("Sign out response:", response);
            if (!response?.success) {
                console.error("Sign out failed:", response?.error);
            }
        });
    });
  };

  updatePanelContent = function(user) {
    const loggedInContent = `
      <div style="text-align: center;">
        ${createHeader()}
        <div style="display: flex; align-items: center; margin-bottom: 16px;">
          <div style="text-align: left;">
            <div style="font-weight: 500; color: rgb(7, 59, 76);">${user.name}</div>
            <div style="font-size: 12px; color: #666;">${user.email}</div>
          </div>
        </div>
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Recordings left this month</div>
          <div style="font-size: 24px; font-weight: 600; color: rgb(7, 59, 76);">${user.recordingsLeft ?? 1}</div>
          <div style="font-size: 12px; color: #666;">${user.plan ?? "Free"}</div>
        </div>
        <div id="recordingControls">
          ${createButton("Start Recording", "startRecordingButton", true)}
        </div>
        <div style="border-top: 1px solid #eee; margin: 16px 0; padding-top: 16px;">
          ${createButton("Sync Status", "syncStatusButton")}
          ${createButton("Sign Out", "signOutButton")}
        </div>
      </div>
    `;
    panel.innerHTML = loggedInContent;
    
    // Reattach all event listeners
    const startBtn = panel.querySelector("#startRecordingButton");
    const syncStatusBtn = panel.querySelector("#syncStatusButton");
    const signOutBtn = panel.querySelector("#signOutButton");

    // Attach start recording handler
    startBtn?.addEventListener("click", async () => {
        startBtn.disabled = true;
        startBtn.textContent = "Starting...";
        try {
            await startRecording();
            const controlsDiv = panel.querySelector("#recordingControls");
            controlsDiv.innerHTML = `
                ${createButton("Stop Recording", "stopRecordingButton")}
                <div style="font-size: 12px; color: #666; margin-top: 8px;">Recording in progress...</div>
            `;
            
            // Reattach stop recording handler
            const stopBtn = panel.querySelector("#stopRecordingButton");
            stopBtn?.addEventListener("click", async () => {
                stopBtn.disabled = true;
                stopBtn.textContent = "Processing...";
                await window.stopScreenRecording();
                
                // Wait for Base64 conversion
                const waitForBase64 = new Promise((resolve) => {
                    const checkInterval = setInterval(() => {
                        if (window.recordedVideoBase64) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }, 100);
                });

                await waitForBase64;

                // Update controls and reattach handlers
                controlsDiv.innerHTML = `
                    ${createButton("Start New Recording", "startRecordingButton", true)}
                    ${createButton("Save Recording Locally", "saveRecordingButton")}
                `;
                
                // Reattach new recording button handler
                panel.querySelector("#startRecordingButton")?.addEventListener("click", () => {
                    updatePanelContent(user); // Reset to initial state
                });

                // Attach save recording handler
                panel.querySelector("#saveRecordingButton")?.addEventListener("click", () => {
                    try {
                        const blob = new Blob(recordedChunks, { type: 'video/webm' });
                        const url = URL.createObjectURL(blob);
                        const downloadLink = document.createElement("a");
                        downloadLink.href = url;
                        downloadLink.download = `NoteMeet_Recording_${new Date().toISOString().slice(0,19)}.webm`;
                        document.body.appendChild(downloadLink);
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                        URL.revokeObjectURL(url);
                    } catch (error) {
                        console.error('Error downloading recording:', error);
                    }
                });
            });
        } catch (error) {
            console.error('Error starting recording:', error);
            startBtn.disabled = false;
            startBtn.textContent = "Start Recording";
        }
    });

    // Reattach sync status handler
    syncStatusBtn?.addEventListener("click", async () => {
        console.log("Sync status clicked");
        syncStatusBtn.disabled = true;
        const originalText = syncStatusBtn.textContent;
        syncStatusBtn.textContent = "Checking sync status...";
        
        try {
            // Show sync confirmation dialog
            const syncDialog = document.createElement('div');
            syncDialog.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                z-index: 10000;
                max-width: 400px;
                text-align: center;
            `;
            
            syncDialog.innerHTML = `
                <h3 style="margin: 0 0 15px 0; color: #1a73e8;">✓ All Set!</h3>
                <p style="margin: 0 0 15px 0; color: #5f6368;">
                    Your notes and recordings are synced with NoteMeet.
                    Visit <a href="https://notemeet.com/dashboard" target="_blank" style="color: #1a73e8; text-decoration: none;">notemeet.com</a> 
                    to access all your content.
                </p>
                <button style="
                    background: #1a73e8;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Got it</button>
            `;

            document.body.appendChild(syncDialog);

            // Handle close button
            const closeBtn = syncDialog.querySelector('button');
            closeBtn.onclick = () => {
                document.body.removeChild(syncDialog);
                syncStatusBtn.disabled = false;
                syncStatusBtn.textContent = originalText;
            };

        } catch (error) {
            console.error("Error showing sync status:", error);
            syncStatusBtn.disabled = false;
            syncStatusBtn.textContent = originalText;
        }
    });

    // Reattach sign out handler
    signOutBtn?.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "SIGN_OUT" }, (response) => {
            if (!response?.success) {
                console.error("Sign out failed:", response?.error);
            }
        });
    });
  };

  // Initial auth check and panel setup
  checkAuthStatus().then((user) => {
    if (user) {
      updatePanelContent(user);
    } else {
      panel.innerHTML = loggedOutContent;
      const signInBtn = panel.querySelector("button");
      signInBtn?.addEventListener("click", handleAuth);
    }
  });

  // Dragging functionality
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  function dragStart(e) {
    if (e.type === "touchstart") {
      initialX = e.touches[0].clientX - xOffset;
      initialY = e.touches[0].clientY - yOffset;
    } else {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
    }

    isDragging = true;
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();

      let clientX, clientY;
      if (e.type === "touchmove") {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      currentX = clientX - initialX;
      currentY = clientY - initialY;

      // Constrain to viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const panelWidth = panel.offsetWidth;
      const panelHeight = panel.offsetHeight;
      const minPanelWidth = 48; // Size of minimized panel

      currentX = Math.min(Math.max(currentX, 0), viewportWidth - (panel.style.visibility === 'visible' ? panelWidth : minPanelWidth));
      currentY = Math.min(Math.max(currentY, 0), viewportHeight - (panel.style.visibility === 'visible' ? panelHeight : minPanelWidth));

      xOffset = currentX;
      yOffset = currentY;

      // Update both panels' positions
      updatePosition(currentX, currentY);
    }
  }

  function dragEnd() {
    isDragging = false;
  }

  function updatePosition(x, y) {
    // Update both panels to maintain relative positioning
    minimizedPanel.style.transform = `translate(${x}px, ${y}px) ${isExpanded ? 'scale(0.8)' : 'scale(1)'}`;
    
    // Maintain panel's scale and position transforms
    if (panel.style.visibility === 'visible') {
        panel.style.transform = `translate(${x}px, ${y}px) scale(1)`;
    } else {
        panel.style.transform = `translate(${x}px, ${y}px) translateY(-10px) scale(0.95)`;
    }
  }

  // Add event listeners for both mouse and touch events
  [minimizedPanel, panel].forEach(element => {
    // Mouse events
    element.addEventListener('mousedown', dragStart);
    
    // Touch events
    element.addEventListener('touchstart', dragStart, { passive: false });
    
    // Add cursor style
    element.style.cursor = 'move';
  });

  // Add document-level event listeners
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);
  document.addEventListener('touchmove', drag, { passive: false });
  document.addEventListener('touchend', dragEnd);

  // Modify show/hide panel functions to maintain position
  const originalShowPanel = showPanel;
  const originalHidePanel = hidePanel;

  showPanel = () => {
    originalShowPanel();
    if (xOffset || yOffset) {
      updatePosition(xOffset, yOffset);
    }
  };

  hidePanel = () => {
    originalHidePanel();
    if (xOffset || yOffset) {
      updatePosition(xOffset, yOffset);
    }
  };

  // Update minimizedPanel styles to support the new animations
  minimizedPanel.style.cssText += `
    position: relative;
    transition: border-color 0.3s ease-in-out;
    will-change: transform, border-color, box-shadow;
  `;
}

floatingWindow();

// Add this at the top level of your content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in content script:", message);
  if (message.type === "AUTH_STATE_CHANGED") {
    console.log("Auth state changed:", message.user);
    handleAuthStateChange(message.user);
    sendResponse({ success: true });
    return true;
  }
});

// Add this new function to handle auth state changes
function handleAuthStateChange(user) {
  try {
    console.log("Handling auth state change for user:", user);
    if (!panel) {
      console.error("Panel not initialized");
      return;
    }

    if (!user) {
      // User is signed out
      console.log("User signed out, showing login panel");
      panel.innerHTML = loggedOutContent;
      const signInBtn = panel.querySelector("#signInButton");
      signInBtn?.addEventListener("click", handleAuth);
    } else {
      // User is signed in
      console.log("User signed in, updating panel content");
      updatePanelContent(user);
    }
  } catch (error) {
    console.error("Error handling auth state change:", error);
  }
}
