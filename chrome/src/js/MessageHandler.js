class MessageHandler {
    static init() {
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    }

    static handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case "AUTH_STATE_CHANGED":
                UIManager.updatePanelContent(message.user);
                UIComponents.minimizedPanel.style.display = "flex"; // Show minimized panel on auth state change
                sendResponse({ success: true });
                break;
            default:
                console.warn("Unhandled message type:", message.type);
                break;
        }
        return true;
    }
}