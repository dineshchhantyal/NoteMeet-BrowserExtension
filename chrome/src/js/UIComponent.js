// UI Components
class UIComponents {
    constructor() {
        this.panel = null;
        this.minimizedPanel = null;
        this.recordButton = null;
    }

    createHeader() {
        return `
            <div style="text-align: center; margin-bottom: 16px;">
                <img src="${CONFIG.LOGO_URL}" alt="NoteMeet" style="width: 120px;">
                <h2 style="color: rgb(7, 59, 76); margin: 8px 0 0 0; font-size: 14px;">
                    NoteMeet
                </h2>
            </div>
        `;
    }

    createButton(text, id, primary = false) {
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

    createLoggedInContent(user) {
        return `
            <div style="text-align: center;">
                ${this.createHeader()}
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
                    ${this.createButton("Start Recording", "startRecordingButton", true)}
                </div>
                <div style="border-top: 1px solid #eee; margin: 16px 0; padding-top: 16px;">
                    ${this.createButton("Sync Status", "syncStatusButton")}
                </div>
            </div>
        `;
    }

    createLoggedOutContent() {
        return `
            <div style="text-align: center; padding: 12px 0;">
                ${this.createHeader()}
                <p style="color: rgb(7, 59, 76); margin: 0 0 16px 0; font-size: 14px;">
                    Sign in to start recording your meetings
                </p>
                ${this.createButton("Sign In", "signInButton", true)}
                <p style="margin-top: 12px; font-size: 13px;">
                    Don't have an account? 
                    <a href=${CONFIG.AUTH_BASE_URL}/auth/register
                       target="_blank"
                       style="color: rgb(46, 196, 182); text-decoration: none;">
                      Sign up
                    </a>
                </p>
            </div>
        `;
    }
}
