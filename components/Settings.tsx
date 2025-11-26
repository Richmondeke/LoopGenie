import React, { useState } from 'react';
import { Key, Save, Eye, EyeOff, CheckCircle } from 'lucide-react';

interface SettingsProps {
  heyGenKey: string;
  setHeyGenKey: (key: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  heyGenKey, 
  setHeyGenKey,
}) => {
  const [showHeyGen, setShowHeyGen] = useState(false);
  const [localHeyGen, setLocalHeyGen] = useState(heyGenKey);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setHeyGenKey(localHeyGen);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto pt-10 px-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>
      
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                    <Key size={20} />
                </div>
                <div>
                    <h3 className="font-semibold text-gray-900">API Configuration</h3>
                    <p className="text-sm text-gray-500">Manage your keys for video generation.</p>
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">HeyGen API Key</label>
                    <div className="relative">
                        <input
                            type={showHeyGen ? "text" : "password"}
                            value={localHeyGen}
                            onChange={(e) => setLocalHeyGen(e.target.value)}
                            className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Enter your HeyGen API Key"
                        />
                        <button
                            onClick={() => setShowHeyGen(!showHeyGen)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            {showHeyGen ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Required for video rendering. Stored locally in your browser.</p>
                </div>
            </div>
        </div>
        <div className="p-4 bg-gray-50 flex justify-end">
            <button
                onClick={handleSave}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
                    saved 
                    ? 'bg-green-600 text-white' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
            >
                {saved ? <CheckCircle size={18} /> : <Save size={18} />}
                {saved ? 'Saved' : 'Save Changes'}
            </button>
        </div>
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-1">Note on Security</h4>
        <p className="text-xs text-blue-800 leading-relaxed">
            This is a client-side demonstration application. Your HeyGen API key is persisted only in your browser's local storage. The Gemini API key is configured via environment variables.
        </p>
      </div>
    </div>
  );
};