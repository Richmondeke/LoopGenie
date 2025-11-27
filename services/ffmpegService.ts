
/**
 * Stitches images and audio into a video CLIENT-SIDE using HTML5 Canvas and MediaRecorder.
 * This bypasses external API limits/schemas and works "Live" for immediate testing.
 * Includes audio mixing via Web Audio API.
 */
export const stitchVideoFrames = async (
  images: string[], 
  audioUrl: string | undefined, 
  durationPerImageMs: number = 5000
): Promise<string> => {
  console.log("Starting client-side video stitching with audio...");

  // 1. Prepare Canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error("Could not get canvas context");

  // Determine size from first image
  // We wait for the first image to load to set canvas dimensions
  const firstImage = await loadImage(images[0]);
  canvas.width = firstImage.naturalWidth;
  canvas.height = firstImage.naturalHeight;

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
      videoBitsPerSecond: 2500000 
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
      
      const startTime = Date.now();
      while (Date.now() - startTime < durationPerImageMs) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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
