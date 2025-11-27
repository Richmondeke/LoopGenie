

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, Sparkles, Video, Loader2, Wand2, Upload, Plus, Film, Image as ImageIcon, Music, Trash2, Youtube, Play, Pause, AlertCircle, ShoppingBag, Volume2, Maximize, MoreVertical, PenTool, Zap, Download, Save, Coins, Clapperboard } from 'lucide-react';
import { Template, HeyGenAvatar, HeyGenVoice } from '../types';
import { generateScriptContent, generateVeoVideo, generateVeoProductVideo } from '../services/geminiService';
import { getAvatars, getVoices } from '../services/heygenService';

interface EditorProps {
  template: Template;
  onBack: () => void;
  onGenerate: (data: any) => void;
  isGenerating: boolean;
  heyGenKey?: string;
  userCredits: number;
}

// ==========================================
// 1. Avatar Editor
// ==========================================
const AvatarEditor: React.FC<EditorProps> = ({ template, onGenerate, isGenerating, heyGenKey, userCredits }) => {
    const [script, setScript] = useState('');
    const [avatars, setAvatars] = useState<HeyGenAvatar[]>([]);
    const [allVoices, setAllVoices] = useState<HeyGenVoice[]>([]); // Store all loaded voices
    const [selectedAvatar, setSelectedAvatar] = useState<string>(template.defaultAvatarId || '');
    const [selectedVoice, setSelectedVoice] = useState<string>(template.defaultVoiceId || '');
    
    // Resource Loading State
    const [isLoadingResources, setIsLoadingResources] = useState(true);
    
    // AI State
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiTone, setAiTone] = useState('Professional');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    // Audio Preview State
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Credit Calculation
    // Estimate: ~150 words per minute. 30s = 75 words = 1 credit.
    const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
    const estimatedCost = Math.max(1, Math.ceil(wordCount / 75));
    const hasSufficientCredits = userCredits >= estimatedCost;
  
    useEffect(() => {
      const loadResources = async () => {
          setIsLoadingResources(true);
          try {
              let loadedAvatars: HeyGenAvatar[] = [];
              let loadedVoices: HeyGenVoice[] = [];

              if (heyGenKey) {
                  try {
                      // Caching is handled inside these service calls
                      const [realAvatars, realVoices] = await Promise.all([
                          getAvatars(heyGenKey),
                          getVoices(heyGenKey)
                      ]);
                      if (realAvatars.length > 0) loadedAvatars = realAvatars;
                      if (realVoices.length > 0) loadedVoices = realVoices;
                  } catch (e) {
                      console.error("Failed to fetch from API", e);
                  }
              }

              // Filter voices: Must have previewAudio to be usable in this UI
              const playableVoices = loadedVoices.filter(v => !!v.previewAudio);
              
              setAvatars(loadedAvatars);
              setAllVoices(playableVoices);

              // Set default Avatar if not set
              if (!selectedAvatar && loadedAvatars.length > 0) {
                  setSelectedAvatar(loadedAvatars[0].id);
              }
              // Voice selection is handled by the effect below based on filtering

          } catch (e) {
              console.error("Failed to load resources", e);
          } finally {
              setIsLoadingResources(false);
          }
      };
      loadResources();
    }, [heyGenKey]);

    // Clean up audio on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);
  
    const currentAvatar = avatars.find(a => a.id === selectedAvatar);

    // Filter voices based on selected Avatar's gender
    const filteredVoices = useMemo(() => {
        if (!currentAvatar) return allVoices;
        return allVoices.filter(v => 
            v.gender?.toLowerCase() === currentAvatar.gender?.toLowerCase()
        );
    }, [allVoices, currentAvatar]);

    // Automatically select a valid voice when the available list changes (e.g. switching gender)
    useEffect(() => {
        if (filteredVoices.length > 0) {
            const isCurrentSelectionValid = filteredVoices.some(v => v.id === selectedVoice);
            if (!isCurrentSelectionValid) {
                setSelectedVoice(filteredVoices[0].id);
            }
        }
    }, [filteredVoices, selectedVoice]);

    const handleAiGenerate = async () => {
      if (!aiPrompt.trim()) return;
      setIsAiLoading(true);
      setAiError(null);
      try {
        const generatedContent = await generateScriptContent({
          topic: aiPrompt,
          tone: aiTone,
          templateVariables: []
        });
        if (generatedContent.script) {
            setScript(generatedContent.script);
        }
      } catch (e) {
        console.error(e);
        setAiError("Failed to generate script. Please try again.");
      } finally {
        setIsAiLoading(false);
      }
    };

    const handlePlayPreview = (e: React.MouseEvent, voice: HeyGenVoice) => {
        e.stopPropagation(); // Prevent selection when just trying to play
        
        if (playingVoiceId === voice.id) {
            // Stop
            audioRef.current?.pause();
            setPlayingVoiceId(null);
        } else {
            // Stop current
            if (audioRef.current) {
                audioRef.current.pause();
            }
            
            // Play new
            if (voice.previewAudio) {
                try {
                    const audio = new Audio(voice.previewAudio);
                    audio.onended = () => setPlayingVoiceId(null);
                    audio.onerror = (e) => {
                        console.error("Audio playback error:", e);
                        setPlayingVoiceId(null);
                        alert("Could not play preview. The audio source format may not be supported by your browser.");
                    };
                    const playPromise = audio.play();
                    
                    if (playPromise !== undefined) {
                        playPromise
                        .then(() => {
                             setPlayingVoiceId(voice.id);
                             audioRef.current = audio;
                        })
                        .catch(err => {
                            console.error("Audio play failed", err);
                            setPlayingVoiceId(null);
                        });
                    }
                } catch (err) {
                    console.error("Audio initialization failed", err);
                }
            }
        }
    };
  
    if (isLoadingResources) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
                <p className="text-gray-500 font-medium animate-pulse">Loading voices and avatars...</p>
            </div>
        );
    }

    return (
      <div className="h-full flex flex-col lg:flex-row gap-8 overflow-hidden">
        {/* Left Column: Script & Voice */}
        <div className="flex-1 flex flex-col h-full overflow-y-auto pr-2 pb-20 space-y-8 no-scrollbar">
            
            {/* Script Section */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <label className="text-xl font-bold text-gray-900">Script</label>
                    
                    <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                        <select 
                            className="text-sm p-2 bg-transparent outline-none text-gray-700 font-medium cursor-pointer"
                            value={aiTone}
                            onChange={(e) => setAiTone(e.target.value)}
                        >
                            <option>Professional</option>
                            <option>Friendly</option>
                            <option>Excited</option>
                        </select>
                        <div className="h-4 w-px bg-gray-300 mx-1"></div>
                        <div className="relative flex items-center">
                            <input 
                                type="text"
                                placeholder="Topic (e.g. Sales pitch)..."
                                className="text-sm p-2 w-40 md:w-64 outline-none text-gray-900 placeholder-gray-400 bg-transparent"
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                            />
                            <button 
                                onClick={handleAiGenerate}
                                disabled={isAiLoading || !aiPrompt}
                                className="p-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors ml-1"
                                title="Generate Script with AI"
                            >
                                {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                            </button>
                        </div>
                    </div>
                </div>
                
                {aiError && <div className="text-sm text-red-500 font-medium bg-red-50 p-2 rounded-lg">{aiError}</div>}
                
                <textarea
                    className="w-full p-6 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none h-64 text-gray-800 text-lg leading-relaxed font-medium placeholder-gray-400 shadow-sm bg-white"
                    placeholder="Type what you want your avatar to say..."
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                />
                
                <div className="flex justify-end text-sm text-gray-500 font-medium">
                    <span>{wordCount} words</span>
                    <span className="mx-2">•</span>
                    <span className={!hasSufficientCredits ? 'text-red-500 font-bold' : ''}>
                        Est. Cost: {estimatedCost} Credit{estimatedCost > 1 ? 's' : ''}
                    </span>
                </div>
            </div>
  
            {/* Voice List */}
            <div className="space-y-4">
                <label className="block text-xl font-bold text-gray-900">Voice</label>
                
                {filteredVoices.length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500">
                         {allVoices.length === 0 
                            ? "No voices with preview capabilities found." 
                            : "No voices found matching this avatar's gender."}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredVoices.map(voice => (
                            <div
                                key={voice.id}
                                onClick={() => setSelectedVoice(voice.id)}
                                className={`group relative flex items-center p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                                    selectedVoice === voice.id
                                    ? 'border-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-600'
                                    : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md'
                                }`}
                            >
                                <div className="flex-1 min-w-0 pr-10">
                                    <div className={`font-bold text-base mb-1 ${selectedVoice === voice.id ? 'text-indigo-900' : 'text-gray-900'}`}>
                                        {voice.name}
                                    </div>
                                    <div className={`text-xs font-medium uppercase tracking-wide ${selectedVoice === voice.id ? 'text-indigo-600' : 'text-gray-500'}`}>
                                        {voice.language} • {voice.gender}
                                    </div>
                                </div>

                                <div className="absolute right-4">
                                    <button 
                                        onClick={(e) => handlePlayPreview(e, voice)}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                            playingVoiceId === voice.id 
                                            ? 'bg-indigo-600 text-white shadow-md scale-110' 
                                            : selectedVoice === voice.id
                                                ? 'bg-indigo-200 text-indigo-700 hover:bg-indigo-300'
                                                : 'bg-gray-100 text-gray-500 hover:bg-indigo-100 hover:text-indigo-600'
                                        }`}
                                        title="Preview Voice"
                                    >
                                        {playingVoiceId === voice.id ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
  
        {/* Right Column: Preview & Action */}
        <div className="w-full lg:w-[400px] flex-shrink-0 flex flex-col gap-4">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden flex-1 relative min-h-[400px] lg:min-h-0">
             {currentAvatar ? (
                 <img 
                    src={currentAvatar.previewUrl} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                 />
             ) : (
                 <div className="flex items-center justify-center h-full text-gray-400 font-medium bg-gray-50">
                    No Avatar Selected
                 </div>
             )}
             
             {/* Gradient Overlay for text readability if needed */}
             <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
          </div>
          
          <button
              onClick={() => onGenerate({ variables: { script }, avatarId: selectedAvatar, voiceId: selectedVoice, cost: estimatedCost })}
              disabled={isGenerating || !script.trim() || !hasSufficientCredits}
              className={`w-full font-bold text-xl py-5 px-6 rounded-2xl flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all transform ${
                !hasSufficientCredits 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
              }`}
          >
              {isGenerating ? (
                  <Loader2 className="animate-spin" size={28} />
              ) : !hasSufficientCredits ? (
                  <div className="flex flex-col items-center leading-tight">
                    <span>Insufficient Credits</span>
                    <span className="text-xs font-normal">Need {estimatedCost} credits</span>
                  </div>
              ) : (
                  <>
                    <Video size={28} />
                    <span>Generate ({estimatedCost} Credit{estimatedCost > 1 ? 's' : ''})</span>
                  </>
              )}
          </button>
        </div>
      </div>
    );
};


// ==========================================
// 4. Product UGC Editor (Dark Theme)
// ==========================================
const ProductUGCEditor: React.FC<EditorProps> = ({ onGenerate, userCredits }) => {
    const [images, setImages] = useState<(string | null)[]>([null, null, null]);
    const [prompt, setPrompt] = useState('');
    const [isAudioEnabled, setIsAudioEnabled] = useState(false);
    const [status, setStatus] = useState<'idle' | 'generating' | 'completed' | 'error'>('idle');
    const [videoUri, setVideoUri] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    
    // Fixed cost for UGC video
    const COST = 1;
    const hasSufficientCredits = userCredits >= COST;

    const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const newImages = [...images];
                newImages[index] = reader.result as string;
                setImages(newImages);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        const validImages = images.filter(img => img !== null) as string[];
        if (validImages.length === 0) {
            setErrorMsg("Please upload at least one product image.");
            return;
        }
        if (!prompt.trim()) {
            setErrorMsg("Please describe the scene.");
            return;
        }
        if (!hasSufficientCredits) {
            setErrorMsg("Insufficient credits.");
            return;
        }

        setStatus('generating');
        setErrorMsg('');
        setVideoUri(null);

        try {
            // Check key
            if (window.aistudio && window.aistudio.hasSelectedApiKey) {
                const has = await window.aistudio.hasSelectedApiKey();
                if (!has) await window.aistudio.openSelectKey();
            }

            const uri = await generateVeoProductVideo(prompt, validImages);
            setVideoUri(uri);
            setStatus('completed');
        } catch (error: any) {
            console.error(error);
            setStatus('error');
            setErrorMsg(error.message || "Failed to generate video.");
        }
    };

    const handleSaveProject = () => {
        if (status === 'completed' && videoUri) {
             // Pass back to App.tsx to save in list
             onGenerate({
                 isDirectSave: true,
                 videoUrl: videoUri,
                 thumbnailUrl: images.find(i => i !== null) || null, // Use first uploaded image as thumb
                 cost: COST
             });
        }
    };

    return (
        <div className="h-full bg-black text-white p-4 lg:p-8 overflow-y-auto rounded-xl">
             <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto h-full">
                {/* Left Panel: Inputs */}
                <div className="w-full lg:w-[400px] flex-shrink-0 bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-6">
                    <div>
                        <h2 className="text-xl font-semibold mb-1">UGC Product Video</h2>
                        <p className="text-gray-400 text-xs">Generate Videos from Product Images using Google's Veo 3.1 model</p>
                    </div>

                    {/* Image Uploaders */}
                    <div>
                        <label className="text-sm font-medium mb-3 block text-gray-300">Upload Images (up to 3)</label>
                        <div className="grid grid-cols-3 gap-3">
                            {images.map((img, idx) => (
                                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-gray-800 border border-gray-700 hover:border-gray-500 transition-colors group">
                                    {img ? (
                                        <>
                                            <img src={img} alt={`Product ${idx+1}`} className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => {
                                                    const newImages = [...images];
                                                    newImages[idx] = null;
                                                    setImages(newImages);
                                                }}
                                                className="absolute top-1 right-1 bg-black/50 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </>
                                    ) : (
                                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer text-gray-500 hover:text-gray-300">
                                            <Plus size={24} />
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(idx, e)} />
                                        </label>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Prompt */}
                    <div>
                        <label className="text-sm font-medium mb-2 block text-gray-300">Prompt</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe the scene, character actions, camera angles..."
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-blue-500 outline-none h-32 resize-none"
                        />
                    </div>

                    {/* Controls */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 mb-1 block">Resolution</label>
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-gray-300 flex justify-between items-center">
                                <span>720p</span>
                                <div className="rotate-90 text-xs">&rsaquo;</div>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 mb-1 block">Duration</label>
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-gray-300 flex justify-between items-center">
                                <span>8s</span>
                                <div className="rotate-90 text-xs">&rsaquo;</div>
                            </div>
                        </div>
                    </div>

                    {/* Toggle */}
                    <div className="bg-gray-800/50 p-3 rounded-xl flex items-center justify-between border border-gray-700">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                            Generate Audio <Zap size={14} className="text-blue-400 fill-blue-400" />
                        </div>
                        <button 
                            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${isAudioEnabled ? 'bg-white' : 'bg-gray-600'}`}
                        >
                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-black transition-all ${isAudioEnabled ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={status === 'generating' || !hasSufficientCredits}
                        className={`w-full font-medium py-3 rounded-xl transition-all shadow-lg flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed mt-auto ${
                            !hasSufficientCredits
                            ? 'bg-gray-700 text-gray-500 border border-gray-600'
                            : 'bg-blue-900/80 hover:bg-blue-800 text-blue-100 border border-blue-700'
                        }`}
                    >
                        {status === 'generating' ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="animate-spin" size={20} /> Generating...
                            </div>
                        ) : !hasSufficientCredits ? (
                            <span className="text-sm font-bold">Insufficient Credits</span>
                        ) : (
                            <>
                                <span className="text-sm font-bold">Generate Video</span>
                                <span className="text-xs opacity-70">{COST} Credit (8s)</span>
                            </>
                        )}
                    </button>
                    {errorMsg && <div className="text-red-400 text-xs text-center">{errorMsg}</div>}
                </div>

                {/* Right Panel: Preview */}
                <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-gray-200 font-medium">Output Preview</h2>
                        {status === 'completed' && (
                             <button 
                                onClick={handleSaveProject}
                                className="flex items-center gap-2 px-4 py-1.5 bg-green-700 text-white rounded-lg text-sm font-bold hover:bg-green-600 transition-colors animate-pulse"
                             >
                                <Save size={16} /> Save to Projects
                             </button>
                        )}
                    </div>
                    
                    <div className="flex-1 bg-black rounded-xl overflow-hidden relative flex items-center justify-center border border-gray-800">
                        {status === 'completed' && videoUri ? (
                            <video src={videoUri} controls autoPlay loop className="w-full h-full object-contain" />
                        ) : status === 'generating' ? (
                            <div className="text-center">
                                <Loader2 className="animate-spin text-blue-500 w-12 h-12 mb-4 mx-auto" />
                                <p className="text-gray-500 font-medium">Generating your masterpiece...</p>
                            </div>
                        ) : (
                            <div className="text-gray-600 flex flex-col items-center">
                                <Video size={48} className="mb-2 opacity-20" />
                                <p>Preview area</p>
                            </div>
                        )}
                    </div>

                    {/* Action Bar */}
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <button className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg border border-gray-700 transition-colors text-sm font-medium">
                            <PenTool size={14} /> Edit
                        </button>
                        <button className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg border border-gray-700 transition-colors text-sm font-medium">
                            <Sparkles size={14} className="text-green-400" /> Animate
                        </button>
                        <button className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg border border-gray-700 transition-colors text-sm font-medium">
                            <Volume2 size={14} className="text-purple-400" /> Add Sound
                        </button>
                        <button className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg border border-gray-700 transition-colors text-sm font-medium">
                            <Download size={14} /> Download
                        </button>
                    </div>
                </div>
             </div>
        </div>
    );
};

// ==========================================
// 5. Text to Video Editor (Purple Dark Theme)
// ==========================================
const TextToVideoEditor: React.FC<EditorProps> = ({ onGenerate, userCredits }) => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [status, setStatus] = useState<'idle' | 'generating' | 'completed' | 'error'>('idle');
    const [videoUri, setVideoUri] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    
    const COST = 1;
    const hasSufficientCredits = userCredits >= COST;

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setErrorMsg("Please enter a text prompt.");
            return;
        }
        if (!hasSufficientCredits) {
            setErrorMsg("Insufficient credits.");
            return;
        }

        setStatus('generating');
        setErrorMsg('');
        setVideoUri(null);

        try {
            // Check key
            if (window.aistudio && window.aistudio.hasSelectedApiKey) {
                const has = await window.aistudio.hasSelectedApiKey();
                if (!has) await window.aistudio.openSelectKey();
            }

            const uri = await generateVeoVideo(prompt, aspectRatio);
            setVideoUri(uri);
            setStatus('completed');
        } catch (error: any) {
            console.error(error);
            setStatus('error');
            setErrorMsg(error.message || "Failed to generate video.");
        }
    };

    const handleSaveProject = () => {
        if (status === 'completed' && videoUri) {
             onGenerate({
                 isDirectSave: true,
                 videoUrl: videoUri,
                 thumbnailUrl: null, 
                 cost: COST
             });
        }
    };

    return (
        <div className="h-full bg-black text-white p-4 lg:p-8 overflow-y-auto rounded-xl">
             <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto h-full">
                {/* Left Panel: Inputs */}
                <div className="w-full lg:w-[400px] flex-shrink-0 bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-6">
                    <div>
                        <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                            <Clapperboard size={20} className="text-purple-400" />
                            AI Video Generator
                        </h2>
                        <p className="text-gray-400 text-xs">Turn text into cinematic video using Veo 3.1</p>
                    </div>

                    {/* Prompt */}
                    <div className="flex-1">
                        <label className="text-sm font-medium mb-2 block text-gray-300">Prompt</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="A futuristic city with flying cars in cyberpunk style, cinematic lighting..."
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-purple-500 outline-none h-48 resize-none leading-relaxed"
                        />
                    </div>

                    {/* Controls */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 mb-1 block">Aspect Ratio</label>
                            <select 
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value as any)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-gray-300 outline-none focus:border-purple-500"
                            >
                                <option value="16:9">16:9 (Landscape)</option>
                                <option value="9:16">9:16 (Portrait)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 mb-1 block">Duration</label>
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-gray-500 flex justify-between items-center cursor-not-allowed">
                                <span>~5s (Preview)</span>
                            </div>
                        </div>
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={status === 'generating' || !hasSufficientCredits}
                        className={`w-full font-medium py-3 rounded-xl transition-all shadow-lg flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed mt-6 ${
                            !hasSufficientCredits
                            ? 'bg-gray-700 text-gray-500 border border-gray-600'
                            : 'bg-purple-900/80 hover:bg-purple-800 text-purple-100 border border-purple-700'
                        }`}
                    >
                        {status === 'generating' ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="animate-spin" size={20} /> Generating...
                            </div>
                        ) : !hasSufficientCredits ? (
                            <span className="text-sm font-bold">Insufficient Credits</span>
                        ) : (
                            <>
                                <span className="text-sm font-bold">Generate Video</span>
                                <span className="text-xs opacity-70">{COST} Credit</span>
                            </>
                        )}
                    </button>
                    {errorMsg && <div className="text-red-400 text-xs text-center">{errorMsg}</div>}
                </div>

                {/* Right Panel: Preview */}
                <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-gray-200 font-medium">Output Preview</h2>
                        {status === 'completed' && (
                             <button 
                                onClick={handleSaveProject}
                                className="flex items-center gap-2 px-4 py-1.5 bg-green-700 text-white rounded-lg text-sm font-bold hover:bg-green-600 transition-colors animate-pulse"
                             >
                                <Save size={16} /> Save to Projects
                             </button>
                        )}
                    </div>
                    
                    <div className="flex-1 bg-black rounded-xl overflow-hidden relative flex items-center justify-center border border-gray-800">
                        {status === 'completed' && videoUri ? (
                            <video src={videoUri} controls autoPlay loop className="w-full h-full object-contain" />
                        ) : status === 'generating' ? (
                            <div className="text-center">
                                <Loader2 className="animate-spin text-purple-500 w-12 h-12 mb-4 mx-auto" />
                                <p className="text-gray-500 font-medium">Creating magic...</p>
                            </div>
                        ) : (
                            <div className="text-gray-600 flex flex-col items-center">
                                <Clapperboard size={48} className="mb-2 opacity-20" />
                                <p>Preview area</p>
                            </div>
                        )}
                    </div>
                </div>
             </div>
        </div>
    );
};

// ==========================================
// Main Editor Container
// ==========================================
export const Editor: React.FC<EditorProps> = (props) => {
    const { template, onBack } = props;

    // Render logic based on template "mode"
    let content;
    if (template.mode === 'TEXT_TO_VIDEO') {
        content = <TextToVideoEditor {...props} />;
    } else if (template.mode === 'UGC_PRODUCT') {
        content = <ProductUGCEditor {...props} />;
    } else {
        content = <AvatarEditor {...props} />;
    }

    return (
        <div className="h-full flex flex-col">
            {/* Shared Header */}
            <div className="flex items-center gap-3 mb-6 flex-shrink-0">
                <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors group">
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-bold uppercase tracking-wide">Back</span>
                </button>
            </div>
            
            <div className="flex-1 overflow-hidden">
                {content}
            </div>
        </div>
    );
};