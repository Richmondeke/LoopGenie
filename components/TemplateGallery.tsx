
import React, { useState, useEffect } from 'react';
import { User, Loader2, ShoppingBag, Clapperboard } from 'lucide-react';
import { Template, HeyGenAvatar } from '../types';
import { getAvatars } from '../services/heygenService';

export interface TemplateGalleryProps {
  onSelectTemplate: (template: Template) => void;
  heyGenKey?: string;
  initialView?: 'DASHBOARD' | 'AVATAR_SELECT';
}

type GalleryView = 'DASHBOARD' | 'AVATAR_SELECT';

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({ onSelectTemplate, heyGenKey, initialView = 'DASHBOARD' }) => {
  const [view, setView] = useState<GalleryView>(initialView);
  const [avatars, setAvatars] = useState<HeyGenAvatar[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'male' | 'female'>('ALL');

  useEffect(() => {
    // Pre-fetch avatars so they are ready when clicking the card
    const fetchRealAvatars = async () => {
        // If we already have avatars and no key change, don't refetch unless empty
        // The service layer handles API caching.
        if (!heyGenKey && avatars.length > 0) return;
        
        setIsLoading(true);
        try {
            const realAvatars = await getAvatars(heyGenKey || '');
            // Load ALL avatars, do not slice/limit them.
            setAvatars(realAvatars);
        } catch (e) {
            console.error("Failed to load avatars", e);
            setAvatars([]);
        } finally {
            setIsLoading(false);
        }
    };

    if (view === 'AVATAR_SELECT') {
        fetchRealAvatars();
    }
  }, [heyGenKey, view]); // Trigger fetch when entering AVATAR_SELECT view

  const handleSelectAvatar = (avatar: HeyGenAvatar) => {
      const template: Template = {
          id: `custom_avatar_${avatar.id}`,
          name: avatar.name,
          category: 'Avatar',
          thumbnailUrl: avatar.previewUrl,
          defaultAvatarId: avatar.id,
          variables: [
              { 
                  key: 'script', 
                  label: 'Script', 
                  type: 'textarea', 
                  placeholder: `Hi, I'm ${avatar.name}. I can read any text you type here!` 
              }
          ],
          mode: 'AVATAR'
      };
      onSelectTemplate(template);
  };

  const handleSelectProductUGC = () => {
      onSelectTemplate({
          id: 'mode_ugc',
          name: 'UGC Product Video',
          category: 'AI',
          thumbnailUrl: '',
          variables: [],
          mode: 'UGC_PRODUCT'
      });
  };

  const handleSelectTextToVideo = () => {
      onSelectTemplate({
          id: 'mode_text_video',
          name: 'AI Video Generator',
          category: 'AI',
          thumbnailUrl: '',
          variables: [],
          mode: 'TEXT_TO_VIDEO'
      });
  };

  // Helper to filter avatars
  const filteredAvatars = avatars.filter(avatar => {
      if (genderFilter === 'ALL') return true;
      return avatar.gender === genderFilter;
  });

  if (view === 'AVATAR_SELECT') {
      return (
        <div className="h-full flex flex-col">
            <div className="mb-8 flex items-center gap-4 flex-shrink-0">
                <button 
                    onClick={() => setView('DASHBOARD')}
                    className="text-gray-700 hover:text-indigo-700 transition-colors font-medium flex items-center gap-1"
                >
                    &larr; Back
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Select Avatar</h2>
                    <p className="text-gray-600 font-medium">Choose one of the available avatars.</p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 gap-6">
                    <div className="p-4 bg-indigo-50 rounded-full">
                        <Loader2 className="animate-spin text-indigo-600" size={48} />
                    </div>
                    <p className="text-indigo-900 font-bold text-xl animate-pulse">..loading up your avatars</p>
                </div>
            ) : (
                <div className="flex flex-col h-full overflow-hidden">
                    {/* Gender Filter Tabs */}
                    {avatars.length > 0 && (
                        <div className="flex justify-center mb-6 flex-shrink-0">
                            <div className="bg-gray-100 p-1.5 rounded-xl inline-flex shadow-inner">
                                {(['ALL', 'male', 'female'] as const).map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => setGenderFilter(filter)}
                                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 capitalize ${
                                            genderFilter === filter 
                                            ? 'bg-white text-indigo-600 shadow-sm transform scale-105' 
                                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                        }`}
                                    >
                                        {filter === 'ALL' ? 'All Avatars' : filter}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto min-h-0 px-1 pb-10">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto w-full">
                            {avatars.length === 0 ? (
                                <div className="col-span-full text-center text-gray-500 py-10">
                                    No avatars found. Please check your HeyGen API Key in Settings.
                                </div>
                            ) : filteredAvatars.length === 0 ? (
                                <div className="col-span-full text-center text-gray-400 py-20 flex flex-col items-center">
                                    <User size={48} className="mb-4 opacity-20" />
                                    <p>No {genderFilter} avatars found.</p>
                                </div>
                            ) : (
                                filteredAvatars.map(avatar => (
                                    <div 
                                        key={avatar.id}
                                        className="group relative bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2"
                                        onClick={() => handleSelectAvatar(avatar)}
                                    >
                                        <div className="aspect-[4/3] bg-gray-100 overflow-hidden relative">
                                            <img 
                                                src={avatar.previewUrl} 
                                                alt={avatar.name} 
                                                loading="lazy"
                                                className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/600x400?text=Avatar'; }}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
                                            <div className="absolute bottom-4 left-4 text-white">
                                                <h3 className="font-bold text-lg mb-0.5">{avatar.name}</h3>
                                                <p className="text-xs font-medium opacity-90 uppercase tracking-wider">{avatar.gender}</p>
                                            </div>
                                            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                                                 <span className="bg-white text-indigo-900 px-3 py-1.5 rounded-full font-bold text-xs shadow-lg flex items-center gap-1">
                                                    Select &rarr;
                                                 </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
      );
  }

  return (
    <div className="h-full flex flex-col justify-center max-w-7xl mx-auto pb-10">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">What would you like to create?</h2>
        <p className="text-gray-600 font-medium">Select a workflow to get started.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4">
        
        {/* Card 1: Avatar Video */}
        <div 
            onClick={() => setView('AVATAR_SELECT')}
            className="group bg-white rounded-3xl border border-gray-200 shadow-sm hover:shadow-2xl hover:border-indigo-200 transition-all duration-300 cursor-pointer flex flex-col relative overflow-hidden"
        >
            {/* Image Header */}
            <div className="h-48 overflow-hidden relative bg-gray-100">
                <div className="absolute inset-0 bg-indigo-900/10 group-hover:bg-transparent transition-colors z-10" />
                <img 
                    src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=800&q=80" 
                    alt="Avatar Video" 
                    loading="eager"
                    className="w-full h-full object-cover object-top transform group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur-md p-2 rounded-xl text-indigo-600 shadow-sm">
                    <User size={24} />
                </div>
            </div>

            <div className="p-6 flex flex-col flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Create Avatar Video</h3>
                <p className="text-gray-600 font-medium text-sm leading-relaxed mb-6">
                    Choose from premium avatars with lifelike lip-sync and studio voices.
                </p>
                <span className="mt-auto text-indigo-700 font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                    Select <span className="text-xl">&rarr;</span>
                </span>
            </div>
        </div>

        {/* Card 2: Product UGC */}
        <div 
            onClick={handleSelectProductUGC}
            className="group bg-white rounded-3xl border border-gray-200 shadow-sm hover:shadow-2xl hover:border-teal-200 transition-all duration-300 cursor-pointer flex flex-col relative overflow-hidden"
        >
             {/* Image Header */}
             <div className="h-48 overflow-hidden relative bg-gray-100">
                <div className="absolute inset-0 bg-teal-900/10 group-hover:bg-transparent transition-colors z-10" />
                <img 
                    src="https://images.unsplash.com/photo-1629198688000-71f23e745b6e?auto=format&fit=crop&w=800&q=80" 
                    alt="Product UGC" 
                    loading="eager"
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur-md p-2 rounded-xl text-teal-600 shadow-sm">
                    <ShoppingBag size={24} />
                </div>
            </div>

            <div className="p-6 flex flex-col flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Create Product UGC</h3>
                <p className="text-gray-600 font-medium text-sm leading-relaxed mb-6">
                    Upload products and generate engaging User Generated Content videos.
                </p>
                <span className="mt-auto text-teal-700 font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                    Create <span className="text-xl">&rarr;</span>
                </span>
            </div>
        </div>

        {/* Card 3: AI Video (Text to Video) */}
        <div 
            onClick={handleSelectTextToVideo}
            className="group bg-white rounded-3xl border border-gray-200 shadow-sm hover:shadow-2xl hover:border-purple-200 transition-all duration-300 cursor-pointer flex flex-col relative overflow-hidden"
        >
             {/* Image Header */}
             <div className="h-48 overflow-hidden relative bg-gray-100">
                <div className="absolute inset-0 bg-purple-900/10 group-hover:bg-transparent transition-colors z-10" />
                <img 
                    src="https://images.unsplash.com/photo-1618172193763-c511deb635ca?auto=format&fit=crop&w=800&q=80" 
                    alt="AI Video" 
                    loading="eager"
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur-md p-2 rounded-xl text-purple-600 shadow-sm">
                    <Clapperboard size={24} />
                </div>
            </div>

            <div className="p-6 flex flex-col flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Create AI Video</h3>
                <p className="text-gray-600 font-medium text-sm leading-relaxed mb-6">
                    Turn your text prompts into cinematic videos instantly using Veo 3.1.
                </p>
                <span className="mt-auto text-purple-700 font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                    Generate <span className="text-xl">&rarr;</span>
                </span>
            </div>
        </div>

      </div>
    </div>
  );
};
