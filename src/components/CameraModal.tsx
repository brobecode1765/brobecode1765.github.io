import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X, Check, AlertCircle, Upload } from 'lucide-react';
import { captureVideoFrameToDataUrl, compressImageFileToDataUrl } from '../utils/imageCompression';

export type BookSideKey = 'frontPhoto' | 'spinePhoto' | 'backPhoto';

export interface BookSideMeta {
  key: BookSideKey;
  stepNumber: string;
  label: string;
  shortLabel: string;
  instruction: string;
}

export const BOOK_SIDES: BookSideMeta[] = [
  {
    key: 'frontPhoto',
    stepNumber: '01',
    label: 'Side 1 · Front Cover',
    shortLabel: 'Front Cover',
    instruction: 'Center the front cover flat within the frame so the title and artwork are clearly visible.',
  },
  {
    key: 'spinePhoto',
    stepNumber: '02',
    label: 'Side 2 · Book Spine',
    shortLabel: 'Spine / Edge',
    instruction: 'Hold the book sideways so the vertical spine binding, ribs, and lettering are in focus.',
  },
  {
    key: 'backPhoto',
    stepNumber: '03',
    label: 'Side 3 · Back Cover',
    shortLabel: 'Back Cover',
    instruction: 'Flip the book over to photograph the full back cover and binding corners.',
  },
];

interface CameraModalProps {
  isOpen: boolean;
  initialSide: BookSideKey;
  photos: Record<BookSideKey, string>;
  onCaptureSide: (side: BookSideKey, dataUrl: string) => void;
  onClose: () => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  initialSide,
  photos,
  onCaptureSide,
  onClose,
}) => {
  const [activeSide, setActiveSide] = useState<BookSideKey>(initialSide);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [justCapturedSide, setJustCapturedSide] = useState<BookSideKey | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setActiveSide(initialSide);
  }, [initialSide]);

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      return;
    }

    let cancelled = false;

    async function startCamera() {
      setCameraError(null);
      setIsStreamReady(false);
      stopStream();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Live camera API is not supported in this browser window. Use the "Upload / Snap File" button below to select a photo.'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setIsStreamReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            err instanceof Error
              ? `Camera access unavailable (${err.message}). You can still upload a photo directly below.`
              : 'Could not access camera. Please allow camera permission or upload an image file below.'
          );
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [isOpen, facingMode]);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsStreamReady(false);
  }

  if (!isOpen) return null;

  const currentSideMeta = BOOK_SIDES.find((s) => s.key === activeSide) || BOOK_SIDES[0];
  const capturedCount = BOOK_SIDES.filter((s) => Boolean(photos[s.key])).length;

  const advanceToNextUncaptured = (justSavedSide: BookSideKey) => {
    const updatedState = { ...photos, [justSavedSide]: 'captured' };
    const nextMissing = BOOK_SIDES.find((s) => !updatedState[s.key]);
    if (nextMissing) {
      setActiveSide(nextMissing.key);
    }
  };

  const handleCaptureClick = () => {
    if (!videoRef.current || !isStreamReady) return;
    try {
      const dataUrl = captureVideoFrameToDataUrl(videoRef.current);
      onCaptureSide(activeSide, dataUrl);
      setJustCapturedSide(activeSide);
      setTimeout(() => setJustCapturedSide(null), 900);
      advanceToNextUncaptured(activeSide);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Failed to capture photo.');
    }
  };

  const handleFallbackFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      onCaptureSide(activeSide, dataUrl);
      setJustCapturedSide(activeSide);
      setTimeout(() => setJustCapturedSide(null), 900);
      advanceToNextUncaptured(activeSide);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Failed to process selected image.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-stone-800 bg-stone-900 text-stone-100 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-800 px-6 py-4">
          <div>
            <h2 id="camera-modal-title" className="font-serif text-lg font-semibold text-stone-100">
              3-Side Book Camera Studio
            </h2>
            <p className="text-xs text-stone-400">
              Captured <span className="font-mono tabular-nums">{capturedCount}/3</span> required sides
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-800 hover:text-white"
            aria-label="Close camera studio"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 3-Side Selector Bar */}
        <div className="grid grid-cols-3 gap-2 border-b border-stone-800 bg-stone-950/50 p-3">
          {BOOK_SIDES.map((side) => {
            const isSelected = side.key === activeSide;
            const hasPhoto = Boolean(photos[side.key]);
            return (
              <button
                key={side.key}
                type="button"
                onClick={() => setActiveSide(side.key)}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-rose-900 text-white'
                    : hasPhoto
                    ? 'bg-stone-800/90 text-stone-200 hover:bg-stone-800'
                    : 'bg-stone-900 text-stone-400 hover:bg-stone-800/60 hover:text-stone-200'
                }`}
              >
                <span className="truncate">
                  {side.stepNumber}. {side.shortLabel}
                </span>
                {hasPhoto && (
                  <Check className="ml-1.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Viewfinder Area */}
        <div className="relative aspect-4/3 w-full bg-stone-950">
          {!cameraError ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {/* Framing Guide Overlay */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6">
                <div
                  className={`border-2 border-dashed border-amber-200/70 transition-opacity ${
                    activeSide === 'spinePhoto'
                      ? 'h-4/5 w-24 rounded-md'
                      : 'h-4/5 w-3/5 max-w-xs rounded-md'
                  }`}
                />
                <div className="mt-3 rounded bg-stone-950/80 px-3 py-1.5 text-center text-xs text-stone-200">
                  {currentSideMeta.label}: {currentSideMeta.instruction}
                </div>
              </div>

              {justCapturedSide && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/20">
                  <div className="rounded-lg bg-stone-950/90 px-4 py-2 text-sm font-medium text-emerald-300">
                    Photo saved for { currentSideMeta.shortLabel }
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <AlertCircle className="mb-3 h-10 w-10 text-amber-400" />
              <p className="max-w-md text-sm text-stone-300">{cameraError}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-700"
              >
                <Upload className="h-4 w-4" />
                Select Photo for {currentSideMeta.shortLabel}
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFallbackFileChange}
            className="hidden"
          />
        </div>

        {/* Camera Controls & 3-Side Thumbnails Footer */}
        <div className="flex flex-col gap-4 border-t border-stone-800 bg-stone-900 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Mini preview of all 3 sides */}
          <div className="flex items-center gap-3">
            {BOOK_SIDES.map((side) => {
              const imgData = photos[side.key];
              return (
                <button
                  key={side.key}
                  type="button"
                  onClick={() => setActiveSide(side.key)}
                  className={`relative h-14 w-12 overflow-hidden rounded border text-left transition-transform ${
                    activeSide === side.key
                      ? 'border-rose-500 ring-2 ring-rose-500/40'
                      : 'border-stone-700 opacity-80 hover:opacity-100'
                  }`}
                  title={side.label}
                >
                  {imgData ? (
                    <img
                      src={imgData}
                      alt={side.label}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-stone-800 text-[10px] font-mono text-stone-400">
                      {side.stepNumber}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Shutter & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {!cameraError && (
              <button
                type="button"
                onClick={() =>
                  setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-xs font-medium text-stone-200 transition-colors hover:bg-stone-700 whitespace-nowrap shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Flip Camera
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-xs font-medium text-stone-200 transition-colors hover:bg-stone-700 whitespace-nowrap shrink-0"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload File
            </button>

            {!cameraError && (
              <button
                type="button"
                onClick={handleCaptureClick}
                disabled={!isStreamReady}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Camera className="h-4 w-4" />
                Click {currentSideMeta.shortLabel} Photo
              </button>
            )}

            {capturedCount === 3 && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 whitespace-nowrap shrink-0"
              >
                <Check className="h-4 w-4" />
                Done (3/3)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
