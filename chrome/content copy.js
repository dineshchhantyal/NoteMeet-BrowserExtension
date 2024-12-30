// Constants
const CONFIG = {
  AUTH_BASE_URL: "https://notemeet.dineshchhantyal.com",
  LOGO_URL: chrome.runtime.getURL("icons/icon.png"),
};

// State management
const State = {
  isRecording: false,
  recordedChunks: [],
  recorder: null,
  screenStream: null,
  micStream: null,
  audioContext: null,
  recordedVideoBase64: null,
  stopRecordingPromise: null,
};

// UI Components
class UI {
  static createHeader() {
    return `
      <div style="text-align: center; margin-bottom: 16px;">
        <img src="${CONFIG.LOGO_URL}" alt="NoteMeet" style="width: 120px;">
        <h2 style="color: rgb(7, 59, 76); margin: 8px 0 0 0; font-size: 14px;">
          NoteMeet
        </h2>
      </div>
    `;
  }

  static createButton(text, id, primary = false) {
    return `
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
        "
      >
        ${text}
      </button>
    `;
  }

  static createStatusIndicator() {
    return `
      <div class="status-indicator" style="
        position: absolute;
        right: 4px;
        top: 4px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        transition: all 0.3s ease;
      "></div>
    `;
  }
}

// Panel Manager
class PanelManager {
  constructor() {
    this.panel = null;
    this.minimizedPanel = null;
    this.isExpanded = false;
    this.xOffset = 0;
    this.yOffset = 0;
    this.initializePanels();
  }

  initializePanels() {
    this.createMinimizedPanel();
    this.createMainPanel();
    this.setupDragging();
    this.setupEventListeners();
  }

  createMinimizedPanel() {
    this.minimizedPanel = document.createElement('div');
    this.minimizedPanel.id = 'noteMeetMinimizedPanel';
    this.minimizedPanel.style.cssText = `
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
      cursor: move;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    // Add logo to minimized panel
    const logo = document.createElement('img');
    logo.src = CONFIG.LOGO_URL;
    logo.style.width = '32px';
    logo.style.height = '32px';
    this.minimizedPanel.appendChild(logo);

    // Add status indicator
    this.minimizedPanel.insertAdjacentHTML('beforeend', UI.createStatusIndicator());
    
    document.body.appendChild(this.minimizedPanel);
  }

  createMainPanel() {
    this.panel = document.createElement('div');
    this.panel.id = 'noteMeetPanel';
    this.panel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 280px;
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
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    
    document.body.appendChild(this.panel);
  }

  updateStatus(status) {
    const indicator = this.minimizedPanel.querySelector('.status-indicator');
    if (!indicator) return;

    switch (status) {
      case 'recording':
        indicator.style.backgroundColor = '#ea4335';
        indicator.style.animation = 'status-dot-pulse 1s ease-in-out infinite';
        this.minimizedPanel.style.borderColor = '#ea4335';
        break;
      case 'processing':
        indicator.style.backgroundColor = '#fbbc04';
        indicator.style.animation = 'status-dot-pulse 1s ease-in-out infinite';
        this.minimizedPanel.style.borderColor = '#fbbc04';
        break;
      default:
        indicator.style.backgroundColor = 'rgb(46, 196, 182)';
        indicator.style.animation = 'none';
        this.minimizedPanel.style.borderColor = 'rgb(46, 196, 182)';
    }
  }

  setupEventListeners() {
    let timeoutId = null;

    this.minimizedPanel.addEventListener('mouseenter', () => {
      clearTimeout(timeoutId);
      this.showPanel();
    });

    this.panel.addEventListener('mouseenter', () => {
      clearTimeout(timeoutId);
    });

    this.panel.addEventListener('mouseleave', () => {
      timeoutId = setTimeout(() => this.hidePanel(), 300);
    });

    this.minimizedPanel.addEventListener('mouseleave', (event) => {
      if (!this.panel.contains(event.relatedTarget)) {
        timeoutId = setTimeout(() => this.hidePanel(), 300);
      }
    });
  }

  showPanel() {
    this.panel.style.opacity = '1';
    this.panel.style.visibility = 'visible';
    this.panel.style.transform = 'translateY(0) scale(1)';
    this.minimizedPanel.style.opacity = '0';
    this.isExpanded = true;
    this.updatePosition();
  }

  hidePanel() {
    this.panel.style.opacity = '0';
    this.panel.style.visibility = 'hidden';
    this.panel.style.transform = 'translateY(-10px) scale(0.95)';
    this.minimizedPanel.style.opacity = '1';
    this.isExpanded = false;
    this.updatePosition();
  }

  setupDragging() {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    const dragStart = (e) => {
      if (e.type === "touchstart") {
        initialX = e.touches[0].clientX - this.xOffset;
        initialY = e.touches[0].clientY - this.yOffset;
      } else {
        initialX = e.clientX - this.xOffset;
        initialY = e.clientY - this.yOffset;
      }
      isDragging = true;
    };

    const drag = (e) => {
      if (!isDragging) return;
      e.preventDefault();

      const { clientX, clientY } = e.type === "touchmove" ? e.touches[0] : e;
      currentX = clientX - initialX;
      currentY = clientY - initialY;

      this.xOffset = currentX;
      this.yOffset = currentY;
      this.updatePosition();
    };

    const dragEnd = () => {
      isDragging = false;
    };

    [this.minimizedPanel, this.panel].forEach(element => {
      element.addEventListener('mousedown', dragStart);
      element.addEventListener('touchstart', dragStart, { passive: false });
    });

    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', dragEnd);
  }

  updatePosition() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const panelWidth = this.panel.offsetWidth;
    const panelHeight = this.panel.offsetHeight;
    const minPanelSize = 48;

    const x = Math.min(Math.max(this.xOffset, 0), 
      viewportWidth - (this.isExpanded ? panelWidth : minPanelSize));
    const y = Math.min(Math.max(this.yOffset, 0), 
      viewportHeight - (this.isExpanded ? panelHeight : minPanelSize));

    const transform = `translate3d(${x}px, ${y}px, 0)`;
    this.minimizedPanel.style.transform = this.isExpanded ? 
      `${transform} scale(0.8)` : transform;
    this.panel.style.transform = this.isExpanded ? 
      `${transform} scale(1)` : `${transform} scale(0.95)`;
  }
}

// Recording Manager
class RecordingManager {
  static async startRecording() {
    try {
      State.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true
      });

      State.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });

      const combinedStream = new MediaStream([
        ...State.screenStream.getTracks(),
        ...State.micStream.getTracks()
      ]);

      State.recorder = new MediaRecorder(combinedStream);
      State.recordedChunks = [];

      State.recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          State.recordedChunks.push(event.data);
        }
      };

      State.recorder.start();
      State.isRecording = true;
      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      return false;
    }
  }

  static async stopRecording() {
    if (!State.recorder || State.recorder.state !== 'recording') return;

    return new Promise((resolve) => {
      State.recorder.onstop = async () => {
        const blob = new Blob(State.recordedChunks, { type: 'video/mp4' });
        const reader = new FileReader();
        reader.onloadend = () => {
          State.recordedVideoBase64 = reader.result;
          this.cleanupRecording();
          resolve(true);
        };
        reader.readAsDataURL(blob);
      };
      State.recorder.stop();
    });
  }

  static cleanupRecording() {
    [State.screenStream, State.micStream].forEach(stream => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    });
    State.isRecording = false;
    State.recorder = null;
  }
}

// Initialize the extension
document.addEventListener('DOMContentLoaded', () => {
  const panelManager = new PanelManager();
  
  // Check initial auth status
  checkAuthStatus().then(user => {
    if (user) {
      panelManager.updatePanelContent(user);
    } else {
      panelManager.showLoginContent();
    }
  });
});

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'AUTH_STATE_CHANGED':
      handleAuthStateChange(message.user);
      break;
    // Add other message handlers as needed
  }
  return true;
});