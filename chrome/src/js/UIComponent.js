import { CONFIG } from "..";


// UI Components
export default class UIComponents {
    constructor() {
        this.panel = null;
        this.minimizedPanel = null;
        this.meetingsList = null;
        this.recordButton = null;
    }

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

    static createLoggedInContent(user) {
        return `
            <div style="text-align: center;">
                ${this.createHeader()}
                <div style="display: flex; align-items: center; margin-bottom: 16px;">
                    <div style="text-align: left;">
                        <div style="font-weight: 500; color: rgb(7, 59, 76);">${user.name}</div>
                        <div style="font-size: 12px; color: #666;">${user.email}</div>
                    </div>
                </div>
             ${user.subscriptions && user.subscriptions.length > 0 ? <div style="margin-bottom: 16px;">
                <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Your Subscription
                    <span style="font-size: 12px; color: #666; background-color: #f0f0f0; padding: 4px 8px; border-radius: 4px;">${user.subscriptions[0].plan.name ? user.subscriptions[0].plan.name : "Free"}</span>
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Meetings Allowed</div>
                <div style="font-size: 24px; font-weight: 600; color: rgb(7, 59, 76);">${user.limits.meetingsAllowed ? user.limits.meetingsAllowed : 0}</div>
                <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Storage Limit</div>
                <div style="font-size: 24px; font-weight: 600; color: rgb(7, 59, 76);">${user.limits.storageLimit ? user.limits.storageLimit + ' GB' : '0 GB'}</div>
                <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Meeting Duration</div>
                <div style="font-size: 24px; font-weight: 600; color: rgb(7, 59, 76);">${user.limits.meetingDuration ? Math.floor(user.limits.meetingDuration / 60) + 'h ' + (user.limits.meetingDuration % 60) + 'm' : '0m'}</div>
            </div> : ""}
                <div id="recordingControls">
                    ${this.createButton("Start Recording", "startRecordingButton", true)}
                </div>
                <div style="border-top: 1px solid #eee; margin: 16px 0; padding-top: 16px;">
                    ${this.createButton("Sync Status", "syncStatusButton")}
                </div>
            </div>
        `;
    }

    static createMeetingItem(meeting) {
        return `
            <div class="meeting-item" style="margin-bottom: 10px;">
                <div class="meeting-title" style="font-weight: bold; color: rgb(7, 59, 76);">${meeting.title}</div>
                <button class="meeting-action" style="
                    padding: 8px 12px;
                    border: none;
                    border-radius: 4px;
                    background-color: rgb(46, 196, 182);
                    color: white;
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                "
                id="recordButton_${meeting.id}">Record</button>
            </div>
        `;
    }

    static createMeetingsList(meetings) {
        console.log(meetings);
        if (meetings.length === 0) {
            return "";
        }

        return `
            <div id="noteMeetMeetingsList" style="
                padding: 16px;
                background-color: #ffffff;
                border: 2px solid rgb(46, 196, 182);
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(7, 59, 76, 0.12);
            ">
                ${meetings.map(this.createMeetingItem).join('')}
            </div>
        `;
    }
    static createLoggedOutContent() {
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
