
import { GoogleGenAI, Type } from "@google/genai";
import { ShortMakerManifest, ShortMakerScene } from "../types";

// ==========================================
// 1. GENERATE STORY (Gemini Text)
// ==========================================

export interface GenerateStoryRequest {
  idea: string;
  seed?: string;
  reference_image_url?: string;
  voice_preference?: any;
  style_tone?: string;
}

export const generateStory = async (req: GenerateStoryRequest): Promise<ShortMakerManifest> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Exact system prompt from spec
  const systemInstruction = `
SYSTEM: You are a deterministic content generator. Receive a single short idea and output **ONLY** valid JSON matching the manifest schema below. No explanation, no extra fields, no prose. Use low temperature for determinism. Validate durations sum to 25 seconds and scenes are contiguous.

REQUIREMENTS:
- Produce title (<=6 words), final_caption (<=10 words), voice_instruction, output_settings, and exactly 5 scenes.
- Each scene must contain scene_number, duration_seconds (5), narration_text (<=25 words), visual_description (<=30 words), character_tokens (0..3), environment_tokens (0..3), camera_directive, image_prompt (include --aspect 9:16 or resolution 1080x1920 and reference character_tokens and environment_tokens), transition_to_next, timecodes with start_second and end_second.
- Keep character names/tokens consistent across scenes.
- Use natural, short narration text suited for ElevenLabs TTS.
- Output only JSON and ensure it parses.
  `;

  const userPrompt = `
InputIdea: "${req.idea}"
OptionalSeed: "${req.seed || ''}"
ReferenceImage: "${req.reference_image_url || ''}"
VoicePref: "${JSON.stringify(req.voice_preference || {})}"
StyleTone: "${req.style_tone || ''}"
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
        temperature: 0.2 // Low temp for determinism
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");
    
    const manifest = JSON.parse(text) as ShortMakerManifest;
    
    // Client-side validation
    if (manifest.scenes.length !== 5) throw new Error("Manifest must have exactly 5 scenes");
    
    return {
        ...manifest,
        status: "story_ready",
        seed: req.seed || Math.random().toString(36).substring(7),
        idea_input: req.idea
    };

  } catch (error: any) {
    if (error.status === 429) {
        throw new Error("Daily AI quota exceeded (Story Generation).");
    }
    throw error;
  }
};

// ==========================================
// 2. GENERATE IMAGES (Gemini Image)
// ==========================================

export const generateSceneImage = async (
    scene: ShortMakerScene, 
    globalSeed: string, 
    styleTone?: string
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // nano_banana model
    const model = 'gemini-2.5-flash-image';
    
    // Construct prompt with tokens and style
    const fullPrompt = `
      ${scene.image_prompt}. 
      Style: ${styleTone || 'Cinematic'}. 
      Consistency Tokens: ${scene.character_tokens.join(', ')}. 
      Environment: ${scene.environment_tokens.join(', ')}.
      High quality, 9:16 vertical aspect ratio.
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: {
                parts: [{ text: fullPrompt }]
            },
            config: {
                // responseMimeType is not strictly supported for image models in generic generateContent calls usually, 
                // but the SDK handles base64 return.
                // We rely on the output parsing.
            }
        });
        
        // Find image part
        // The SDK might return it in different ways depending on exact model version
        // Standard practice for 'generateContent' with image model:
        const parts = response.candidates?.[0]?.content?.parts;
        if (!parts) throw new Error("No content generated");

        for (const part of parts) {
            if (part.inlineData && part.inlineData.mimeType.startsWith('image')) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        
        throw new Error("No image data found in response");

    } catch (error: any) {
        console.error(`Image gen failed for scene ${scene.scene_number}:`, error);
        throw error;
    }
};

// ==========================================
// 3. SYNTHESIZE AUDIO (ElevenLabs)
// ==========================================

export const synthesizeAudio = async (
    manifest: ShortMakerManifest, 
    apiKey: string
): Promise<{ audioUrl: string, duration: number }> => {
    if (!apiKey) throw new Error("ElevenLabs API Key required for audio synthesis");

    // Concatenate text
    // Note: <break> tags work in ElevenLabs
    const fullText = manifest.scenes
        .map(s => s.narration_text)
        .join(' <break time="0.5s" /> ');

    // Default Voice ID (Adam - generic male) if not mapped
    // You would map manifest.voice_instruction.voice to real IDs here
    const voiceId = "pNInz6obpgDQGcFmaJgB"; // Example voice ID
    
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
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
            const err = await response.json();
            throw new Error(err.detail?.message || "ElevenLabs API Error");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        // Calculate approximate duration or get from response headers if available
        // For MVP, we'll assume it matches closely or the video assembler handles mismatch.
        // Reading blob duration requires loading into Audio element.
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
        console.error("Audio synthesis failed:", error);
        throw error;
    }
};

// ==========================================
// 4. ASSEMBLE VIDEO (Stub)
// ==========================================

export const assembleVideo = async (manifest: ShortMakerManifest): Promise<string> => {
    // In a real implementation, this would send the manifest + asset URLs to a backend
    // running FFmpeg. 
    // For this client-side demo, we will verify assets exist and return a 'mock' completion.
    
    return new Promise((resolve) => {
        setTimeout(() => {
            // For the demo, we'll just return the first generated image as a placeholder "video"
            // or a static placeholder if none exists.
            const placeholder = manifest.scenes[0].generated_image_url || "https://via.placeholder.com/1080x1920?text=Short+Video";
            resolve(placeholder);
        }, 3000);
    });
};
