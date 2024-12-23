// Content script that runs on Google Meet pages
console.log("NoteMeet content script loaded");

console.log("NoteMeet Extension Activated");

const AUTH_BASE_URL = "http://localhost:3000";

// Add at the top of the file, after the AUTH_BASE_URL declaration
let panel; // Declare panel as a global variable

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
        ">
          Sign In
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
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      const errorDiv = document.getElementById("loginError");
      errorDiv.textContent = "Login failed";
      errorDiv.style.display = "block";
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

async function startRecording() {
  try {
    // Hide the div with aria-label="Meet keeps you safe"
    const hidePopupStyle = document.createElement("style");
    hidePopupStyle.textContent = `
        div[aria-label="Meet keeps you safe"],
        div[role="dialog"][data-is-persistent="true"] { 
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
        }`;

    document.documentElement.appendChild(hidePopupStyle);

    console.log("Requesting screen and audio capture...");

    // Capture screen video and audio
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "browser",
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
      },
      audio: true,
    });

    if (!screenStream || screenStream.getTracks().length === 0) {
      throw new Error(
        "No media stream returned. User might have cancelled sharing."
      );
    }

    console.log("Screen capture stream obtained.");

    // Create an AudioContext for combining audio streams
    const audioContext = new AudioContext();

    // Only create screen audio source if there's an audio track
    let screenAudioStream;
    const screenAudioTracks = screenStream.getAudioTracks();
    if (screenAudioTracks.length > 0) {
      screenAudioStream = audioContext.createMediaStreamSource(screenStream);
    }

    // Get audio from DOM elements (if any)
    const audioElements = Array.from(document.querySelectorAll("audio"));
    const audioElementStreams = audioElements
      .map((audio) => {
        if (audio.srcObject) {
          return audioContext.createMediaStreamSource(audio.srcObject);
        } else {
          console.warn("Audio element does not have a valid srcObject:", audio);
          return null;
        }
      })
      .filter(Boolean);

    // Create a destination for combined audio
    const audioDest = audioContext.createMediaStreamDestination();
    if (screenAudioStream) {
      screenAudioStream.connect(audioDest);
    }
    audioElementStreams.forEach((stream) => stream.connect(audioDest));

    // Combine screen video and combined audio
    const combinedStream = new MediaStream([
      ...screenStream.getVideoTracks(),
      ...audioDest.stream.getAudioTracks(),
    ]);

    console.log("MediaRecorder initializing...");

    const startRecording = (stream) => {
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm; codecs=vp8,opus",
      });
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      const stopped = new Promise((resolve) => (recorder.onstop = resolve));

      recorder.start();
      console.log(
        "Recording started. Call window.stopScreenRecording() to stop recording."
      );

      return {
        recorder,
        stop: () => {
          if (recorder.state === "recording") {
            recorder.stop();
          }
          return stopped.then(() => new Blob(chunks, { type: "video/webm" }));
        },
      };
    };

    const { recorder, stop } = startRecording(combinedStream);

    window.stopScreenRecording = async () => {
      console.log("Stopping recording...");
      const recordedBlob = await stop();

      // Convert the recorded video to a Base64 string
      const reader = new FileReader();
      reader.onloadend = () => {
        window.recordedVideoBase64 = reader.result; // Base64 without the data prefix
        console.log(
          "Base64 video data available at window.recordedVideoBase64."
        );
      };
      reader.readAsDataURL(recordedBlob);

      console.log("Recording processing completed.");

      // Cleanup resources
      screenStream.getTracks().forEach((track) => track.stop());
      audioContext.close();

      //   download the recording
      const downloadLink = document.createElement("a");
      window.recordedVideoBase64 = reader.result.split(",")[1];
      downloadLink.href = window.recordedVideoBase64;
      downloadLink.download = "recording.webm";
      downloadLink.click();
    };
  } catch (error) {
    console.error("Error during screen recording:", error);
  }
}

// Move these variables and functions to the global scope (outside of floatingWindow)
let loggedOutContent;
let attachEventListeners;
let updatePanelContent;

function floatingWindow() {
  // Update panel declaration to use the global variable
  panel = document.createElement("div"); // Remove 'const' to use global variable
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
    z-index: 9999;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

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
      <img src="YOUR_LOGO_URL" alt="NoteMeet" style="width: 120px; margin-bottom: 12px;">
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
        <div style="display: flex; align-items: center; margin-bottom: 16px;">
          <img src="${
            user.avatar || "icons/icon.png"
          }" alt="Profile" style="width: 32px; height: 32px; border-radius: 50%; margin-right: 8px;">
          <div style="text-align: left;">
            <div style="font-weight: 500; color: rgb(7, 59, 76);">${
              user.name
            }</div>
            <div style="font-size: 12px; color: #666;">${user.email}</div>
          </div>
        </div>
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Recordings left this month</div>
          <div style="font-size: 24px; font-weight: 600; color: rgb(7, 59, 76);">${
            user.recordingsLeft
          }</div>
          <div style="font-size: 12px; color: #666;">${user.plan} Plan</div>
        </div>
        ${createButton("Start Recording", "startRecordingButton", true)}
        ${createButton("Stop Recording", "stopRecordingButton")}
        <div style="border-top: 1px solid #eee; margin: 16px 0; padding-top: 16px;">
          ${createButton("Sign Out", "signOutButton")}
        </div>
      </div>
    `;
    panel.innerHTML = loggedInContent;
    
    // Move event listeners here, after the content is added to DOM
    const startBtn = panel.querySelector("#startRecordingButton");
    const stopBtn = panel.querySelector("#stopRecordingButton");
    const signOutBtn = panel.querySelector("#signOutButton");

    startBtn?.addEventListener("click", startRecording);
    stopBtn?.addEventListener("click", () => window.stopScreenRecording());
    signOutBtn?.addEventListener("click", (e) => {
        console.log("Sign out button clicked", e.target);  // Debug log
        console.log("Sign out clicked");
        chrome.runtime.sendMessage({ type: "SIGN_OUT" }, (response) => {
            console.log("Sign out response:", response);
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

  // Add the panel to the body
  document.body.appendChild(panel);

  // Make the panel draggable
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  panel.addEventListener("mousedown", dragStart);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", dragEnd);

  function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    if (e.target === panel) {
      isDragging = true;
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      panel.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }
  }

  function dragEnd() {
    isDragging = false;
  }

  // Add event listeners for buttons
  // ... rest of your event listeners ...
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
