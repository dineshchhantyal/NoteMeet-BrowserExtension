import { AppState } from "..";
import UIManager from "./UIManager";

// Recording Service
export default class RecordingService {
    static async startRecording(meetingId = null) {
        if (AppState.isRecordingSetupInProgress) {
            console.warn("Recording setup is already in progress.");
            return;
        }

        if (meetingId) {
            AppState.meetingId = meetingId;
        } else {
            AppState.meetingId = null;
        }

        AppState.isRecordingSetupInProgress = true;

        try {
            let response;
            if (AppState.meetingId) {
                response = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({ type: "GET_PRESIGNED_UPLOAD_URL_BY_MEETING_ID", data: { meetingId: AppState.meetingId } }, resolve);
                });
            } else {
                response = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({ type: "GET_PRESIGNED_URL" }, resolve);
                });
            }

            console.log("Response:", response);

            if (!response?.success) {
                throw new Error(response?.error || "Failed to get presigned URL");
            }
            
            AppState.presignedUrl = response.presignedUrl;

            if (!AppState.presignedUrl) {
                throw new Error("Failed to get presigned URL");
            }

            UIManager.updateStatus("recording");
            await RecordingService.setupMediaStreams();
            await RecordingService.initializeRecorder();
        } catch (error) {
            UIManager.updateStatus("idle");
            console.error("Error starting recording:", error.message);
            UIManager.resetUI();
            alert("Failed to start recording. Please check permissions.");
        } finally {
            AppState.isRecordingSetupInProgress = false;
            AppState.meetingId = null;
        }
    }

    static async setupMediaStreams() {
        AppState.mediaState.screenStream =
            await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: "browser",
                    width: { ideal: 1920, max: 1920 },
                    height: { ideal: 1080, max: 1080 },
                    selfBrowserSurface: "include",
                },
                audio: true,
                selfBrowserSurface: "include",
            });

        AppState.mediaState.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 2,
            },
            video: false,
        });

        AppState.mediaState.audioContext = new AudioContext();
        const audioDest = AppState.mediaState.audioContext.createMediaStreamDestination();

        if (AppState.mediaState.screenStream.getAudioTracks().length > 0) {
            const screenAudioSource =
                AppState.mediaState.audioContext.createMediaStreamSource(
                    AppState.mediaState.screenStream
                );
            screenAudioSource.connect(audioDest);
        }

        if (AppState.mediaState.micStream.getAudioTracks().length > 0) {
            const micAudioSource =
                AppState.mediaState.audioContext.createMediaStreamSource(
                    AppState.mediaState.micStream
                );
            micAudioSource.connect(audioDest);
        }

        const audioElements = Array.from(document.querySelectorAll("audio, video"));
        audioElements.forEach((element) => {
            if (element.srcObject && element.srcObject.getAudioTracks().length > 0) {
                const source = AppState.mediaState.audioContext.createMediaStreamSource(
                    element.srcObject
                );
                source.connect(audioDest);
            }
        });
    }

    static async initializeRecorder() {
        const combinedStream = new MediaStream([
            ...AppState.mediaState.screenStream.getVideoTracks(),
            ...AppState.mediaState.micStream.getAudioTracks(),
        ]);

        AppState.mediaState.recorder = new MediaRecorder(combinedStream, {
            mimeType: "video/webm",
            audioBitsPerSecond: 128000,
            videoBitsPerSecond: 2500000,
        });

        AppState.recordedChunks = [];

        const uploadStream = new WritableStream({
            write: async (chunk, controller) => {
                try {
                    await fetch(AppState.presignedUrl, {
                        method: "PUT",
                        body: chunk,
                        headers: {
                            "Content-Type": "video/webm",
                        },
                    });
                } catch (error) {
                    console.error("Error uploading chunk:", error);
                }
            },
        });

        const writer = uploadStream.getWriter();

        AppState.mediaState.recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                AppState.recordedChunks.push(event.data)
                writer.write(event.data);
            }
        };

        AppState.mediaState.recorder.start();
        UIManager.updateRecordingControls();
    }

    static async stopRecording() {
        try {
            UIManager.updateStatus("processing");

            if (AppState.mediaState.recorder?.state === "recording") {
                const stopRecordingPromise = new Promise((resolve) => {
                    AppState.mediaState.recorder.onstop = resolve;
                });

                AppState.mediaState.recorder.stop();
                await stopRecordingPromise;
            }

            await this.processRecordedData();
            await this.cleanupMediaResources();

            UIManager.updateStatus("idle");
        } catch (error) {
            console.error("Error stopping recording:", error);
            UIManager.resetUI();
        }
    }

    static async processRecordedData() {
        const recordedBlob = new Blob(AppState.recordedChunks, {
            type: "video/webm",
        });

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                AppState.recordedVideoBase64 = reader.result;
                resolve();
            };
            reader.readAsDataURL(recordedBlob);
        });
    }

    static async cleanupMediaResources() {
        if (AppState.mediaState.screenStream) {
            AppState.mediaState.screenStream
                .getTracks()
                .forEach((track) => track.stop());
        }
        if (AppState.mediaState.micStream) {
            AppState.mediaState.micStream
                .getTracks()
                .forEach((track) => track.stop());
        }
        if (AppState.mediaState.audioContext) {
            await AppState.mediaState.audioContext.close();
        }
    }


    static async getMeetings() {
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: "GET_MEETINGS" }, resolve);
        });
        if (response.success) {
            return response.meetings;
        }
        return [];
    }
}

