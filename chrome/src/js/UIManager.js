import UIComponents from "./UIComponent";
import { CONFIG, AppState } from "..";
import RecordingService from "./RecordingService";
import AuthService from "./AuthService";

// UI Manager
export default class UIManager {
  static init() {
    this.initializeStyles();
    this.checkInitialAuth();
    this.createFloatingWindow();
    this.attachEventListeners();
  }

  static initializeStyles() {
    const style = document.createElement("style");
    style.textContent = `
            #noteMeetPanel {
                transition: opacity 0.3s ease, transform 0.3s ease;
            }
            #noteMeetMinimizedPanel {
                transition: opacity 0.3s ease;
            }

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
        `;
    document.head.appendChild(style);
  }

  static createFloatingWindow() {
    // Create minimized panel
    UIComponents.minimizedPanel = document.createElement("div");
    UIComponents.minimizedPanel.id = "noteMeetMinimizedPanel";
    UIComponents.minimizedPanel.innerHTML = `<img src="${CONFIG.LOGO_URL}" alt="NoteMeet Logo" style="width: 24px; height: 24px;">`;
    this.applyMinimizedPanelStyles();

    // Create main panel
    UIComponents.panel = document.createElement("div");
    UIComponents.panel.id = "noteMeetPanel";
    this.applyMainPanelStyles();

    document.body.appendChild(UIComponents.minimizedPanel);
    document.body.appendChild(UIComponents.panel);
  }

  static applyMinimizedPanelStyles() {
    UIComponents.minimizedPanel.style.cssText = `
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
  }

  static async checkInitialAuth() {
    const user = await AuthService.checkAuthStatus();
    this.updatePanelContent(user);
  }

  static applyMainPanelStyles() {
    UIComponents.panel.style.cssText = `
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
  }

  static updateStatus(status) {
    const existingStatus = UIComponents.minimizedPanel.querySelector(
      ".recording-status, .processing-status"
    );
    if (existingStatus) {
      existingStatus.remove();
    }

    UIComponents.minimizedPanel.style.animation = "none";
    UIComponents.minimizedPanel.style.borderColor = "";
    UIComponents.minimizedPanel.style.boxShadow = "";

    switch (status) {
      case "recording":
        UIComponents.minimizedPanel.style.animation =
          "recording-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite";
        UIComponents.minimizedPanel.style.borderColor = "#ea4335";
        this.addStatusDot("recording-status");
        break;

      case "processing":
        UIComponents.minimizedPanel.style.borderColor = "#fbbc04";
        this.addStatusDot("processing-status");
        break;

      default:
        UIComponents.minimizedPanel.style.borderColor = "rgb(46, 196, 182)";
        UIComponents.minimizedPanel.style.boxShadow =
          "0 4px 12px rgba(7, 59, 76, 0.12)";
        break;
    }
  }

  static addStatusDot(className) {
    const dot = document.createElement("div");
    dot.className = className;
    UIComponents.minimizedPanel.appendChild(dot);
  }

  static async updatePanelContent(user) {
    if (!user) {
      UIComponents.panel.innerHTML = UIComponents.createLoggedOutContent();
      const signInBtn = UIComponents.panel.querySelector("#signInButton");
      signInBtn?.addEventListener("click", () => AuthService.handleAuth());
    } else {
      UIComponents.panel.innerHTML = UIComponents.createLoggedInContent(user);
      this.attachUserPanelListeners(user);

      const meetings = await RecordingService.getMeetings();
      const meetingsListTemplate = UIComponents.createMeetingsList(meetings);
      UIComponents.panel.innerHTML += meetingsListTemplate;
    }

    // Show the main panel when hovering over the minimized panel
    UIComponents.minimizedPanel.addEventListener(
      "mouseenter",
      this.showPanel.bind(this)
    );

    // Hide the main panel and show the minimized panel when leaving the main panel
    UIComponents.panel.addEventListener(
      "mouseleave",
      this.hidePanel.bind(this)
    );
  }

  static attachUserPanelListeners() {
    const startBtn = UIComponents.panel.querySelector("#startRecordingButton");
    const syncStatusBtn = UIComponents.panel.querySelector("#syncStatusButton");

    // Ensure the button exists before adding the event listener
    if (startBtn) {
      startBtn.addEventListener("click", RecordingService.startRecording);
    } else {
      console.error("Start Recording Button not found!");
    }

    syncStatusBtn?.addEventListener("click", this.handleSyncStatus.bind(this));
  }

  static togglePanel() {
    if (UIComponents.minimizedPanel.style.display === "flex") {
      this.hidePanel();
    } else {
      this.showPanel();
    }
  }
  static showPanel() {
    // Ensure the minimized panel is hidden
    UIComponents.minimizedPanel.style.opacity = "0";
    UIComponents.minimizedPanel.style.pointerEvents = "none";

    // Display and animate the main panel
    UIComponents.panel.style.visibility = "visible";
    UIComponents.panel.style.opacity = "1";
    UIComponents.panel.style.pointerEvents = "auto";
    UIComponents.panel.style.transform = "translateY(0) scale(1)";
  }

  static hidePanel() {
    // Hide and animate out the main panel
    UIComponents.panel.style.opacity = "0";
    UIComponents.panel.style.pointerEvents = "none";
    UIComponents.panel.style.transform = "translateY(-10px) scale(0.95)";
    setTimeout(() => {
      UIComponents.panel.style.visibility = "hidden";
    }, 300);

    // Restore visibility of the minimized panel
    UIComponents.minimizedPanel.style.opacity = "1";
    UIComponents.minimizedPanel.style.pointerEvents = "auto";
  }

  static updateRecordingControls() {
    const controlsDiv = UIComponents.panel.querySelector("#recordingControls");
    controlsDiv.innerHTML = `
            ${UIComponents.createButton(
              "Stop Recording",
              "stopRecordingButton"
            )}
            <div id="recordingStatus" style="font-size: 12px; color: #666; margin-top: 8px;">
                Recording in progress...
            </div>
        `;

    const stopBtn = controlsDiv.querySelector("#stopRecordingButton");
    stopBtn?.addEventListener("click", this.handleStopRecording.bind(this));
  }

  static async handleStopRecording() {
    const stopBtn = UIComponents.panel.querySelector("#stopRecordingButton");
    stopBtn.disabled = true;
    stopBtn.textContent = "Processing...";

    try {
      await RecordingService.stopRecording();
      this.showPostRecordingControls();
    } catch (error) {
      console.error("Error in stop recording handler:", error);
      this.resetUI();
    }
  }

  static showPostRecordingControls() {
    const controlsDiv = UIComponents.panel.querySelector("#recordingControls");
    controlsDiv.innerHTML = `
            ${UIComponents.createButton(
              "Start New Recording",
              "startRecordingButton",
              true
            )}
            ${UIComponents.createButton(
              "Save Recording Locally",
              "saveRecordingButton"
            )}
        `;

    this.attachPostRecordingListeners();
  }

  static attachPostRecordingListeners() {
    const newRecordingBtn = UIComponents.panel.querySelector(
      "#startRecordingButton"
    );
    const saveRecordingBtn = UIComponents.panel.querySelector(
      "#saveRecordingButton"
    );

    newRecordingBtn?.addEventListener("click", () => {
      AuthService.checkAuthStatus().then((user) => {
        if (user) this.updatePanelContent(user);
      });
    });

    saveRecordingBtn?.addEventListener(
      "click",
      this.handleSaveRecording.bind(this)
    );
  }

  static async handleSaveRecording() {
    try {
      const blob = new Blob(AppState.recordedChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = url;
      downloadLink.download = `NoteMeet_Recording_${new Date()
        .toISOString()
        .slice(0, 19)}.webm`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading recording:", error);
    }
  }

  static async handleSyncStatus() {
    const syncStatusBtn = UIComponents.panel.querySelector("#syncStatusButton");
    const originalText = syncStatusBtn.textContent;
    syncStatusBtn.disabled = true;
    syncStatusBtn.textContent = "Checking sync status...";

    try {
      this.showSyncDialog();
    } catch (error) {
      console.error("Error showing sync status:", error);
      syncStatusBtn.disabled = false;
      syncStatusBtn.textContent = originalText + " (Error)";
    }
  }

  static showSyncDialog() {
    const syncDialog = document.createElement("div");
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
                Visit <a href="https://notemeet.dineshchhantyal.com/dashboard" target="_blank" style="color: #1a73e8; text-decoration: none;">
                    notemeet.dineshchhantyal.com
                </a> 
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

    const closeBtn = syncDialog.querySelector("button");
    closeBtn.onclick = () => {
      document.body.removeChild(syncDialog);
      const syncStatusBtn =
        UIComponents.panel.querySelector("#syncStatusButton");
      if (syncStatusBtn) {
        syncStatusBtn.disabled = false;
        syncStatusBtn.textContent = "Sync Status";
      }
    };
  }

  static resetUI() {
    if (UIComponents.recordButton) {
      UIComponents.recordButton.textContent = "Start Recording";
      UIComponents.recordButton.style.backgroundColor = "#1a73e8";
      UIComponents.recordButton.disabled = false;
    }

    const loadingIndicator =
      UIComponents.minimizedPanel.querySelector(".loading-indicator");
    if (loadingIndicator) {
      loadingIndicator.style.display = "none";
    }
  }

  static attachEventListeners() {
    const startRecordingButton = document.getElementById(
      "startRecordingButton"
    );
    if (startRecordingButton) {
      startRecordingButton.addEventListener(
        "click",
        RecordingService.startRecording
      );
    }

    const syncStatusButton = document.getElementById("syncStatusButton");
    if (syncStatusButton) {
      syncStatusButton.addEventListener(
        "click",
        this.handleSyncStatus.bind(this)
      );
    }

    const saveRecordingButton = document.getElementById("saveRecordingButton");
    if (saveRecordingButton) {
      saveRecordingButton.addEventListener(
        "click",
        this.handleSaveRecording.bind(this)
      );
    }
  }
}
