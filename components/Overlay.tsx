
import React, { useState, useEffect, useCallback } from 'react';
import { TranslationResult } from '../types';

interface OverlayProps {
  data: TranslationResult | null;
  isScanning: boolean;
  contentRect?: { x: number, y: number, w: number, h: number } | null;
  onSave: () => void;
  textSizeMultiplier?: number;
}

export const Overlay: React.FC<OverlayProps> = ({ data, isScanning, contentRect, onSave, textSizeMultiplier = 1.0 }) => {
  const [showSummary, setShowSummary] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Reset summary visibility when new data arrives
  useEffect(() => {
    if (data) {
      setShowSummary(false);
    }
  }, [data]);

  const handleCopy = useCallback(async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setToastMsg("Copied!");
      setTimeout(() => setToastMsg(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);

  const handleSave = useCallback(() => {
    onSave();
    setToastMsg("Saved to History!");
    setTimeout(() => setToastMsg(null), 2000);
  }, [onSave]);

  // Helper to calculate dynamic font size
  const getFontSize = (box: number[], text: string, rectH: number) => {
    const [ymin, xmin, ymax, xmax] = box;
    
    // Calculate box dimensions relative to the content rect height
    // ymin/ymax are 0-1000 relative to rectH
    const h_px = ((ymax - ymin) / 1000) * rectH;
    const w_px = ((xmax - xmin) / 1000) * (contentRect ? contentRect.w : rectH); // approx width
    
    const len = text.length || 1;

    // Constraint 1: Height. 
    const maxH = h_px * 0.55;

    // Constraint 2: Area based
    const area = w_px * h_px;
    const densitySize = Math.sqrt(area / len) * 1.2; // Adjusted factor for px

    let size = Math.min(maxH, densitySize);
    
    // Apply user Multiplier
    size = size * textSizeMultiplier;

    // Clamp between 10px and 42px (increased max for high visibility)
    return `${Math.max(10, Math.min(size, 42))}px`;
  };

  if (!data && !isScanning) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full text-sm font-medium shadow-xl animate-pulse">
          {toastMsg}
        </div>
      )}

      {/* Loading State */}
      {isScanning && !data && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm transition-opacity">
          <div className="flex flex-col items-center">
            <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2 shadow-lg"></div>
            <span className="text-blue-400 font-semibold shadow-black drop-shadow-md bg-black/50 px-3 py-1 rounded-full text-sm">Analyzing...</span>
          </div>
        </div>
      )}

      {/* Results Overlay */}
      {data && (
        <>
          {/* Bounding Boxes Layer */}
          <div className="absolute inset-0 overflow-hidden">
            {data.items.map((item, index) => {
               // Safeguard for missing box data
               if (!item.box_2d || item.box_2d.length < 4) return null;

               const [ymin, xmin, ymax, xmax] = item.box_2d;
               
               let top, left, width, height;

               if (contentRect) {
                 // Map 0-1000 to contentRect pixels
                 top = contentRect.y + (ymin / 1000) * contentRect.h;
                 left = contentRect.x + (xmin / 1000) * contentRect.w;
                 height = ((ymax - ymin) / 1000) * contentRect.h;
                 width = ((xmax - xmin) / 1000) * contentRect.w;
               } else {
                 // Fallback to viewport %
                 top = ymin / 10 + '%';
                 left = xmin / 10 + '%';
                 height = (ymax - ymin) / 10 + '%';
                 width = (xmax - xmin) / 10 + '%';
               }

               return (
                 <div
                   key={index}
                   onClick={(e) => {
                     e.stopPropagation();
                     handleCopy(item.translated);
                   }}
                   className="absolute z-20 flex items-center justify-center bg-slate-900/85 backdrop-blur-[2px] rounded-sm shadow-sm border border-white/10 transition-all duration-200 pointer-events-auto hover:z-50 hover:scale-105 hover:bg-slate-800 overflow-hidden group cursor-pointer active:scale-95"
                   style={{
                     top: typeof top === 'number' ? `${top}px` : top,
                     left: typeof left === 'number' ? `${left}px` : left,
                     width: typeof width === 'number' ? `${width}px` : width,
                     height: typeof height === 'number' ? `${height}px` : height,
                   }}
                   title="Click to copy"
                 >
                   {/* Translated Text - In-place AR Style */}
                   <span 
                     className="text-white font-medium text-center leading-tight break-keep w-full flex items-center justify-center flex-wrap px-0.5 pointer-events-none"
                     style={{
                        fontSize: getFontSize(item.box_2d, item.translated, contentRect ? contentRect.h : window.innerHeight)
                     }}
                   >
                      {item.translated}
                   </span>
                 </div>
               );
            })}
          </div>

          {/* Bottom Controls (Summary Toggle) */}
          <div className="absolute bottom-24 left-0 right-0 flex flex-col items-center pointer-events-none">
            <div className="pointer-events-auto mb-4 z-40">
                {showSummary ? (
                    <div className="w-[90vw] max-w-md bg-black/85 backdrop-blur-xl border border-gray-600 rounded-2xl p-5 shadow-2xl animate-fade-in-up">
                        <div className="flex justify-between items-start mb-3">
                            <h3 className="text-gray-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                Summary
                            </h3>
                            <div className="flex items-center gap-2">
                              {/* Save Button (In Card) */}
                              <button
                                onClick={handleSave}
                                className="text-gray-400 hover:text-green-400 p-1 rounded-md hover:bg-white/10 active:scale-95 transition-colors"
                                title="Save to History"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                              </button>
                              {/* Copy Button */}
                              <button
                                onClick={() => handleCopy(data.summary)}
                                className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/10 active:scale-95 transition-colors"
                                title="Copy Summary"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                              {/* Close Summary */}
                              <button 
                                  onClick={() => setShowSummary(false)} 
                                  className="text-gray-400 hover:text-white p-1 -mr-1 active:scale-95"
                              >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                        </div>
                        <p className="text-white text-base leading-relaxed font-medium">
                            {data.summary}
                        </p>
                    </div>
                ) : (
                    data.summary && (
                       <div className="flex gap-2">
                           {/* Save Button (Collapsed) */}
                           <button
                              onClick={handleSave}
                              className="bg-gray-900/90 hover:bg-gray-800 text-white p-2.5 rounded-full border border-gray-700 shadow-lg transition-all active:scale-95 group"
                              title="Save to History"
                           >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300 group-hover:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                              </svg>
                           </button>
                           {/* View Summary Button */}
                           <button 
                              onClick={() => setShowSummary(true)}
                              className="flex items-center gap-2 bg-gray-900/90 hover:bg-gray-800 text-white px-5 py-2.5 rounded-full border border-gray-700 shadow-lg transition-all active:scale-95 group"
                           >
                              <svg className="w-4 h-4 text-blue-400 group-hover:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              <span className="text-sm font-semibold tracking-wide">View Summary</span>
                           </button>
                       </div>
                    )
                )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
