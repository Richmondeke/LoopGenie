
import { GoogleGenAI, Type } from "@google/genai";
import { ShortMakerManifest, ShortMakerScene } from "../types";
import { stitchVideoFrames } from "./ffmpegService";
import { generatePollinationsImage } from "./pollinationsService";
import { generateSpeech } from "./geminiService";

// ==========================================
// 1. GENERATE STORY (Gemini Text)
// ==========================================

export interface GenerateStoryRequest {
  idea: string;
  seed?: string;
  reference_image_url?: string;
  voice_preference?: any;
  style_tone?: string;
  mode?: 'SHORTS' | 'STORYBOOK';
}

export const generateStory = async (req: GenerateStoryRequest): Promise<ShortMakerManifest> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const isStorybook = req.mode === 'STORYBOOK';
  // Aspect ratio instructions for the text model
  const ratioText = isStorybook ? "16:9 Landscape" : "9:16 Portrait";

  // CRITICAL FIX: Sanitize reference_image_url to ensure no huge Base64 strings are passed in text prompt
  const refImageClean = req.reference_image_url && req.reference_image_url.startsWith('data:') 
    ? '(Image Provided as Reference)' 
    : (req.reference_image_url || '');

  // CRITICAL FIX: Sanitize idea to prevent length explosion or JSON breaking
  const ideaClean = (req.idea || '').substring(0, 500).replace(/"/g, "'").replace(/\n/g, " ");

  const systemInstruction = `
SYSTEM: You are a deterministic content generator. Receive a single short idea and output **ONLY** valid JSON matching the manifest schema below. No explanation, no extra fields, no prose. Use low temperature for determinism.

CONSTRAINTS (CRITICAL):
- Output MUST be valid JSON.
- Total JSON length MUST be under 8000 characters to avoid truncation.
- title: Max 6 words.
- final_caption: Max 8 words.
- scenes: Exactly 5 scenes.
- narration_text: Max 20 words per scene. Keep it punchy.
- visual_description: Max 15 words per scene. Concise.
- image_prompt: Max 20 words per scene. Optimized for diffusion models.
- character_tokens: Max 3 items.
- environment_tokens: Max 3 items.

Do not be verbose. Be extremely concise.
  `;

  const userPrompt = `
InputIdea: "${ideaClean}"
OptionalSeed: "${req.seed || ''}"
ReferenceImage: "${refImageClean}"
VoicePref: "${JSON.stringify(req.voice_preference || {})}"
StyleTone: "${req.style_tone || ''}"
Mode: "${req.mode || 'SHORTS'}"
Ratio: "${ratioText}"
  `;

  // Schema Definition for Strict JSON
  const schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      final_caption: { type: Type.STRING },
      voice_instruction: {
        type: Type.OBJECT,
        properties: {
          voice: { type: Type.STRING },
          lang: { type: Type.STRING },
          tone: { type: Type.STRING }
        }
      },
      output_settings: {
        type: Type.OBJECT,
        properties: {
          video_resolution: { type: Type.STRING },
          fps: { type: Type.NUMBER },
          scene_duration_default: { type: Type.NUMBER }
        }
      },
      scenes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            scene_number: { type: Type.NUMBER },
            duration_seconds: { type: Type.NUMBER },
            narration_text: { type: Type.STRING },
            visual_description: { type: Type.STRING },
            character_tokens: { type: Type.ARRAY, items: { type: Type.STRING } },
            environment_tokens: { type: Type.ARRAY, items: { type: Type.STRING } },
            camera_directive: { type: Type.STRING },
            image_prompt: { type: Type.STRING },
            transition_to_next: { type: Type.STRING },
            timecodes: {
                type: Type.OBJECT,
                properties: {
                    start_second: { type: Type.NUMBER },
                    end_second: { type: Type.NUMBER }
                }
            }
          }
        }
      }
    },
    required: ["title", "scenes", "output_settings", "voice_instruction"]
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2,
        // Using a standard high limit, but the prompt constraints are the real fix
        maxOutputTokens: 8192 
      }
    });

    let text = response.text || "";
    
    // Cleanup: Remove markdown code blocks if present (sometimes model adds them despite config)
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    if (!text) throw new Error("Empty response from Gemini");
    
    // Safety check for parsing
    try {
        const manifest = JSON.parse(text) as ShortMakerManifest;
        
        // Client-side validation
        if (!manifest.scenes || manifest.scenes.length !== 5) {
            // Attempt to recover if scenes are missing (unlikely with schema, but possible)
            if (manifest.scenes && manifest.scenes.length > 0) {
                console.warn("Manifest has incorrect scene count, proceeding with what we have.");
            } else {
                throw new Error("Manifest must have exactly 5 scenes");
            }
        }
        
        return {
            ...manifest,
            status: "story_ready",
            seed: req.seed || Math.random().toString(36).substring(7),
            idea_input: req.idea
        };
    } catch (parseError) {
        console.error("JSON Parse Error in Story Generation:", parseError);
        console.log("Raw Text Received (First 500 chars):", text.substring(0, 500) + "..."); 
        
        // Check for common truncation pattern
        if (parseError instanceof SyntaxError && text.length > 8000) {
             throw new Error("Story generation was too long and got cut off. Please try a simpler idea.");
        }
        
        throw new Error("Failed to parse story manifest. Please try again.");
    }

  } catch (error: any) {
    if (error.status === 429) {
        throw new Error("Daily AI quota exceeded (Story Generation).");
    }
    throw error;
  }
};

// ==========================================
// 2. GENERATE IMAGES (Pollinations AI)
// ==========================================

export const generateSceneImage = async (
    scene: ShortMakerScene, 
    globalSeed: string, 
    styleTone?: string,
    isLandscape: boolean = false
): Promise<string> => {
    
    // Construct prompt
    const fullPrompt = `
      ${scene.image_prompt}. 
      Style: ${styleTone || 'Cinematic'}. 
      Consistency Tokens: ${scene.character_tokens.join(', ')}. 
      Environment: ${scene.environment_tokens.join(', ')}.
    `;

    // Landscape (16:9) vs Portrait (9:16)
    const width = isLandscape ? 1280 : 720;
    const height = isLandscape ? 720 : 1280;
    const seed = `${globalSeed}-${scene.scene_number}`;

    return await generatePollinationsImage(fullPrompt, width, height, seed);
};

// ==========================================
// 3. SYNTHESIZE AUDIO (ElevenLabs or Gemini TTS)
// ==========================================

export const synthesizeAudio = async (
    manifest: ShortMakerManifest, 
    elevenApiKey?: string
): Promise<{ audioUrl: string, duration: number }> => {
    
    // 1. Try Gemini TTS (Free/Built-in) first if no ElevenLabs key or as default
    if (!elevenApiKey) {
        console.log("No ElevenLabs key found, using Gemini TTS...");
        const fullText = manifest.scenes.map(s => s.narration_text).join(". ");
        const audioUrl = await generateSpeech(fullText, "Fenrir"); // Use a storytelling voice
        
        // Estimate duration (approx 150 words per minute -> 2.5 words per sec)
        const wordCount = fullText.split(' ').length;
        const estDuration = Math.max(25, wordCount / 2.5);
        
        return { audioUrl, duration: estDuration };
    }

    // 2. Try ElevenLabs if key exists
    const fullText = manifest.scenes
        .map(s => s.narration_text)
        .join(' <break time="0.5s" /> ');

    const voiceId = "pNInz6obpgDQGcFmaJgB"; // Example voice ID
    
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'xi-api-key': elevenApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: fullText,
                model_id: "eleven_monolingual_v1",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            })
        });

        if (!response.ok) {
            throw new Error("ElevenLabs API Error");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        return new Promise((resolve) => {
            const audio = new Audio(url);
            audio.onloadedmetadata = () => {
                resolve({ audioUrl: url, duration: audio.duration });
            };
            audio.onerror = () => {
                 resolve({ audioUrl: url, duration: 25 }); // Fallback
            };
        });

    } catch (error) {
        console.warn("ElevenLabs failed, falling back to Gemini TTS:", error);
        // Fallback to Gemini
        const text = manifest.scenes.map(s => s.narration_text).join(". ");
        const url = await generateSpeech(text, "Fenrir");
        return { audioUrl: url, duration: 25 };
    }
};

// ==========================================
// 4. ASSEMBLE VIDEO (FFMPEG / Client-Side)
// ==========================================

export const assembleVideo = async (manifest: ShortMakerManifest): Promise<string> => {
    // Extract asset URLs from manifest
    const images = manifest.scenes
        .map(s => s.generated_image_url)
        .filter(url => !!url) as string[];
        
    const audioUrl = manifest.generated_audio_url;

    if (images.length === 0) {
        throw new Error("No images generated to assemble video");
    }

    // Use the FFMPEG service to stitch inputs
    return await stitchVideoFrames(images, audioUrl);
};
