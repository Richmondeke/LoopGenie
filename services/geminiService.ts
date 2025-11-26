
import { GoogleGenAI, Type } from "@google/genai";
import { ScriptGenerationRequest } from "../types";

export const generateScriptContent = async (
  request: ScriptGenerationRequest
): Promise<Record<string, string>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // For avatar videos, we really only care about the 'script' variable.
  const schema = {
    type: Type.OBJECT,
    properties: {
        script: { type: Type.STRING, description: "The spoken script for the video." }
    },
    required: ["script"],
  };

  const prompt = `
    You are a professional video script writer for AI avatars.
    Topic: ${request.topic}
    Tone: ${request.tone}
    
    Write a clear, engaging spoken script for a single speaker. 
    Keep it concise (under 60 seconds reading time).
    Do not include scene directions or camera angles, just the spoken words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        systemInstruction: "You are a creative script writer.",
      },
    });

    const text = response.text;
    if (!text) return { script: "" };
    
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Gemini generation error:", error);
    
    // Handle Quota Exceeded (429) specifically
    if (error.status === 429 || (error.message && error.message.includes('429')) || error.message?.includes('RESOURCE_EXHAUSTED')) {
        console.warn("Quota exceeded. Returning fallback script.");
        return { 
            script: `(AI Quota Exceeded) Here is a draft script about ${request.topic}. Please edit this text to suit your needs.` 
        };
    }
    
    throw error;
  }
};

export const generateVeoVideo = async (prompt: string): Promise<string> => {
  // Always create a new instance to pick up the latest selected key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  console.log("Starting Veo generation for:", prompt);

  try {
    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '9:16' // Shorts format
        }
    });

    console.log("Veo operation started:", operation);

    // Poll for completion
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
        operation = await ai.operations.getVideosOperation({operation: operation});
        console.log("Veo polling status:", operation.metadata?.state);
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
        throw new Error("No video URI returned from Veo");
    }

    // The URI needs the API key appended to be downloadable/playable
    return `${videoUri}&key=${process.env.API_KEY}`;
  } catch (error: any) {
     if (error.status === 429 || error.message?.includes('RESOURCE_EXHAUSTED')) {
        throw new Error("Daily AI quota exceeded. Please try again later or check your billing.");
     }
     throw error;
  }
};

export const generateVeoProductVideo = async (prompt: string, imagesBase64: string[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  console.log("Starting Veo Product Video generation with", imagesBase64.length, "images");

  // Construct reference images payload
  const referenceImagesPayload: any[] = [];
  
  for (const img of imagesBase64) {
    // Dynamically detect MIME type from base64 string
    // Format is usually: "data:image/png;base64,iVBOR..."
    const match = img.match(/^data:(.+);base64,(.+)$/);
    const mimeType = match ? match[1] : 'image/jpeg'; // Default to jpeg if parsing fails
    const imageBytes = match ? match[2] : (img.split(',')[1] || img);

    referenceImagesPayload.push({
      image: {
        imageBytes: imageBytes,
        mimeType: mimeType,
      },
      referenceType: 'ASSET', // Use generic ASSET type for reference images
    });
  }

  try {
    // Note: 'veo-3.1-generate-preview' supports multiple reference images
    // Constraints: 16:9 aspect ratio and 720p resolution are required for this feature
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9',
        referenceImages: referenceImagesPayload
      }
    });

    console.log("Veo Product operation started:", operation);

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
        throw new Error("No video URI returned from Veo Product Generation");
    }

    return `${videoUri}&key=${process.env.API_KEY}`;
  } catch (error: any) {
    if (error.status === 429 || error.message?.includes('RESOURCE_EXHAUSTED')) {
        throw new Error("Daily AI quota exceeded. Please try again later or check your billing.");
     }
     throw error;
  }
};
