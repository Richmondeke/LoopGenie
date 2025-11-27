
/**
 * Stitches images and audio into a video CLIENT-SIDE using HTML5 Canvas and MediaRecorder.
 * This bypasses external API limits/schemas and works "Live" for immediate testing.
 * Includes audio mixing via Web Audio API.
 * 
 * Now supports resizing and cropping (object-cover) to target dimensions.
 */
export const stitchVideoFrames = async (
  images: string[], 
  audioUrl: string | undefined, 
  durationPerImageMs: number = 5000,
  targetWidth?: number,
  targetHeight?: number
): Promise<string> => {
  console.log("Starting client-side video stitching with audio...");

  // 1. Prepare Canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error("Could not get canvas context");

  // Determine size
  // If target dimensions are provided, use them. Otherwise infer from first image.
  const firstImage = await loadImage(images[0]);
  
  canvas.width = targetWidth || firstImage.naturalWidth;
  canvas.height = targetHeight || firstImage.naturalHeight;
  
  // Clear any existing content
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. Prepare Audio (if exists)
  let audioContext: AudioContext | null = null;
  let audioBuffer: AudioBuffer | null = null;
  let dest: MediaStreamAudioDestinationNode | null = null;
  let sourceNode: AudioBufferSourceNode | null = null;

  if (audioUrl) {
    try {
        // Use standard or webkit prefix
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContext = new AudioContextClass();
        
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Recalculate image duration to sync with audio
        // Total Audio Duration / Number of Images
        if (audioBuffer.duration && audioBuffer.duration > 0) {
            durationPerImageMs = (audioBuffer.duration * 1000) / images.length;
            console.log(`Syncing video to audio. Total: ${audioBuffer.duration}s. Per Image: ${durationPerImageMs}ms`);
        }

        // Create stream destination
        dest = audioContext.createMediaStreamDestination();
        sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(dest);
    } catch (e) {
        console.error("Error preparing audio for stitch:", e);
    }
  }

  // 3. Prepare Recorder with Mixed Stream
  const canvasStream = canvas.captureStream(30); // 30 FPS
  const combinedTracks = [...canvasStream.getVideoTracks()];
  
  if (dest) {
      const audioTracks = dest.stream.getAudioTracks();
      if (audioTracks.length > 0) {
          combinedTracks.push(audioTracks[0]);
      }
  }
  
  const combinedStream = new MediaStream(combinedTracks);

  // Check supported mime types
  const mimeTypes = [
      'video/webm; codecs=vp9',
      'video/webm; codecs=vp8',
      'video/webm',
      'video/mp4'
  ];
  
  let mimeType = 'video/webm';
  for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
      }
  }

  const recorder = new MediaRecorder(combinedStream, { 
      mimeType, 
      videoBitsPerSecond: 5000000 // High bitrate
  });
  
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start();
  
  // Start Audio Playback into Stream
  if (sourceNode && audioContext) {
      // Resume context if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
          await audioContext.resume();
      }
      sourceNode.start(0);
  }

  // 4. Draw Loop
  // We use a simple loop with setTimeout to pace the drawing.
  for (const imgSrc of images) {
      const img = await loadImage(imgSrc);
      
      // Calculate Object Cover logic
      // We want to fill canvas.width x canvas.height with img, maintaining aspect ratio, cropping excess.
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const targetRatio = canvas.width / canvas.height;
      
      let renderW, renderH, offsetX, offsetY;

      if (imgRatio > targetRatio) {
          // Image is wider than target
          renderH = canvas.height;
          renderW = img.naturalWidth * (canvas.height / img.naturalHeight);
          offsetX = (canvas.width - renderW) / 2; // Center horizontally
          offsetY = 0;
      } else {
          // Image is taller than target
          renderW = canvas.width;
          renderH = img.naturalHeight * (canvas.width / img.naturalWidth);
          offsetX = 0;
          offsetY = (canvas.height - renderH) / 2; // Center vertically
      }

      // Draw frames for the duration
      const startTime = Date.now();
      while (Date.now() - startTime < durationPerImageMs) {
          // Clear and Draw with crop
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
          
          // 30 FPS throttle
          await new Promise(r => setTimeout(r, 1000 / 30));
      }
  }

  // Stop recording
  recorder.stop();
  if (sourceNode) {
      try { sourceNode.stop(); } catch(e) {}
  }
  if (audioContext) {
      audioContext.close();
  }

  // 5. Return Blob URL
  return new Promise((resolve) => {
      recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          console.log("Stitching complete:", url);
          resolve(url);
      };
  });
};

// Helper to load image
const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
};
