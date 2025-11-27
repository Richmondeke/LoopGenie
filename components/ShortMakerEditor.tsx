
import React, { useState } from 'react';
import { Sparkles, Video, Play, Music, Image as ImageIcon, Loader2, Save, Wand2, RefreshCw } from 'lucide-react';
import { ShortMakerManifest, ProjectStatus } from '../types';
import { generateStory, generateSceneImage, synthesizeAudio, assembleVideo } from '../services/shortMakerService';

interface ShortMakerEditorProps {
    onBack: () => void;
    onGenerate: (data: any) => void;
    userCredits: number;
}

type EditorPhase = 'INPUT' | 'STORY' | 'ASSETS' | 'ASSEMBLY';

export const ShortMakerEditor: React.FC<ShortMakerEditorProps> = ({ onBack, onGenerate, userCredits }) => {
    const [phase, setPhase] = useState<EditorPhase>('INPUT');
    const [manifest, setManifest] = useState<ShortMakerManifest | null>(null);
    
    // Input State
    const [idea, setIdea] = useState('');
    const [style, setStyle] = useState('Cinematic');
    const [seed, setSeed] = useState('');
    
    // Processing State
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressStatus, setProgressStatus] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const COST = 3; // Higher cost for full short

    const handleGenerateStory = async () => {
        if (!idea.trim()) return;
        setIsProcessing(true);
        setErrorMsg('');
        setProgressStatus('Creating Story Manifest...');

        try {
            const result = await generateStory({
                idea,
                seed: seed || undefined,
                style_tone: style
            });
            setManifest(result);
            setPhase('STORY');
        } catch (e: any) {
            setErrorMsg(e.message || "Failed to generate story");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleGenerateAssets = async () => {
        if (!manifest) return;
        setIsProcessing(true);
        setErrorMsg('');
        
        try {
            // 1. Generate Images (Parallel)
            setProgressStatus('Generating Scene Images (this may take a moment)...');
            const updatedScenes = [...manifest.scenes];
            
            // We'll generate one by one to avoid rate limits on demo keys, or parallel if robust
            // For demo, parallel with `Promise.all` but catch individual errors
            await Promise.all(updatedScenes.map(async (scene, idx) => {
                if (scene.generated_image_url) return; // Skip if exists
                try {
                    const url = await generateSceneImage(scene, manifest.seed || 'default', style);
                    updatedScenes[idx].generated_image_url = url;
                } catch (e) {
                    console.error(`Scene ${idx + 1} image failed`);
                }
            }));

            // 2. Generate Audio
            setProgressStatus('Synthesizing Voiceover...');
            const elevenKey = localStorage.getItem('genavatar_eleven_key');
            let audioUrl = '';
            if (elevenKey) {
                const audioRes = await synthesizeAudio(manifest, elevenKey);
                audioUrl = audioRes.audioUrl;
            } else {
                console.warn("Skipping audio: No ElevenLabs key found.");
            }

            setManifest({
                ...manifest,
                scenes: updatedScenes,
                generated_audio_url: audioUrl,
                status: 'images_processing' // or 'audio_processing'
            });
            
            setPhase('ASSETS');

        } catch (e: any) {
            setErrorMsg(e.message || "Asset generation failed");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAssemble = async () => {
        if (!manifest) return;
        setIsProcessing(true);
        setProgressStatus('Assembling Video (Mock)...');

        try {
            const videoUrl = await assembleVideo(manifest);
            
            // Final Save
            onGenerate({
                isDirectSave: true,
                videoUrl: videoUrl,
                thumbnailUrl: manifest.scenes[0].generated_image_url,
                cost: COST,
                // Extra meta if supported
                templateName: "ShortMaker: " + manifest.title
            });

        } catch (e: any) {
            setErrorMsg(e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    if (phase === 'INPUT') {
        return (
            <div className="h-full bg-black text-white p-8 overflow-y-auto rounded-xl flex items-center justify-center">
                <div className="max-w-xl w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-orange-400 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg">
                            <Sparkles size={32} className="text-white" />
                        </div>
                        <h2 className="text-3xl font-bold mb-2">ShortMaker</h2>
                        <p className="text-gray-400">Turn an idea into a 25s YouTube Short instantly.</p>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Video Idea (Max 120 chars)</label>
                            <textarea
                                value={idea}
                                onChange={(e) => setIdea(e.target.value.slice(0, 120))}
                                placeholder="A robot learns to paint in a ruined city..."
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-pink-500 outline-none resize-none h-24 text-lg"
                            />
                            <div className="text-right text-xs text-gray-500 mt-1">{idea.length}/120</div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Visual Style</label>
                                <select 
                                    value={style}
                                    onChange={(e) => setStyle(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-pink-500 outline-none"
                                >
                                    <option>Cinematic</option>
                                    <option>Anime</option>
                                    <option>3D Animation</option>
                                    <option>Cyberpunk</option>
                                    <option>Watercolor</option>
                                    <option>Hyper-Realistic</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Seed (Optional)</label>
                                <input 
                                    type="text"
                                    value={seed}
                                    onChange={(e) => setSeed(e.target.value)}
                                    placeholder="Random"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-pink-500 outline-none"
                                />
                            </div>
                        </div>

                        {errorMsg && <div className="text-red-400 text-sm text-center p-2 bg-red-900/20 rounded">{errorMsg}</div>}

                        <button
                            onClick={handleGenerateStory}
                            disabled={true}
                            className="w-full bg-gray-700 text-gray-500 border border-gray-600 font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-not-allowed"
                        >
                            <span className="font-bold">Coming Soon</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-black text-white p-6 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 px-2">
                <div>
                    <h2 className="text-2xl font-bold">{manifest?.title || "Untitled Project"}</h2>
                    <p className="text-gray-400 text-sm">{manifest?.final_caption}</p>
                </div>
                <div className="flex gap-3">
                     {phase === 'STORY' && (
                         <button 
                            onClick={handleGenerateAssets}
                            disabled={isProcessing}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                         >
                            {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <ImageIcon size={18} />}
                            {isProcessing ? progressStatus : 'Generate Assets'}
                         </button>
                     )}
                     {phase === 'ASSETS' && (
                         <button 
                            onClick={handleAssemble}
                            disabled={isProcessing}
                            className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                         >
                            {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Video size={18} />}
                            {isProcessing ? progressStatus : `Assemble Video (${COST} Credits)`}
                         </button>
                     )}
                </div>
            </div>

            {/* Content Grid */}
            <div className="flex-1 overflow-y-auto px-2 pb-10">
                {/* Scenes */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                    {manifest?.scenes.map((scene, idx) => (
                        <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col group">
                            <div className="aspect-[9/16] bg-gray-800 relative group-hover:border-pink-500/50 border border-transparent transition-colors">
                                {scene.generated_image_url ? (
                                    <img src={scene.generated_image_url} alt={`Scene ${idx+1}`} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 p-4 text-center">
                                        <ImageIcon size={32} className="mb-2 opacity-50" />
                                        <span className="text-xs">Image Placeholder</span>
                                    </div>
                                )}
                                <div className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded text-xs font-mono text-white">
                                    {scene.timecodes.start_second}s - {scene.timecodes.end_second}s
                                </div>
                            </div>
                            <div className="p-3 flex-1 flex flex-col">
                                <div className="text-xs font-bold text-pink-400 mb-1">SCENE {idx+1}</div>
                                <p className="text-xs text-gray-300 mb-2 line-clamp-3 italic">"{scene.narration_text}"</p>
                                <p className="text-[10px] text-gray-500 mt-auto border-t border-gray-800 pt-2">
                                    <span className="font-bold">Prompt:</span> {scene.visual_description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Audio Preview */}
                {manifest?.generated_audio_url && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4 mb-8">
                        <div className="w-10 h-10 bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-400">
                            <Music size={20} />
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-bold text-gray-200">Generated Voiceover</div>
                            <audio controls src={manifest.generated_audio_url} className="w-full h-8 mt-1 opacity-80" />
                        </div>
                    </div>
                )}
                
                {/* JSON View (Debug/Inspect) */}
                <details className="bg-gray-900 rounded-xl border border-gray-800">
                    <summary className="p-4 cursor-pointer font-mono text-xs text-gray-500 hover:text-gray-300">View Raw Manifest</summary>
                    <pre className="p-4 pt-0 text-[10px] text-green-400 font-mono overflow-x-auto">
                        {JSON.stringify(manifest, null, 2)}
                    </pre>
                </details>
            </div>
            
            {errorMsg && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-full shadow-xl font-bold text-sm animate-bounce">
                    Error: {errorMsg}
                </div>
            )}
        </div>
    );
};
