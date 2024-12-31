// Recording Service
class RecordingService {
    async startRecording() {
        if (AppState.isRecordingSetupInProgress) {
            console.warn("Recording setup is already in progress.");
            return;
        }

        AppState.isRecordingSetupInProgress = true;

        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: "GET_PRESIGNED_URL" }, resolve);
            });

            if (!response?.success) {
                throw new Error(response?.error || "Failed to get presigned URL");
            }

            UIManager.updateStatus("recording");
            await this.setupMediaStreams();
            await this.initializeRecorder();
        } catch (error) {
            console.error("Error starting recording:", error);
            UIManager.resetUI();
            alert("Failed to start recording. Please check permissions.");
        } finally {
            AppState.isRecordingSetupInProgress = false;
        }
    }

    async setupMediaStreams() {
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

    async initializeRecorder() {
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

        AppState.mediaState.recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                AppState.recordedChunks.push(event.data);
            }
        };

        AppState.mediaState.recorder.start();
        UIManager.updateRecordingUI();
    }

    async stopRecording() {
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

    async processRecordedData() {
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

    async cleanupMediaResources() {
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
}
