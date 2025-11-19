
import React, { useState, useEffect } from 'react';
import { HistoryItem, LanguagePack } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onClearHistory: () => void;
  autoSave: boolean;
  onToggleAutoSave: () => void;
  packs: LanguagePack[];
  onUpdatePackStatus: (id: string, isDownloaded: boolean) => void;
  useOfflineMode: boolean;
  onToggleOfflineMode: () => void;
  textSizeMultiplier: number;
  onSetTextSizeMultiplier: (value: number) => void;
}

type Tab = 'guide' | 'history' | 'offline' | 'settings';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  history,
  onClearHistory,
  autoSave,
  onToggleAutoSave,
  packs,
  onUpdatePackStatus,
  useOfflineMode,
  onToggleOfflineMode,
  textSizeMultiplier,
  onSetTextSizeMultiplier,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('guide');
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  // Logic to simulate downloading
  const startDownload = (id: string) => {
    if (downloadProgress[id] !== undefined) return;

    setDownloadProgress(prev => ({ ...prev, [id]: 0 }));

    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        const current = prev[id] || 0;
        if (current >= 100) {
          clearInterval(interval);
          onUpdatePackStatus(id, true);
          const newState = { ...prev };
          delete newState[id];
          return newState;
        }
        return { ...prev, [id]: current + (Math.random() * 10 + 5) };
      });
    }, 200);
  };

  if (!isOpen) return null;

  const allPacksDownloaded = packs.every(p => p.isDownloaded);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-white font-bold text-lg">Menu</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 overflow-x-auto hide-scrollbar">
          <button 
            onClick={() => setActiveTab('guide')}
            className={`flex-1 min-w-[80px] py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'guide' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Guide
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 min-w-[80px] py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'history' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            History <span className="text-[10px] ml-1 bg-gray-800 px-1.5 py-0.5 rounded-full">{history.length}</span>
          </button>
          <button 
            onClick={() => setActiveTab('offline')}
            className={`flex-1 min-w-[80px] py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'offline' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Packs
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex-1 min-w-[80px] py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Settings
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5">
          
          {/* GUIDE TAB */}
          {activeTab === 'guide' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-blue-500/20 text-blue-400 p-1 rounded">🎯</span> How to Use
                </h3>
                <ul className="text-gray-400 text-sm space-y-2 list-disc pl-5">
                  <li>Point the camera at Japanese text.</li>
                  <li>Tap the <strong>Shutter Button</strong> to capture and translate.</li>
                  <li>Use <strong>Auto Scan</strong> for continuous hands-free translation.</li>
                  <li>Tap detected text boxes to <strong>copy</strong>.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-purple-500/20 text-purple-400 p-1 rounded">🖥️</span> Screen Translation
                </h3>
                <p className="text-gray-400 text-sm">
                  Click the <strong>Screen Share</strong> icon in the top right to translate text from other apps or browser tabs.
                </p>
              </div>

              <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                <p className="text-xs text-gray-500">
                  <strong>Note:</strong> Live translation requires an active internet connection unless you download offline packs.
                </p>
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Saved Translations</span>
                {history.length > 0 && (
                  <button onClick={onClearHistory} className="text-xs text-red-400 hover:text-red-300">Clear All</button>
                )}
              </div>
              
              {history.length === 0 ? (
                <div className="text-center py-10 text-gray-600">
                  <p>No history yet.</p>
                  <p className="text-xs mt-1">Translations will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] text-gray-500">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-white text-sm font-medium mb-1 line-clamp-2">{item.summary}</p>
                      <div className="text-xs text-gray-400 bg-black/30 p-2 rounded mt-2 line-clamp-3 font-mono">
                        {item.fullText}
                      </div>
                      <button 
                        onClick={() => navigator.clipboard.writeText(item.fullText)}
                        className="mt-2 text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        Copy Full Text
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* OFFLINE PACKS TAB */}
          {activeTab === 'offline' && (
            <div className="space-y-5">
              
              {/* Master Toggle */}
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-medium">Offline Translation</h3>
                   <button 
                    onClick={allPacksDownloaded ? onToggleOfflineMode : undefined}
                    disabled={!allPacksDownloaded}
                    className={`w-12 h-6 rounded-full relative transition-all ${
                      !allPacksDownloaded ? 'bg-gray-700 opacity-50 cursor-not-allowed' : 
                      useOfflineMode ? 'bg-green-600' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${useOfflineMode ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  {allPacksDownloaded 
                    ? "Use downloaded models for faster, data-free translation." 
                    : "Download all language packs below to enable offline mode."}
                </p>
              </div>

              {/* Packs List */}
              <div>
                <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Available Language Packs</h4>
                <div className="space-y-3">
                  {packs.map((pack) => {
                     const progress = downloadProgress[pack.id];
                     const isDownloading = progress !== undefined;

                     return (
                       <div key={pack.id} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
                         <div className="flex justify-between items-start mb-1">
                            <div>
                              <p className="text-white text-sm font-medium">{pack.name}</p>
                              <p className="text-xs text-gray-500">{pack.description} • {pack.size}</p>
                            </div>
                            {pack.isDownloaded ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-1 rounded font-medium">Installed</span>
                                <button 
                                  onClick={() => onUpdatePackStatus(pack.id, false)}
                                  className="text-gray-500 hover:text-red-400 p-1"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            ) : isDownloading ? (
                              <span className="text-xs text-blue-400 font-medium">{Math.round(progress)}%</span>
                            ) : (
                              <button 
                                onClick={() => startDownload(pack.id)}
                                className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Download
                              </button>
                            )}
                         </div>
                         {/* Progress Bar */}
                         {isDownloading && (
                            <div className="h-1 w-full bg-gray-700 rounded-full mt-2 overflow-hidden">
                               <div className="h-full bg-blue-500 transition-all duration-200" style={{ width: `${progress}%` }}></div>
                            </div>
                         )}
                       </div>
                     );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-gray-800 p-3 rounded-lg">
                <div>
                  <p className="text-white text-sm font-medium">Auto-Save History</p>
                  <p className="text-xs text-gray-400">Automatically save translations to offline history.</p>
                </div>
                <button 
                  onClick={onToggleAutoSave}
                  className={`w-12 h-6 rounded-full relative transition-colors ${autoSave ? 'bg-blue-600' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${autoSave ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>
              
              {/* Text Size Adjustment */}
              <div className="bg-gray-800 p-3 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                    <div>
                        <p className="text-white text-sm font-medium">Text Size</p>
                        <p className="text-xs text-gray-400">Adjust the size of translated text.</p>
                    </div>
                    <span className="text-sm font-bold text-blue-400">{Math.round(textSizeMultiplier * 100)}%</span>
                </div>
                <input 
                    type="range" 
                    min="0.75" 
                    max="1.5" 
                    step="0.05"
                    value={textSizeMultiplier}
                    onChange={(e) => onSetTextSizeMultiplier(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>Smaller</span>
                    <span>Larger</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-800">
                 <p className="text-center text-xs text-gray-600">
                   Japanese-Korean Live Translator<br/>
                   v1.4.0
                 </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
