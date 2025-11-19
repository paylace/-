import React, { useEffect, useRef, useState, useCallback } from 'react';

interface CameraFeedProps {
  isActive: boolean;
  onFrameCapture: (base64Image: string) => void;
  facingMode?: 'user' | 'environment';
  customStream?: MediaStream | null;
  staticImage?: string | null; // Base64 string of captured/uploaded image
  onContentRectChange?: (rect: { x: number, y: number, w: number, h: number }) => void;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({ 
  isActive, 
  onFrameCapture, 
  facingMode = 'environment',
  customStream = null,
  staticImage = null,
  onContentRectChange
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [internalStream, setInternalStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  // Determine which stream to use
  const activeStream = customStream || internalStream;

  const startCamera = useCallback(async () => {
    if (customStream || staticImage) return;

    // Check for secure context (required for camera)
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
       setError({
         title: "Insecure Context",
         message: "Camera access requires a secure (HTTPS) connection or localhost."
       });
       return;
    }

    try {
      setError(null);
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setInternalStream(mediaStream);
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      
      let title = "Camera Error";
      let message = "Could not access the camera.";

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        title = "Permission Denied";
        message = "Please allow camera access in your browser settings and try again.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        title = "No Camera Found";
        message = "No video input device was found on your system.";
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        title = "Camera In Use";
        message = "Your camera may be in use by another application.";
      }

      setError({ title, message });
    }
  }, [facingMode, customStream, staticImage]);

  // Initialize Internal Camera
  useEffect(() => {
    if (customStream || staticImage) {
      setInternalStream(null);
      setError(null);
      return;
    }

    startCamera();

    return () => {
      setInternalStream(prevStream => {
        if (prevStream) {
          prevStream.getTracks().forEach(track => track.stop());
        }
        return null;
      });
    };
  }, [customStream, staticImage, startCamera]);

  // Bind active stream to video element
  useEffect(() => {
    if (videoRef.current && activeStream && !staticImage) {
      videoRef.current.srcObject = activeStream;
      videoRef.current.play().catch(e => console.error("Error playing video:", e));
    }
  }, [activeStream, staticImage]);

  // Calculate and emit content rect (for Overlay alignment)
  const updateContentRect = useCallback(() => {
    if (!containerRef.current || !onContentRectChange) return;
    
    const container = containerRef.current;
    const cw = container.offsetWidth;
    const ch = container.offsetHeight;

    if (staticImage && imgRef.current) {
        // For Static Image (object-fit: contain)
        const img = imgRef.current;
        if (img.naturalWidth === 0) return;
        
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const containerAspect = cw / ch;
        
        let rw, rh, rx, ry;
        
        if (containerAspect > imgAspect) {
            // Container is wider than image -> Image matches height
            rh = ch;
            rw = ch * imgAspect;
            ry = 0;
            rx = (cw - rw) / 2;
        } else {
            // Container is taller than image -> Image matches width
            rw = cw;
            rh = cw / imgAspect;
            rx = 0;
            ry = (ch - rh) / 2;
        }
        onContentRectChange({ x: rx, y: ry, w: rw, h: rh });

    } else if (videoRef.current) {
        // For Video (object-fit: cover) - Content fills container
        // We treat the visible area as the "content"
        onContentRectChange({ x: 0, y: 0, w: cw, h: ch });
    }
  }, [staticImage, onContentRectChange]);

  // Listen for resize to update rect
  useEffect(() => {
    window.addEventListener('resize', updateContentRect);
    const interval = setInterval(updateContentRect, 1000); // periodic check
    return () => {
        window.removeEventListener('resize', updateContentRect);
        clearInterval(interval);
    }
  }, [updateContentRect]);

  // Capture Frame Logic
  const capture = useCallback(() => {
    // If we have a static image, just return it (or re-emit it)
    if (staticImage) {
        onFrameCapture(staticImage);
        return;
    }

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const cw = video.offsetWidth;
        const ch = video.offsetHeight;

        if (cw === 0 || ch === 0) return;

        // Calculate visible area (object-fit: cover simulation)
        const videoAspect = vw / vh;
        const containerAspect = cw / ch;

        let sx, sy, sw, sh;

        if (containerAspect > videoAspect) {
           sw = vw;
           sh = vw / containerAspect;
           sx = 0;
           sy = (vh - sh) / 2;
        } else {
           sh = vh;
           sw = vh * containerAspect;
           sx = (vw - sw) / 2;
           sy = 0;
        }

        canvas.width = sw;
        canvas.height = sh;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const base64Data = dataUrl.split(',')[1];
          onFrameCapture(base64Data);
        }
      }
    }
  }, [onFrameCapture, staticImage]);

  // Auto-capture interval
  useEffect(() => {
    let intervalId: number;
    // Only auto-capture if active, no error, stream exists, and NOT in static mode
    if (isActive && !error && activeStream && !staticImage) {
      capture(); 
      intervalId = window.setInterval(capture, 3000);
    }
    return () => {
      clearInterval(intervalId);
    };
  }, [isActive, capture, error, activeStream, staticImage]);

  // Initial update of rect when static image loads
  const handleImageLoad = () => {
      updateContentRect();
  };

  if (error && !customStream && !staticImage) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-gray-900 text-center p-6">
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 max-w-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-bold text-white mb-2">{error.title}</h3>
          <p className="text-gray-400 text-sm mb-4">{error.message}</p>
          <button 
            onClick={startCamera}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors"
          >
            Retry Camera
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center">
      {staticImage ? (
          // Static Image Mode (Contain)
          <img 
            ref={imgRef}
            src={`data:image/jpeg;base64,${staticImage}`}
            alt="Captured"
            className="max-w-full max-h-full object-contain"
            onLoad={handleImageLoad}
          />
      ) : (
          // Live Camera Mode (Cover)
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onResize={updateContentRect}
            onLoadedMetadata={updateContentRect}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: (facingMode === 'user' && !customStream) ? 'scaleX(-1)' : 'none' }}
          />
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};