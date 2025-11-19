
import React, { Component, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
import { CameraFeed } from './components/CameraFeed';
import { Overlay } from './components/Overlay';
import { SettingsModal } from './components/SettingsModal';
import { translateImage, translateImageOffline } from './services/geminiService';
import { AppState, TranslationResult, HistoryItem, LanguagePack } from './types';

// --- Error Boundary Component ---
interface ErrorBoundaryProps {
  children?: ReactNode;
  onReset: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Critical application error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 text-white p-6">
           <div className="max-w-xs w-full text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">Component Error</h3>
              <p className="text-sm text-gray-400 mb-6">
                 An unexpected error occurred in the camera or translation module.
              </p>
              <button 
                 onClick={this.handleRetry}
                 className="w-full bg-white text-black font-bold py-3 rounded-full hover:bg-gray-200 transition-colors"
              >
                 Reload Component
              </button>
           </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const INITIAL_PACKS: LanguagePack[] = [
  { id: 'jp_ocr', name: 'Japanese OCR Model', size: '45 MB', isDownloaded: false, description: 'Optical character recognition' },
  { id: 'kr_nmt', name: 'Korean Translation Model', size: '120 MB', isDownloaded: false, description: 'Neural machine translation' }
];

const App: React.FC = () => {
  const [isAutoMode, setIsAutoMode] = useState<boolean>(false);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [translationData, setTranslationData] = useState<TranslationResult | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isScreenShareSupported, setIsScreenShareSupported] = useState(false);
  
  // Static Image / Upload State
  const [staticImage, setStaticImage] = useState<string | null>(null);
  const [contentRect, setContentRect] = useState<{x:number, y:number, w:number, h:number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Settings & History State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [autoSave, setAutoSave] = useState(true);
  const [textSizeMultiplier, setTextSizeMultiplier] = useState(1.0);

  // Offline Pack State
  const [languagePacks, setLanguagePacks] = useState<LanguagePack[]>(INITIAL_PACKS);
  const [useOfflineMode, setUseOfflineMode] = useState(false);

  // Load persisted data
  useEffect(() => {
    const savedHistory = localStorage.getItem('jp_kr_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) { console.error("Failed to parse history", e); }
    }
    const savedAutoSave = localStorage.getItem('jp_kr_autosave');
    if (savedAutoSave !== null) setAutoSave(savedAutoSave === 'true');

    const savedPacks = localStorage.getItem('jp_kr_packs');
    if (savedPacks) {
        try {
            setLanguagePacks(JSON.parse(savedPacks));
        } catch (e) { console.error(e); }
    }

    const savedOfflineMode = localStorage.getItem('jp_kr_offline_pref');
    if (savedOfflineMode !== null) setUseOfflineMode(savedOfflineMode === 'true');

    const savedTextSize = localStorage.getItem('jp_kr_text_size');
    if (savedTextSize !== null) setTextSizeMultiplier(parseFloat(savedTextSize));

    // Check for screen share support
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      setIsScreenShareSupported(true);
    }
  }, []);

  // Save History Helper
  const saveToHistory = useCallback((result: TranslationResult) => {
    // FIX: Allow saving if we have a summary, even if no items are detected (e.g. scene description)
    if ((!result.items || result.items.length === 0) && !result.summary) return;
    
    const fullText = (result.items && result.items.length > 0)
      ? result.items.map(i => `${i.original} -> ${i.translated}`).join('\n')
      : `[Summary Only] ${result.summary}`;
    
    setHistory(prev => {
      // Prevent duplicate sequential saves (e.g. Auto-save then manual save)
      // We check the text AND the summary to ensure it's truly the same content
      if (prev.length > 0 && prev[0].fullText === fullText && prev[0].summary === result.summary) {
        return prev;
      }

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        summary: result.summary || "No summary",
        fullText: fullText
      };

      const newHistory = [newItem, ...prev].slice(50); // Limit to 50 items
      
      try {
        localStorage.setItem('jp_kr_history', JSON.stringify(newHistory));
      } catch (e) {
        console.error("Failed to save history to localStorage", e);
      }
      
      return newHistory;
    });
  }, []);

  const handleManualSave = useCallback(() => {
    if (translationData) {
      saveToHistory(translationData);
    }
  }, [translationData, saveToHistory]);

  // Pack Management
  const updatePackStatus = (id: string, isDownloaded: boolean) => {
    setLanguagePacks(prev => {
        const newPacks = prev.map(p => p.id === id ? { ...p, isDownloaded } : p);
        localStorage.setItem('jp_kr_packs', JSON.stringify(newPacks));
        
        // If uninstalling, force offline mode off if required
        if (!isDownloaded && useOfflineMode) {
            setUseOfflineMode(false);
            localStorage.setItem('jp_kr_offline_pref', 'false');
        }
        return newPacks;
    });
  };

  const toggleOfflineMode = () => {
      setUseOfflineMode(prev => {
          const newVal = !prev;
          localStorage.setItem('jp_kr_offline_pref', String(newVal));
          return newVal;
      });
  };

  // Toggle Auto Save
  const toggleAutoSave = () => {
    setAutoSave(prev => {
      const newVal = !prev;
      localStorage.setItem('jp_kr_autosave', String(newVal));
      return newVal;
    });
  };

  // Set Text Size
  const handleSetTextSize = (val: number) => {
      setTextSizeMultiplier(val);
      localStorage.setItem('jp_kr_text_size', String(val));
  };

  // Clear History
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('jp_kr_history');
  };

  // Determine if the camera should effectively be capturing
  const handleFrameCapture = useCallback(async (base64Image: string) => {
    if (appState === AppState.SCANNING || isSettingsOpen) return;

    // Freeze frame logic: If we are manual scanning live view, switch to static
    if (!isAutoMode && !staticImage) {
        setStaticImage(base64Image);
    }

    setAppState(AppState.SCANNING);
    try {
      let result: TranslationResult;
      
      if (useOfflineMode) {
         result = await translateImageOffline();
      } else {
         result = await translateImage(base64Image);
      }

      if (result) {
        setTranslationData(result);
        // Auto-save logic: Keep strict to avoid spamming empty results, only save if items found
        if (autoSave && result.items && result.items.length > 0) {
          saveToHistory(result);
        }
        setAppState(AppState.IDLE);
      } else {
        // Handle case where result is undefined/null but no error thrown
        throw new Error("Empty result");
      }

    } catch (error) {
      console.error("Frame processing error:", error);
      setAppState(AppState.ERROR);
      
      // Automatically retry after a delay if in Auto Mode
      if (isAutoMode) {
        setTimeout(() => setAppState(AppState.IDLE), 3000);
      } else {
        setTimeout(() => setAppState(AppState.IDLE), 2000);
      }
    }
  }, [appState, isSettingsOpen, autoSave, saveToHistory, useOfflineMode, isAutoMode, staticImage]);

  const toggleAutoMode = () => {
    if (staticImage) {
        clearStaticImage(); // Exit static mode if turning on auto
    }
    setIsAutoMode(prev => !prev);
    if (isAutoMode) {
      setAppState(AppState.IDLE);
    }
  };

  const handleManualScan = () => {
    if (!isAutoMode && appState === AppState.IDLE) {
        // Trigger a "fake" auto mode briefly to run the CameraFeed capture hook once
        // The hook will call onFrameCapture which now handles logic to freeze frame if needed
        setIsAutoMode(true);
        setTimeout(() => setIsAutoMode(false), 100); 
    }
  };

  const toggleCamera = () => {
    setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const toggleScreenShare = async () => {
    if (!isScreenShareSupported) {
        alert("Screen sharing is not supported on this device.");
        return;
    }

    if (screenStream) {
      // Stop screen share
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    } else {
      // Start screen share
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        setScreenStream(stream);
        
        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
        };
      } catch (err) {
        console.error("Error starting screen share:", err);
      }
    }
  };

  // File Upload Logic
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          const result = e.target?.result as string;
          if (result) {
              // Remove prefix to get raw base64
              const base64 = result.split(',')[1];
              setStaticImage(base64);
              setTranslationData(null); // Clear previous results
              setIsAutoMode(false);
              // Optionally trigger scan immediately? 
              // Let's let user tap scan button to confirm or review first.
          }
      };
      reader.readAsDataURL(file);
      // Reset input so same file can be selected again
      event.target.value = '';
  };

  const clearStaticImage = () => {
      setStaticImage(null);
      setTranslationData(null);
      setContentRect(null);
  };

  return (
    <div className="relative h-screen w-full bg-black flex flex-col overflow-hidden">
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        hidden 
        onChange={handleFileUpload}
      />

      {/* Header / Status Bar */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 flex justify-between items-start bg-gradient-to-b from-black/90 to-transparent pointer-events-none">
        <div>
          <h1 className="text-white font-bold text-lg tracking-tight flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full animate-pulse ${
                appState === AppState.ERROR ? 'bg-red-500' :
                useOfflineMode ? 'bg-green-500' : 
                screenStream ? 'bg-blue-500' : 'bg-red-600'
            }`}></span>
            JP <span className="text-gray-400 text-sm">to</span> KR
            {useOfflineMode && <span className="text-xs bg-green-900 text-green-300 px-1.5 py-0.5 rounded ml-1 font-normal">OFFLINE</span>}
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">
             {useOfflineMode ? 'Local Neural Engine' : screenStream ? 'Screen Translation' : staticImage ? 'Image Review' : 'Camera OCR'}
          </p>
        </div>
        <div className="pointer-events-auto flex gap-3">
             {/* Settings Button */}
             <button 
                onClick={() => setIsSettingsOpen(true)}
                className="bg-white/10 backdrop-blur-md p-2 rounded-full active:scale-95 transition-transform hover:bg-white/20 border border-white/10"
                title="Settings & History"
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.212 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
             </button>

             {/* Screen Share Toggle */}
             {isScreenShareSupported && !staticImage && (
                <button 
                    onClick={toggleScreenShare}
                    className={`p-2 rounded-full active:scale-95 transition-transform border ${screenStream ? 'bg-blue-600 border-blue-500' : 'bg-white/10 border-transparent backdrop-blur-md'}`}
                    title="Share Screen"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
                    </svg>
                </button>
             )}

             {/* Camera Flip Toggle (only show if not sharing screen and not static) */}
             {!screenStream && !staticImage && (
               <button 
                  onClick={toggleCamera}
                  className="bg-white/10 backdrop-blur-md p-2 rounded-full active:scale-95 transition-transform"
                  title="Flip Camera"
               >
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
               </button>
             )}

             {/* Close Static Image Button */}
             {staticImage && (
               <button 
                  onClick={clearStaticImage}
                  className="bg-white/10 backdrop-blur-md p-2 rounded-full active:scale-95 transition-transform hover:bg-red-500/50 border border-white/10"
                  title="Close Image"
               >
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                   </svg>
               </button>
             )}
        </div>
      </div>

      {/* Main View */}
      <div className="flex-1 relative">
        <ErrorBoundary onReset={() => {
            setAppState(AppState.IDLE);
            clearStaticImage();
        }}>
            <CameraFeed 
              isActive={isAutoMode} 
              onFrameCapture={handleFrameCapture}
              facingMode={cameraFacing}
              customStream={screenStream}
              staticImage={staticImage}
              onContentRectChange={setContentRect}
            />
            {/* Hide overlay if settings are open to clean up view */}
            {!isSettingsOpen && (
              <Overlay 
                data={translationData} 
                isScanning={appState === AppState.SCANNING}
                contentRect={contentRect}
                onSave={handleManualSave}
                textSizeMultiplier={textSizeMultiplier}
              />
            )}
        </ErrorBoundary>
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        history={history}
        onClearHistory={clearHistory}
        autoSave={autoSave}
        onToggleAutoSave={toggleAutoSave}
        packs={languagePacks}
        onUpdatePackStatus={updatePackStatus}
        useOfflineMode={useOfflineMode}
        onToggleOfflineMode={toggleOfflineMode}
        textSizeMultiplier={textSizeMultiplier}
        onSetTextSizeMultiplier={handleSetTextSize}
      />

      {/* Bottom Controls */}
      <div className="bg-black py-6 px-6 pb-8 z-30 flex items-center justify-between border-t border-gray-800">
        
        {/* Auto Mode Toggle */}
        <div className="flex flex-col items-center gap-1 w-14">
          <button 
            onClick={toggleAutoMode}
            disabled={!!staticImage}
            className={`w-12 h-8 rounded-full transition-colors relative ${isAutoMode ? 'bg-green-500' : 'bg-gray-700'} ${staticImage ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
             <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${isAutoMode ? 'left-5' : 'left-1'}`}></div>
          </button>
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Auto Scan</span>
        </div>

        {/* Main Trigger Button */}
        <button 
            onClick={handleManualScan}
            disabled={isAutoMode}
            className={`relative group rounded-full transition-all duration-300 ${isAutoMode ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
        >
             <div className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-transparent relative z-10">
                <div className="w-16 h-16 rounded-full bg-white group-hover:bg-gray-200 transition-colors"></div>
             </div>
             {!isAutoMode && (
                <div className="absolute -inset-2 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-full opacity-0 group-hover:opacity-20 blur-lg transition-opacity"></div>
             )}
        </button>

        {/* Gallery / Clear / Status Indicator */}
        <div className="flex flex-col items-center gap-1 w-14">
             {appState === AppState.ERROR ? (
                 <div className="flex flex-col items-center animate-pulse">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mb-0.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                     </svg>
                     <span className="text-[10px] text-red-500 font-bold">Retry</span>
                 </div>
             ) : staticImage || translationData ? (
                 <button 
                    onClick={() => {
                        setTranslationData(null);
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                 >
                    <span className="text-[10px] uppercase font-bold tracking-wider">Clear Text</span>
                 </button>
             ) : (
                 // Gallery Import Button
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full active:scale-95 transition-all"
                    title="Import Image"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                 </button>
             )}
             {!(appState === AppState.ERROR || staticImage || translationData) && (
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-1">Gallery</span>
             )}
        </div>

      </div>
    </div>
  );
};

export default App;
