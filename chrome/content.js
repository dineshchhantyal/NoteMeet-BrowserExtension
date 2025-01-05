(()=>{"use strict";var e={d:(t,n)=>{for(var i in n)e.o(n,i)&&!e.o(t,i)&&Object.defineProperty(t,i,{enumerable:!0,get:n[i]})},o:(e,t)=>Object.prototype.hasOwnProperty.call(e,t)};e.d({},{t:()=>r,P:()=>s});class t{constructor(){this.panel=null,this.minimizedPanel=null,this.meetingsList=null,this.recordButton=null}static createHeader(){return`\n            <div style="text-align: center; margin-bottom: 16px;">\n                <img src="${s.LOGO_URL}" alt="NoteMeet" style="width: 120px;">\n                <h2 style="color: rgb(7, 59, 76); margin: 8px 0 0 0; font-size: 14px;">\n                    NoteMeet\n                </h2>\n            </div>\n        `}static createButton(e,t,n=!1){return`\n            <button \n                id="${t}"\n                style="\n                    width: 100%;\n                    padding: 10px 16px;\n                    border: none;\n                    border-radius: 6px;\n                    font-size: 14px;\n                    font-weight: 500;\n                    cursor: pointer;\n                    transition: all 0.2s ease;\n                    background-color: ${n?"rgb(46, 196, 182)":"rgb(7, 59, 76)"};\n                    color: white;\n                    margin-bottom: 8px;\n                "\n            >\n                ${e}\n            </button>\n        `}static createLoggedInContent(e){return`\n            <div style="text-align: center;">\n                ${this.createHeader()}\n                <div style="display: flex; align-items: center; margin-bottom: 16px;">\n                    <div style="text-align: left;">\n                        <div style="font-weight: 500; color: rgb(7, 59, 76);">${e.name}</div>\n                        <div style="font-size: 12px; color: #666;">${e.email}</div>\n                    </div>\n                </div>\n                <div style="margin-bottom: 16px;">\n                    <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Your Subscription\n                    <span style="font-size: 12px; color: #666; background-color: #f0f0f0; padding: 4px 8px; border-radius: 4px;">${e.subscriptions[0].plan.name?e.subscriptions[0].plan.name:"Free"}</span>\n                    </div>\n                    <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Meetings Allowed</div>\n                    <div style="font-size: 24px; font-weight: 600; color: rgb(7, 59, 76);">${e.limits.meetingsAllowed?e.limits.meetingsAllowed:0}</div>\n                    <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Storage Limit</div>\n                    <div style="font-size: 24px; font-weight: 600; color: rgb(7, 59, 76);">${e.limits.storageLimit?e.limits.storageLimit+" GB":"0 GB"}</div>\n                    <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Meeting Duration</div>\n                    <div style="font-size: 24px; font-weight: 600; color: rgb(7, 59, 76);">${e.limits.meetingDuration?Math.floor(e.limits.meetingDuration/60)+"h "+e.limits.meetingDuration%60+"m":"0m"}</div>\n                </div>\n                <div id="recordingControls">\n                    ${this.createButton("Start Recording","startRecordingButton",!0)}\n                </div>\n                <div style="border-top: 1px solid #eee; margin: 16px 0; padding-top: 16px;">\n                    ${this.createButton("Sync Status","syncStatusButton")}\n                </div>\n            </div>\n        `}static createMeetingItem(e){return`\n            <div class="meeting-item" style="margin-bottom: 10px;">\n                <div class="meeting-title" style="font-weight: bold; color: rgb(7, 59, 76);">${e.title}</div>\n                <button class="meeting-action" style="\n                    padding: 8px 12px;\n                    border: none;\n                    border-radius: 4px;\n                    background-color: rgb(46, 196, 182);\n                    color: white;\n                    cursor: pointer;\n                    transition: background-color 0.2s ease;\n                "\n                id="recordButton_${e.id}">Record</button>\n            </div>\n        `}static createMeetingsList(e){return console.log(e),0===e.length?"":`\n            <div id="noteMeetMeetingsList" style="\n                padding: 16px;\n                background-color: #ffffff;\n                border: 2px solid rgb(46, 196, 182);\n                border-radius: 12px;\n                box-shadow: 0 8px 24px rgba(7, 59, 76, 0.12);\n            ">\n                ${e.map(this.createMeetingItem).join("")}\n            </div>\n        `}static createLoggedOutContent(){return`\n            <div style="text-align: center; padding: 12px 0;">\n                ${this.createHeader()}\n                <p style="color: rgb(7, 59, 76); margin: 0 0 16px 0; font-size: 14px;">\n                    Sign in to start recording your meetings\n                </p>\n                ${this.createButton("Sign In","signInButton",!0)}\n                <p style="margin-top: 12px; font-size: 13px;">\n                    Don't have an account? \n                    <a href=${s.AUTH_BASE_URL}/auth/register\n                       target="_blank"\n                       style="color: rgb(46, 196, 182); text-decoration: none;">\n                      Sign up\n                    </a>\n                </p>\n            </div>\n        `}}class n{static recordingTimeout=null;static async startRecording(e=null){if(console.log("AppState.userLimits",r.userLimits),r.isRecordingSetupInProgress)console.warn("Recording setup is already in progress.");else{r.meetingId=e||null,r.isRecordingSetupInProgress=!0;try{let e;if(e=r.meetingId?await new Promise((e=>{chrome.runtime.sendMessage({type:"GET_PRESIGNED_UPLOAD_URL_BY_MEETING_ID",data:{meetingId:r.meetingId}},e)})):await new Promise((e=>{chrome.runtime.sendMessage({type:"GET_PRESIGNED_URL"},e)})),console.log("Response:",e),!e?.success)throw new Error(e?.error||"Failed to get presigned URL");if(r.presignedUrl=e.presignedUrl,!r.presignedUrl)throw new Error("Failed to get presigned URL");if(o.updateStatus("recording"),await n.setupMediaStreams(),await n.initializeRecorder(),r.userLimits&&r.userLimits.meetingDuration){const e=60*r.userLimits.meetingDuration*1e3;this.recordingTimeout=setTimeout((()=>{this.stopRecording()}),e)}}catch(e){o.updateStatus("idle"),console.error("Error starting recording:",e.message),o.resetUI(),alert("Failed to start recording. Please check permissions.")}finally{r.isRecordingSetupInProgress=!1,r.meetingId=null}}}static async setupMediaStreams(){r.mediaState.screenStream=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:"browser",width:{ideal:1920,max:1920},height:{ideal:1080,max:1080},selfBrowserSurface:"include"},audio:!0,selfBrowserSurface:"include"}),r.mediaState.micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0,channelCount:2},video:!1}),r.mediaState.audioContext=new AudioContext;const e=r.mediaState.audioContext.createMediaStreamDestination();r.mediaState.screenStream.getAudioTracks().length>0&&r.mediaState.audioContext.createMediaStreamSource(r.mediaState.screenStream).connect(e),r.mediaState.micStream.getAudioTracks().length>0&&r.mediaState.audioContext.createMediaStreamSource(r.mediaState.micStream).connect(e),Array.from(document.querySelectorAll("audio, video")).forEach((t=>{t.srcObject&&t.srcObject.getAudioTracks().length>0&&r.mediaState.audioContext.createMediaStreamSource(t.srcObject).connect(e)}))}static async initializeRecorder(){const e=new MediaStream([...r.mediaState.screenStream.getVideoTracks(),...r.mediaState.micStream.getAudioTracks()]);r.mediaState.recorder=new MediaRecorder(e,{mimeType:"video/webm",audioBitsPerSecond:128e3,videoBitsPerSecond:25e5}),r.recordedChunks=[];const t=new WritableStream({write:async(e,t)=>{try{await fetch(r.presignedUrl,{method:"PUT",body:e,headers:{"Content-Type":"video/webm"}})}catch(e){console.error("Error uploading chunk:",e)}}}).getWriter();r.mediaState.recorder.ondataavailable=e=>{e.data.size>0&&(r.recordedChunks.push(e.data),t.write(e.data))},r.mediaState.recorder.start(),o.updateRecordingControls()}static async stopRecording(){this.recordingTimeout&&(clearTimeout(this.recordingTimeout),this.recordingTimeout=null);try{if(o.updateStatus("processing"),"recording"===r.mediaState.recorder?.state){const e=new Promise((e=>{r.mediaState.recorder.onstop=e}));r.mediaState.recorder.stop(),await e}await this.processRecordedData(),await this.cleanupMediaResources(),o.updateStatus("idle")}catch(e){console.error("Error stopping recording:",e),o.resetUI()}}static async processRecordedData(){const e=new Blob(r.recordedChunks,{type:"video/webm"});return new Promise((t=>{const n=new FileReader;n.onloadend=()=>{r.recordedVideoBase64=n.result,t()},n.readAsDataURL(e)}))}static async cleanupMediaResources(){r.mediaState.screenStream&&r.mediaState.screenStream.getTracks().forEach((e=>e.stop())),r.mediaState.micStream&&r.mediaState.micStream.getTracks().forEach((e=>e.stop())),r.mediaState.audioContext&&await r.mediaState.audioContext.close()}static async getMeetings(){const e=await new Promise((e=>{chrome.runtime.sendMessage({type:"GET_MEETINGS"},e)}));return e.success?e.meetings:[]}}class i{static async checkAuthStatus(){return new Promise((e=>{chrome.runtime.sendMessage({type:"CHECK_AUTH"},(t=>{e(t.user||null)}))}))}static async getUserSubscription(){return new Promise((e=>{chrome.runtime.sendMessage({type:"GET_USER_SUBSCRIPTION"},(t=>{e(t.data||null)}))}))}static async handleAuth(){const e=`\n            <div style="text-align: center; padding: 12px 0;">\n                ${t.createHeader()}\n                <form id="loginForm" style="display: flex; flex-direction: column; gap: 12px;">\n                    <input \n                        type="email" \n                        id="email" \n                        placeholder="Email"\n                        style="padding: 8px; border-radius: 4px; border: 1px solid #ddd;"\n                    >\n                    <input \n                        type="password" \n                        id="password" \n                        placeholder="Password"\n                        style="padding: 8px; border-radius: 4px; border: 1px solid #ddd;"\n                    >\n                    <button type="submit" style="\n                        padding: 10px 16px;\n                        border: none;\n                        border-radius: 6px;\n                        background-color: rgb(46, 196, 182);\n                        color: white;\n                        cursor: pointer;\n                        position: relative;\n                        min-width: 100px;\n                    " id="loginSubmitButton">\n                        <span>Sign In</span>\n                        <div class="loading-spinner" style="\n                            display: none;\n                            position: absolute;\n                            right: 10px;\n                            top: 50%;\n                            transform: translateY(-50%);\n                            width: 12px;\n                            height: 12px;\n                            border: 2px solid #ffffff;\n                            border-top: 2px solid transparent;\n                            border-radius: 50%;\n                            animation: spin 1s linear infinite;\n                        "></div>\n                    </button>\n                    <a href=${s.AUTH_BASE_URL}\n                        style="font-size: 12px; color: #666; text-decoration: none;">\n                        Use web signin\n                    </a>\n                    <div id="loginError" style="color: red; font-size: 12px; margin-top: 8px; display: none;"></div>\n                </form>\n            </div>\n        `;t.panel.innerHTML=e,this.attachLoginFormListeners()}static attachLoginFormListeners(){const e=document.getElementById("loginForm");e?.addEventListener("submit",this.handleLoginSubmit.bind(this))}static async handleLoginSubmit(e){e.stopPropagation(),e.preventDefault();const n=document.getElementById("loginSubmitButton"),i=n.querySelector(".loading-spinner"),s=n.querySelector("span");try{n.disabled=!0,i.style.display="block",s.textContent="Signing in...";const e={type:"LOGIN",data:{email:document.getElementById("email").value,password:document.getElementById("password").value}};chrome.runtime.sendMessage(e,(e=>{if(e.success)o.updatePanelContent(e.user),t.minimizedPanel.style.display="flex";else{const t=document.getElementById("loginError");t.textContent=e.error||"Login failed",t.style.display="block",n.disabled=!1,i.style.display="none",s.textContent="Sign In"}}))}catch(e){console.error("Login error:",e);const t=document.getElementById("loginError");t.textContent="Login failed",t.style.display="block",n.disabled=!1,i.style.display="none",s.textContent="Sign In"}}}class o{static init(){this.initializeStyles(),this.checkInitialAuth(),this.createFloatingWindow(),this.attachEventListeners()}static initializeStyles(){const e=document.createElement("style");e.textContent="\n            #noteMeetPanel {\n                transition: opacity 0.3s ease, transform 0.3s ease;\n            }\n            #noteMeetMinimizedPanel {\n                transition: opacity 0.3s ease;\n            }\n\n            @keyframes recording-pulse {\n                0% {\n                    box-shadow: 0 0 0 0 rgba(234, 67, 53, 0.4);\n                    border-color: rgba(234, 67, 53, 0.8);\n                }\n                70% {\n                    box-shadow: 0 0 0 15px rgba(234, 67, 53, 0);\n                    border-color: rgba(234, 67, 53, 1);\n                }\n                100% {\n                    box-shadow: 0 0 0 0 rgba(234, 67, 53, 0);\n                    border-color: rgba(234, 67, 53, 0.8);\n                }\n            }\n\n            @keyframes status-dot-pulse {\n                0% {\n                    transform: scale(1);\n                    opacity: 1;\n                }\n                50% {\n                    transform: scale(1.2);\n                    opacity: 0.8;\n                }\n                100% {\n                    transform: scale(1);\n                    opacity: 1;\n                }\n            }\n        ",document.head.appendChild(e)}static createFloatingWindow(){t.minimizedPanel=document.createElement("div"),t.minimizedPanel.id="noteMeetMinimizedPanel",t.minimizedPanel.innerHTML=`<img src="${s.LOGO_URL}" alt="NoteMeet Logo" style="width: 24px; height: 24px;">`,this.applyMinimizedPanelStyles(),t.panel=document.createElement("div"),t.panel.id="noteMeetPanel",this.applyMainPanelStyles(),document.body.appendChild(t.minimizedPanel),document.body.appendChild(t.panel)}static applyMinimizedPanelStyles(){t.minimizedPanel.style.cssText="\n            position: fixed;\n            top: 20px;\n            right: 20px;\n            width: 48px;\n            height: 48px;\n            background-color: #ffffff;\n            border: 2px solid rgb(46, 196, 182);\n            border-radius: 50%;\n            box-shadow: 0 4px 12px rgba(7, 59, 76, 0.12);\n            z-index: 9999;\n            cursor: pointer;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n            opacity: 1;\n            transform: scale(1);\n            user-select: none;\n            -webkit-user-select: none;\n            touch-action: none;\n        "}static async checkInitialAuth(){const e=await i.checkAuthStatus(),t=await i.getUserSubscription();e&&t&&t.subscriptions&&t.limits&&(e.subscriptions=t.subscriptions,e.limits=t.limits,r.userLimits=t.limits,r.userSubscription=t.subscriptions),this.updatePanelContent(e)}static applyMainPanelStyles(){t.panel.style.cssText='\n            position: fixed;\n            top: 20px;\n            right: 20px;\n            width: 280px;\n            height: auto;\n            background-color: #ffffff;\n            border: 2px solid rgb(46, 196, 182);\n            border-radius: 12px;\n            box-shadow: 0 8px 24px rgba(7, 59, 76, 0.12);\n            z-index: 9998;\n            padding: 16px;\n            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\n            opacity: 0;\n            visibility: hidden;\n            transform: translateY(-10px) scale(0.95);\n            transform-origin: top right;\n            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n            pointer-events: none;\n            user-select: none;\n            -webkit-user-select: none;\n            touch-action: none;\n        '}static updateStatus(e){const n=t.minimizedPanel.querySelector(".recording-status, .processing-status");switch(n&&n.remove(),t.minimizedPanel.style.animation="none",t.minimizedPanel.style.borderColor="",t.minimizedPanel.style.boxShadow="",e){case"recording":t.minimizedPanel.style.animation="recording-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",t.minimizedPanel.style.borderColor="#ea4335",this.addStatusDot("recording-status");break;case"processing":t.minimizedPanel.style.borderColor="#fbbc04",this.addStatusDot("processing-status");break;default:t.minimizedPanel.style.borderColor="rgb(46, 196, 182)",t.minimizedPanel.style.boxShadow="0 4px 12px rgba(7, 59, 76, 0.12)"}}static addStatusDot(e){const n=document.createElement("div");n.className=e,t.minimizedPanel.appendChild(n)}static async updatePanelContent(e){if(e){t.panel.innerHTML=t.createLoggedInContent(e);const i=await n.getMeetings(),o=t.createMeetingsList(i);t.panel.innerHTML+=o,this.attachUserPanelListeners(e)}else{t.panel.innerHTML=t.createLoggedOutContent();const e=t.panel.querySelector("#signInButton");e?.addEventListener("click",(()=>i.handleAuth()))}t.minimizedPanel.addEventListener("mouseenter",this.showPanel.bind(this)),t.panel.addEventListener("mouseleave",this.hidePanel.bind(this))}static attachUserPanelListeners(){const e=t.panel.querySelector("#startRecordingButton"),i=t.panel.querySelector("#syncStatusButton");e?e.addEventListener("click",(()=>n.startRecording())):console.error("Start Recording Button not found!"),i?.addEventListener("click",this.handleSyncStatus.bind(this));const o=t.panel.querySelectorAll("[id^='recordButton_']");console.log("Meeting buttons:",o),o.forEach((e=>{e.addEventListener("click",(()=>{console.log("Record button clicked");const t=e.id.split("_")[1];console.log("Meeting ID:",t),n.startRecording(t)}))}))}static togglePanel(){"flex"===t.minimizedPanel.style.display?this.hidePanel():this.showPanel()}static showPanel(){t.minimizedPanel.style.opacity="0",t.minimizedPanel.style.pointerEvents="none",t.panel.style.visibility="visible",t.panel.style.opacity="1",t.panel.style.pointerEvents="auto",t.panel.style.transform="translateY(0) scale(1)"}static hidePanel(){t.panel.style.opacity="0",t.panel.style.pointerEvents="none",t.panel.style.transform="translateY(-10px) scale(0.95)",setTimeout((()=>{t.panel.style.visibility="hidden"}),300),t.minimizedPanel.style.opacity="1",t.minimizedPanel.style.pointerEvents="auto"}static updateRecordingControls(){const e=t.panel.querySelector("#recordingControls");e.innerHTML=`\n            ${t.createButton("Stop Recording","stopRecordingButton")}\n            <div id="recordingStatus" style="font-size: 12px; color: #666; margin-top: 8px;">\n                Recording in progress...\n            </div>\n        `;const n=e.querySelector("#stopRecordingButton");if(n?.addEventListener("click",this.handleStopRecording.bind(this)),r.meetingId){const e=t.panel.querySelector(`#recordButton_${r.meetingId}`);e.disabled=!0,e.textContent="Recording..."}}static async handleStopRecording(){const e=t.panel.querySelector("#stopRecordingButton");e.disabled=!0,e.textContent="Processing...";try{await n.stopRecording(),this.showPostRecordingControls()}catch(e){console.error("Error in stop recording handler:",e),this.resetUI()}}static showPostRecordingControls(){t.panel.querySelector("#recordingControls").innerHTML=`\n    ${t.createButton("Start New Recording","startRecordingButton",!0)}\n`,this.attachPostRecordingListeners()}static attachPostRecordingListeners(){const e=t.panel.querySelector("#startRecordingButton"),n=t.panel.querySelector("#saveRecordingButton");e?.addEventListener("click",(()=>{i.checkAuthStatus().then((async e=>{if(e){const t=await i.getUserSubscription();t&&(e.subscriptions=t.subscriptions,e.limits=t.limits,r.userLimits=e.limits,r.userSubscription=e.subscriptions),this.updatePanelContent(e)}}))})),n?.addEventListener("click",this.handleSaveRecording.bind(this))}static async handleSaveRecording(){try{const e=new Blob(r.recordedChunks,{type:"video/webm"}),t=URL.createObjectURL(e),n=document.createElement("a");n.href=t,n.download=`NoteMeet_Recording_${(new Date).toISOString().slice(0,19)}.webm`,document.body.appendChild(n),n.click(),document.body.removeChild(n),URL.revokeObjectURL(t)}catch(e){console.error("Error downloading recording:",e)}}static async handleSyncStatus(){const e=t.panel.querySelector("#syncStatusButton"),n=e.textContent;e.disabled=!0,e.textContent="Checking sync status...";try{this.showSyncDialog()}catch(t){console.error("Error showing sync status:",t),e.disabled=!1,e.textContent=n+" (Error)"}}static showSyncDialog(){const e=document.createElement("div");e.style.cssText="\n            position: fixed;\n            top: 50%;\n            left: 50%;\n            transform: translate(-50%, -50%);\n            background: white;\n            padding: 20px;\n            border-radius: 8px;\n            box-shadow: 0 2px 10px rgba(0,0,0,0.1);\n            z-index: 10000;\n            max-width: 400px;\n            text-align: center;\n        ",e.innerHTML='\n            <h3 style="margin: 0 0 15px 0; color: #1a73e8;">✓ All Set!</h3>\n            <p style="margin: 0 0 15px 0; color: #5f6368;">\n                Your notes and recordings are synced with NoteMeet.\n                Visit <a href="https://notemeet.dineshchhantyal.com/dashboard" target="_blank" style="color: #1a73e8; text-decoration: none;">\n                    notemeet.dineshchhantyal.com\n                </a> \n                to access all your content.\n            </p>\n            <button style="\n                background: #1a73e8;\n                color: white;\n                border: none;\n                padding: 8px 16px;\n                border-radius: 4px;\n                cursor: pointer;\n            ">Got it</button>\n        ',document.body.appendChild(e),e.querySelector("button").onclick=()=>{document.body.removeChild(e);const n=t.panel.querySelector("#syncStatusButton");n&&(n.disabled=!1,n.textContent="Sync Status")}}static resetUI(){t.recordButton&&(t.recordButton.textContent="Start Recording",t.recordButton.style.backgroundColor="#1a73e8",t.recordButton.disabled=!1);const e=t.minimizedPanel.querySelector(".loading-indicator");e&&(e.style.display="none")}static attachEventListeners(){const e=document.getElementById("startRecordingButton");e&&e.addEventListener("click",n.startRecording);const i=document.getElementById("syncStatusButton");i&&i.addEventListener("click",this.handleSyncStatus.bind(this));const o=document.getElementById("saveRecordingButton");o&&o.addEventListener("click",this.handleSaveRecording.bind(this)),t.panel.style.cursor="grab",this.boundDragMouseDown=this.dragMouseDown.bind(this),this.boundElementDrag=this.elementDrag.bind(this),this.boundCloseDragElement=this.closeDragElement.bind(this),t.panel.addEventListener("mousedown",this.boundDragMouseDown)}static dragMouseDown(e){e&&(e.preventDefault(),t.panel.style.cursor="grabbing",r.isDragging=!0,r.startX=e.clientX,r.startY=e.clientY,r.initialLeft=t.panel.offsetLeft,r.initialTop=t.panel.offsetTop,r.panelWidth=t.panel.offsetWidth,r.panelHeight=t.panel.offsetHeight,document.addEventListener("mousemove",this.boundElementDrag),document.addEventListener("mouseup",this.boundCloseDragElement))}static elementDrag(e){if(!e||!r.isDragging)return;e.preventDefault();const n=e.clientX-r.startX,i=e.clientY-r.startY;let o=r.initialLeft+n,s=r.initialTop+i;const a=window.innerWidth-r.panelWidth,d=window.innerHeight-r.panelHeight;o=Math.max(0,Math.min(o,a)),s=Math.max(0,Math.min(s,d)),t.panel.style.left=`${o}px`,t.panel.style.top=`${s}px`}static closeDragElement(){if(!r.isDragging)return;t.panel.style.cursor="grab",document.removeEventListener("mousemove",this.boundElementDrag),document.removeEventListener("mouseup",this.boundCloseDragElement);const e=t.panel,n=t.minimizedPanel,i=window.innerWidth,o=e.offsetLeft,s=e.offsetTop,a=o,d=i-(o+e.offsetWidth);let l;l=a<d?0:i-n.offsetWidth;const c=s,p=e=>{e.style.transition="all 0.3s ease",e.style.left=`${l}px`,e.style.top=`${c}px`};p(e),p(n),localStorage.setItem("panelPosition",JSON.stringify({left:l,top:c,side:a<d?"left":"right"})),setTimeout((()=>{e.style.transition="",n.style.transition=""}),300),r.isDragging=!1,r.startX=null,r.startY=null,this.restorePosition()}static restorePosition(){const e=localStorage.getItem("panelPosition");if(e){const{left:n,top:i,side:o}=JSON.parse(e),s=window.innerWidth-t.minimizedPanel.offsetWidth,r=window.innerHeight-t.minimizedPanel.offsetHeight,a=Math.max(0,Math.min(n,s)),d=Math.max(0,Math.min(i,r));t.minimizedPanel.style.left=`${a}px`,t.minimizedPanel.style.top=`${d}px`;const l="right"===o?a-t.panel.offsetWidth+t.minimizedPanel.offsetWidth:a+t.minimizedPanel.offsetWidth-t.panel.offsetWidth;t.panel.style.left=`${Math.max(0,l)}px`,t.panel.style.top=`${d}px`}}static cleanup(){t.panel.removeEventListener("mousedown",this.boundDragMouseDown),document.removeEventListener("mousemove",this.boundElementDrag),document.removeEventListener("mouseup",this.boundCloseDragElement)}}const s={AUTH_BASE_URL:"https://notemeet.dineshchhantyal.com",LOGO_URL:chrome.runtime.getURL("icons/icon.png")},r={isRecording:!1,isRecordingSetupInProgress:!1,isExpanded:!1,recordedVideoBase64:null,x:0,y:0,recordedChunks:[],presignedUrl:null,mediaState:{recorder:null,screenStream:null,micStream:null,audioContext:null},meetingId:null,userLimits:{meetingsAllowed:0,storageLimit:0,meetingDuration:0},userSubscription:null};o.init(),class{static init(){chrome.runtime.onMessage.addListener(this.handleMessage.bind(this))}static handleMessage(e,n,i){return"AUTH_STATE_CHANGED"===e.type?(o.updatePanelContent(e.user),t.minimizedPanel.style.display="flex",i({success:!0})):console.warn("Unhandled message type:",e.type),!0}}.init()})();