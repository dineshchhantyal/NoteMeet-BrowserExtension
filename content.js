// Content script that runs on Google Meet pages
console.log("NoteMeet content script loaded");

console.log("NoteMeet Extension Activated");

// Function to upload recording
function uploadToNoteMeet(blob) {
  const formData = new FormData();
  formData.append("file", blob);

  fetch("https://notemeet.dineshchhantyal.com/upload", {
    method: "POST",
    body: formData,
    headers: {
      Authorization: "Bearer your-auth-token", // Replace with user's token
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

function floatingWindow() {
  // Create a floating panel
  const panel = document.createElement("div");
  panel.id = "noteMeetPanel";
  panel.style.position = "fixed";
  panel.style.top = "10px";
  panel.style.right = "10px";
  panel.style.width = "200px";
  panel.style.height = "auto";
  panel.style.backgroundColor = "#fff";
  panel.style.border = "1px solid #ccc";
  panel.style.borderRadius = "8px";
  panel.style.boxShadow = "0px 4px 10px rgba(0, 0, 0, 0.2)";
  panel.style.zIndex = "9999";
  panel.style.padding = "12px";
  panel.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px;">NoteMeet Recorder</h3>
      <button id="startRecording" style="padding: 6px;">Start Recording</button>
      <button id="stopRecording" style="padding: 6px;">Stop Recording</button>
      <button id="closePanel" style="padding: 6px;">Close</button>
    </div>
  `;

  // Add the panel to the body
  document.body.appendChild(panel);

  // Add functionality to close the panel
  document.getElementById("closePanel").addEventListener("click", () => {
    document.body.removeChild(panel);
  });

  // Update the event listeners
  document.getElementById("startRecording").addEventListener("click", () => {
    console.log("Starting recording...");   
    startRecording(); // Call the actual recording function instead of showing alert
  });

  document.getElementById("stopRecording").addEventListener("click", () => {
    if (window.stopScreenRecording) {
      window.stopScreenRecording(); // Call the stop function if it exists
    } else {
      console.warn("Recording hasn't been started yet");
    }
  });
}

floatingWindow();
