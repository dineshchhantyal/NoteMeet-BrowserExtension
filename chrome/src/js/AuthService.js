import { CONFIG } from "../index.js";
import UIManager from "./UIManager.js";
import UIComponents from "./UIComponent.js";

// Authentication Service
export default class AuthService {
    static async checkAuthStatus() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: "CHECK_AUTH" }, (response) => {
                resolve(response.user || null);
            });
        });
    }

    static async getUserSubscription() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: "GET_USER_SUBSCRIPTION" }, (response) => {
                resolve(response.data || null);
            });
        });
    }

    static async handleAuth() {
        const loginForm = `
            <div style="text-align: center; padding: 12px 0;">
                ${UIComponents.createHeader()}
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
                    <a href=${CONFIG.AUTH_BASE_URL}
                        style="font-size: 12px; color: #666; text-decoration: none;">
                        Use web signin
                    </a>
                    <div id="loginError" style="color: red; font-size: 12px; margin-top: 8px; display: none;"></div>
                </form>
            </div>
        `;

        UIComponents.panel.innerHTML = loginForm;
        this.attachLoginFormListeners();
    }

    static attachLoginFormListeners() {
        const form = document.getElementById("loginForm");
        form?.addEventListener("submit", this.handleLoginSubmit.bind(this));
    }

    static async handleLoginSubmit(e) {
        e.stopPropagation();
        e.preventDefault();
        const submitButton = document.getElementById("loginSubmitButton");
        const spinner = submitButton.querySelector(".loading-spinner");
        const buttonText = submitButton.querySelector("span");

        try {
            submitButton.disabled = true;
            spinner.style.display = "block";
            buttonText.textContent = "Signing in...";

            const message = {
                type: "LOGIN",
                data: {
                    email: document.getElementById("email").value,
                    password: document.getElementById("password").value,
                },
            };

            chrome.runtime.sendMessage(message, (response) => {
                if (response.success) {
                    UIManager.updatePanelContent(response.user);
                    UIComponents.minimizedPanel.style.display = "flex"; // Show minimized panel on successful login
                } else {
                    const errorDiv = document.getElementById("loginError");
                    errorDiv.textContent = response.error || "Login failed";
                    errorDiv.style.display = "block";
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
            submitButton.disabled = false;
            spinner.style.display = "none";
            buttonText.textContent = "Sign In";
        }
    }
}
  