
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Video, Play, Music, Image as ImageIcon, Loader2, Save, Wand2, RefreshCw, BookOpen, Smartphone, CheckCircle, Clock, Film, ChevronRight, AlertCircle, Download } from 'lucide-react';
import { ShortMakerManifest, ProjectStatus, Template } from '../types';
import { generateStory, generateSceneImage, synthesizeAudio, assembleVideo } from '../services/shortMakerService';

interface ShortMakerEditorProps {
    onBack: () => void;
    onGenerate: (data: any) => void;
    userCredits: number;
    template: Template;
}

type ProductionStep = 'INPUT' | 'SCRIPT' | 'VISUALS' | 'AUDIO' | 'ASSEMBLY' | 'COMPLETE';

export const ShortMakerEditor: React.FC<ShortMakerEditorProps> = ({ onBack, onGenerate, userCredits, template }) => {
    const isStorybook = template.mode === 'STORYBOOK';
    const [step, setStep] = useState<ProductionStep>('INPUT');
    const [manifest, setManifest] = useState<ShortMakerManifest | null>(null);
    
    // Input State
    const [idea, setIdea] = useState('');
    const [style, setStyle] = useState(isStorybook ? 'Watercolor Illustration' : 'Cinematic');
    const [seed, setSeed] = useState('');
    
    // Progress Tracking
    const [logs, setLogs] = useState<string[]>([]);
    const [completedImages, setCompletedImages] = useState<number>(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);

    const COST = 3;

    // Helper to add logs
    const addLog = (msg: string) => {
        setLogs(prev => [...prev, msg]);
        // Auto-scroll logic could go here
    };

    // -------------------------------------------------------------------------
    // AUTOMATED WORKFLOW ENGINE
    // -------------------------------------------------------------------------
    
    const runProduction = async () => {
        if (!idea.trim()) return;
        
        setIsProcessing(true);
        setStep('SCRIPT');
        setLogs([]);
        setCompletedImages(0);
        setManifest(null);
        setVideoUrl(null);
        setErrorMsg('');

        try {
            // STEP 1: SCRIPT / MANIFEST
            addLog("🧠 Generating story concept and script...");
            const storyManifest = await generateStory({
                idea,
                seed: seed || undefined,
                style_tone: style,
                mode: template.mode
            });
            setManifest(storyManifest);
            addLog("✅ Script generated successfully.");
            
            // Wait a beat for UI to settle
            await new Promise(r => setTimeout(r, 1000));

            // STEP 2: VISUALS
            setStep('VISUALS');
            addLog("🎨 Starting image generation for 5 scenes...");
            
            // We clone the scenes to update them one by one
            const workingScenes = [...storyManifest.scenes];
            const generationSeed = storyManifest.seed || Math.random().toString();

            // Generate images sequentially to show progress "workflow" style
            for (let i = 0; i < workingScenes.length; i++) {
                addLog(`Painting Scene ${i + 1}: "${workingScenes[i].visual_description.substring(0, 30)}..."`);
                
                try {
                    const url = await generateSceneImage(
                        workingScenes[i],
                        generationSeed,
                        style,
                        isStorybook
                    );
                    
                    workingScenes[i].generated_image_url = url;
                    
                    // Update State to trigger re-render of grid
                    setManifest({ ...storyManifest, scenes: [...workingScenes] });
                    setCompletedImages(prev => prev + 1);
                    
                } catch (err) {
                    console.error(`Failed to gen image for scene ${i}`, err);
                    addLog(`❌ Failed to generate image for Scene ${i+1}`);
                }
            }
            addLog("✅ Visuals generated.");

            // STEP 3: AUDIO
            setStep('AUDIO');
            addLog("🎙️ Synthesizing voiceover narration...");
            
            const elevenKey = localStorage.getItem('genavatar_eleven_key');
            let generatedAudioUrl = '';
            
            try {
                const audioRes = await synthesizeAudio(storyManifest, elevenKey || undefined);
                generatedAudioUrl = audioRes.audioUrl;
                addLog(`✅ Audio created (${Math.round(audioRes.duration)}s).`);
            } catch (err) {
                console.warn("Audio failed", err);
                addLog("⚠️ Audio generation had issues, proceeding with silent/fallback.");
            }

            const manifestWithAudio = {
                ...storyManifest,
                scenes: workingScenes,
                generated_audio_url: generatedAudioUrl
            };
            setManifest(manifestWithAudio);

            // STEP 4: ASSEMBLY
            setStep('ASSEMBLY');
            addLog("🎬 Stitching video frames and syncing audio...");
            
            const finalVideoUrl = await assembleVideo(manifestWithAudio);
            setVideoUrl(finalVideoUrl);
            addLog("✅ Video assembly complete!");

            // FINISH
            setStep('COMPLETE');

        } catch (e: any) {
            console.error(e);
            setErrorMsg(e.message || "Production failed.");
            addLog(`❌ Critical Error: ${e.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveProject = () => {
        if (manifest && videoUrl) {
             onGenerate({
                isDirectSave: true,
                videoUrl: videoUrl,
                thumbnailUrl: manifest.scenes[0].generated_image_url,
                cost: COST,
                templateName: (isStorybook ? "Story: " : "Short: ") + manifest.title
            });
        }
    };


    // -------------------------------------------------------------------------
    // RENDERERS
    // -------------------------------------------------------------------------

    const StepIndicator = ({ current, target, label, icon: Icon }: any) => {
        const steps = ['INPUT', 'SCRIPT', 'VISUALS', 'AUDIO', 'ASSEMBLY', 'COMPLETE'];
        const currentIndex = steps.indexOf(current);
        const targetIndex = steps.indexOf(target);
        
        let statusColor = 'text-gray-600 bg-gray-800 border-gray-700'; // Upcoming
        if (current === target) statusColor = 'text-blue-400 bg-blue-900/30 border-blue-500 animate-pulse'; // Active
        if (currentIndex > targetIndex) statusColor = 'text-green-400 bg-green-900/30 border-green-500'; // Completed

        return (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${statusColor}`}>
                {currentIndex > targetIndex ? <CheckCircle size={14} /> : <Icon size={14} />}
                <span className="hidden sm:inline">{label}</span>
            </div>
        );
    };

    if (step === 'INPUT') {
        return (
            <div className="h-full bg-black text-white p-6 overflow-y-auto flex items-center justify-center">
                <div className="max-w-xl w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                     {/* Background Glow */}
                    <div className={`absolute top-0 right-0 w-64 h-64 ${isStorybook ? 'bg-amber-600' : 'bg-pink-600'} opacity-10 blur-[80px] rounded-full pointer-events-none`} />

                    <div className="text-center mb-8 relative z-10">
                        <div className={`w-16 h-16 bg-gradient-to-br ${isStorybook ? 'from-amber-400 to-orange-600' : 'from-pink-500 to-orange-400'} rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg transform rotate-3`}>
                            {isStorybook ? <BookOpen size={32} className="text-white" /> : <Smartphone size={32} className="text-white" />}
                        </div>
                        <h2 className="text-3xl font-bold mb-2">{isStorybook ? 'Storybook Maker' : 'ShortMaker'}</h2>
                        <p className="text-gray-400">
                            {isStorybook 
                             ? 'Create an illustrated story from a simple prompt.' 
                             : 'Turn an idea into a viral YouTube Short instantly.'}
                        </p>
                    </div>

                    <div className="space-y-6 relative z-10">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Video Idea</label>
                            <textarea
                                value={idea}
                                onChange={(e) => setIdea(e.target.value)}
                                placeholder={isStorybook ? "A brave toaster goes on an adventure..." : "Top 5 facts about Mars..."}
                                className={`w-full bg-black/50 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:ring-2 ${isStorybook ? 'focus:ring-amber-500' : 'focus:ring-pink-500'} outline-none resize-none h-28 text-lg`}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Art Style</label>
                                <select 
                                    value={style}
                                    onChange={(e) => setStyle(e.target.value)}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-white transition-colors"
                                >
                                    <option>Cinematic</option>
                                    <option>Watercolor Illustration</option>
                                    <option>Anime</option>
                                    <option>3D Disney Style</option>
                                    <option>Cyberpunk</option>
                                    <option>Oil Painting</option>
                                    <option>Sketch</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Seed</label>
                                <input 
                                    type="text"
                                    value={seed}
                                    onChange={(e) => setSeed(e.target.value)}
                                    placeholder="Random"
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-white transition-colors"
                                />
                            </div>
                        </div>

                        <button
                            onClick={runProduction}
                            disabled={!idea.trim()}
                            className={`w-full ${isStorybook ? 'bg-gradient-to-r from-amber-600 to-orange-600' : 'bg-gradient-to-r from-pink-600 to-purple-600'} hover:opacity-90 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:transform-none`}
                        >
                            <Wand2 size={20} />
                            <span>Generate Video ({COST} Credits)</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // PRODUCTION VIEW
    return (
        <div className="h-full bg-black text-white flex flex-col overflow-hidden">
            {/* Top Bar: Progress */}
            <div className="h-16 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between px-6 flex-shrink-0 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                        <ChevronRight className="rotate-180" size={20} />
                    </button>
                    <h3 className="font-bold text-lg hidden md:block">
                        {manifest?.title || 'Generating...'}
                    </h3>
                </div>

                <div className="flex items-center gap-2">
                    <StepIndicator current={step} target="SCRIPT" label="Script" icon={BookOpen} />
                    <div className="w-4 h-px bg-gray-700" />
                    <StepIndicator current={step} target="VISUALS" label="Visuals" icon={ImageIcon} />
                    <div className="w-4 h-px bg-gray-700" />
                    <StepIndicator current={step} target="AUDIO" label="Audio" icon={Music} />
                    <div className="w-4 h-px bg-gray-700" />
                    <StepIndicator current={step} target="ASSEMBLY" label="Output" icon={Film} />
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                
                {/* Left: Workflow Visualization */}
                <div className="flex-1 overflow-y-auto p-6 relative">
                    {/* Status Message Overlay */}
                    {isProcessing && (
                         <div className="mb-6 bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-xl flex items-center gap-3 animate-pulse">
                            <Loader2 className="animate-spin text-indigo-400" />
                            <span className="text-indigo-200 font-mono text-sm">
                                {step === 'SCRIPT' && "AI is dreaming up the story..."}
                                {step === 'VISUALS' && `Painting scenes... (${completedImages}/5)`}
                                {step === 'AUDIO' && "Recording voiceover..."}
                                {step === 'ASSEMBLY' && "Stitching final video..."}
                            </span>
                         </div>
                    )}

                    {errorMsg && (
                        <div className="mb-6 bg-red-900/20 border border-red-500/50 p-4 rounded-xl flex items-center gap-3">
                            <AlertCircle className="text-red-400" />
                            <span className="text-red-200">{errorMsg}</span>
                            <button onClick={runProduction} className="ml-auto bg-red-800 px-3 py-1 rounded text-xs hover:bg-red-700">Retry</button>
                        </div>
                    )}

                    {/* Final Video Player */}
                    {step === 'COMPLETE' && videoUrl && (
                        <div className="mb-8 animate-in slide-in-from-top duration-500">
                             <div className="aspect-video w-full max-w-4xl mx-auto bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-800 relative group">
                                <video src={videoUrl} controls autoPlay className="w-full h-full" />
                             </div>
                             <div className="flex justify-center mt-6 gap-4">
                                <button 
                                    onClick={handleSaveProject}
                                    className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg transition-all transform hover:scale-105"
                                >
                                    <Save size={20} /> Save Project
                                </button>
                                <a 
                                    href={videoUrl} 
                                    download={`story-${Date.now()}.webm`}
                                    className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg transition-all"
                                >
                                    <Download size={20} /> Download
                                </a>
                             </div>
                        </div>
                    )}

                    {/* SCENES GRID */}
                    {manifest && (
                         <div className="space-y-6 max-w-5xl mx-auto">
                            <div className="flex items-center justify-between">
                                <h4 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Storyboard</h4>
                                {manifest.generated_audio_url && step !== 'COMPLETE' && (
                                     <div className="flex items-center gap-2 text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">
                                        <Music size={12} /> Audio Ready
                                     </div>
                                )}
                            </div>

                            <div className={`grid grid-cols-1 ${isStorybook ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5'} gap-4`}>
                                {manifest.scenes.map((scene, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col transition-all duration-500 ${scene.generated_image_url ? 'opacity-100 scale-100' : 'opacity-50 scale-95'}`}
                                    >
                                        <div className={`${isStorybook ? 'aspect-video' : 'aspect-[9/16]'} bg-black relative group`}>
                                            {scene.generated_image_url ? (
                                                <img 
                                                    src={scene.generated_image_url} 
                                                    alt={`Scene ${idx+1}`} 
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                                    {isProcessing && step === 'VISUALS' && completedImages === idx ? (
                                                        <Loader2 className="animate-spin text-blue-500 mb-2" />
                                                    ) : (
                                                        <ImageIcon className="text-gray-700 mb-2" />
                                                    )}
                                                    <span className="text-xs text-gray-600 text-center">
                                                        {step === 'VISUALS' && completedImages === idx ? 'Painting...' : 'Waiting...'}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-[10px] font-mono text-white">
                                                Scene {idx + 1}
                                            </div>
                                        </div>
                                        <div className="p-3 flex-1">
                                            <p className="text-xs text-gray-300 leading-relaxed line-clamp-4">
                                                {scene.narration_text}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                         </div>
                    )}
                </div>

                {/* Right: Console Log (Terminal Style) */}
                <div className="w-full md:w-80 bg-[#0F0F0F] border-t md:border-t-0 md:border-l border-gray-800 flex flex-col font-mono text-xs">
                    <div className="p-3 border-b border-gray-800 bg-[#151515] font-bold text-gray-400 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Production Log
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
                        {logs.length === 0 && (
                            <div className="text-gray-600 italic">Waiting for input...</div>
                        )}
                        {logs.map((log, i) => (
                            <div key={i} className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                                <span className="text-gray-600 select-none">
                                    {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                                </span>
                                <span className={log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : 'text-gray-300'}>
                                    {log}
                                </span>
                            </div>
                        ))}
                        <div ref={scrollRef} />
                    </div>
                </div>

            </div>
        </div>
    );
};
