
import React, { useState, useEffect } from 'react';
import { User, Loader2, ShoppingBag } from 'lucide-react';
import { Template, HeyGenAvatar } from '../types';
import { getAvatars } from '../services/heygenService';

interface TemplateGalleryProps {
  onSelectTemplate: (template: Template) => void;
  heyGenKey?: string;
}

type GalleryView = 'DASHBOARD' | 'AVATAR_SELECT';

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({ onSelectTemplate, heyGenKey }) => {
  const [view, setView] = useState<GalleryView>('DASHBOARD');
  const [avatars, setAvatars] = useState<HeyGenAvatar[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Pre-fetch avatars so they are ready when clicking the card
    const fetchRealAvatars = async () => {
        // If we already have avatars and no key change, don't refetch unless empty
        if (!heyGenKey && avatars.length > 0) return;
        
        setIsLoading(true);
        try {
            const realAvatars = await getAvatars(heyGenKey || '');
            const source = realAvatars;
            
            // Filter for 2 Males and 2 Females if available
            const males = source.filter(a => a.gender === 'male').slice(0, 2);
            const females = source.filter(a => a.gender === 'female').slice(0, 2);
            
            // If we don't have enough specific genders, just fill up with whatever is left up to 4
            let combined = [...males, ...females];
            if (combined.length < 4) {
                const remaining = source.filter(a => !combined.some(c => c.id === a.id)).slice(0, 4 - combined.length);
                combined = [...combined, ...remaining];
            }

            setAvatars(combined);
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
          name: 'Product Holding Video Generator',
          category: 'AI',
          thumbnailUrl: '',
          variables: [],
          mode: 'UGC_PRODUCT'
      });
  };

  if (view === 'AVATAR_SELECT') {
      return (
        <div className="h-full flex flex-col">
            <div className="mb-8 flex items-center gap-4">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto w-full px-4">
                    {avatars.length === 0 ? (
                        <div className="col-span-full text-center text-gray-500 py-10">
                            No avatars found. Please check your HeyGen API Key in Settings.
                        </div>
                    ) : (
                        avatars.map(avatar => (
                            <div 
                                key={avatar.id}
                                className="group relative bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2"
                                onClick={() => handleSelectAvatar(avatar)}
                            >
                                <div className="aspect-[4/3] sm:aspect-[16/10] bg-gray-100 overflow-hidden relative">
                                    <img 
                                        src={avatar.previewUrl} 
                                        alt={avatar.name} 
                                        className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/600x400?text=Avatar'; }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
                                    <div className="absolute bottom-6 left-6 text-white">
                                        <h3 className="font-bold text-2xl mb-1">{avatar.name}</h3>
                                        <p className="text-sm font-medium opacity-90 uppercase tracking-wider">{avatar.gender}</p>
                                    </div>
                                    <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                                         <span className="bg-white text-indigo-900 px-4 py-2 rounded-full font-bold text-sm shadow-lg flex items-center gap-2">
                                            Select <span className="text-lg">&rarr;</span>
                                         </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
      );
  }

  return (
    <div className="h-full flex flex-col justify-center max-w-5xl mx-auto pb-10">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">What would you like to create?</h2>
        <p className="text-gray-600 font-medium">Select a workflow to get started.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
        
        {/* Card 1: Avatar Video */}
        <div 
            onClick={() => setView('AVATAR_SELECT')}
            className="group bg-white rounded-3xl p-8 border border-gray-200 shadow-sm hover:shadow-2xl hover:border-indigo-200 transition-all duration-300 cursor-pointer flex flex-col items-center text-center relative overflow-hidden min-h-[320px]"
        >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300">
                <User size={40} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Create Avatar Video</h3>
            <p className="text-gray-600 font-medium text-sm leading-relaxed mb-6 max-w-xs">
                Choose from premium avatars with lifelike lip-sync and studio-quality voices.
            </p>
            <span className="mt-auto text-indigo-700 font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                Select <span className="text-xl">&rarr;</span>
            </span>
        </div>

        {/* Card 2: Product UGC */}
        <div 
            onClick={handleSelectProductUGC}
            className="group bg-white rounded-3xl p-8 border border-gray-200 shadow-sm hover:shadow-2xl hover:border-teal-200 transition-all duration-300 cursor-pointer flex flex-col items-center text-center relative overflow-hidden min-h-[320px]"
        >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-teal-500 to-emerald-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
            <div className="w-20 h-20 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300">
                <ShoppingBag size={40} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Create Product UGC</h3>
            <p className="text-gray-600 font-medium text-sm leading-relaxed mb-6 max-w-xs">
                Upload products and generate engaging User Generated Content videos instantly.
            </p>
            <span className="mt-auto text-teal-700 font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                Create <span className="text-xl">&rarr;</span>
            </span>
        </div>

      </div>
    </div>
  );
};
