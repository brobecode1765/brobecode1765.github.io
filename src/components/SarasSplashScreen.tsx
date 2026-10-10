import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import sarasLogoImg from '../assets/images/saras_brand_logo_1791632744713.jpg';

interface SarasSplashScreenProps {
  onFinish: () => void;
}

export const SarasSplashScreen: React.FC<SarasSplashScreenProps> = ({ onFinish }) => {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const duration = 2600; // 2.6 seconds Blinkit-style fast launch

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      if (pct >= 100) {
        window.clearInterval(interval);
        setIsExiting(true);
        window.setTimeout(() => {
          onFinish();
        }, 320);
      }
    }, 30);

    return () => window.clearInterval(interval);
  }, [onFinish]);

  const handleSkipNow = () => {
    setIsExiting(true);
    window.setTimeout(() => {
      onFinish();
    }, 200);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex min-h-screen w-full flex-col items-center justify-between overflow-hidden bg-gradient-to-br from-[#260736] via-[#3E1057] to-[#1A0426] px-6 py-10 text-white transition-opacity duration-300 ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Decorative Ambient Color Glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -left-28 h-96 w-96 rounded-full bg-amber-400/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -bottom-28 h-96 w-96 rounded-full bg-purple-500/25 blur-3xl"
      />

      {/* Top Tagline Bar */}
      <div className="relative z-10 flex items-center gap-2 text-xs font-medium tracking-wider text-amber-300/90 uppercase">
        <span>India&apos;s Old Book Community</span>
        <span aria-hidden="true">·</span>
        <span>3-Side Verified Archive</span>
      </div>

      {/* Centerpiece: SARAS Circular Brand Emblem + Name (Blinkit-style hero launch) */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-md mx-auto my-auto">
        <div className="relative mb-6 flex items-center justify-center">
          {/* Outer warm golden pulse ring */}
          <div
            aria-hidden="true"
            className="absolute -inset-3 rounded-full bg-gradient-to-tr from-amber-400/40 via-purple-400/30 to-amber-300/40 blur-md"
          />

          <div className="relative h-52 w-52 sm:h-60 sm:w-60 overflow-hidden rounded-full border-4 border-[#B388FF] bg-[#380E4E] shadow-[0_0_60px_rgba(250,204,21,0.35)]">
            {!logoError ? (
              <img
                src={sarasLogoImg}
                alt="SARAS — Buy, Sell, Share Books Logo"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
                <BookOpen className="h-14 w-14 text-amber-400 mb-2" />
                <span className="font-serif text-3xl font-bold tracking-wide text-white">
                  SARAS
                </span>
                <span className="mt-1 text-xs text-amber-300">
                  Buy · Sell · Share Books
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bold Brand Name & Tagline */}
        <h1 className="font-serif text-5xl sm:text-6xl font-bold tracking-wider text-white drop-shadow-sm">
          SAR<span className="text-amber-400">A</span>S
        </h1>

        <div className="mt-3 flex items-center justify-center gap-3 text-base sm:text-lg font-semibold tracking-wide text-amber-300">
          <span>Buy</span>
          <span aria-hidden="true" className="text-amber-400">
            •
          </span>
          <span>Sell</span>
          <span aria-hidden="true" className="text-amber-400">
            •
          </span>
          <span>Share Books</span>
        </div>

        <p className="mt-3 max-w-xs text-xs sm:text-sm leading-relaxed text-purple-200/90">
          Inspect old books from all 3 sides, set your exact location, and get doorstep
          delivery.
        </p>
      </div>

      {/* Bottom Blinkit-Style Fast Loading Bar & Instant Enter Button */}
      <div className="relative z-10 w-full max-w-sm space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-purple-200">
            <span>Opening SARAS Book Marketplace...</span>
            <span className="font-mono font-bold tabular-nums text-amber-300">
              {progress}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-purple-950/90 p-0.5 ring-1 ring-purple-400/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleSkipNow}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 text-xs font-bold text-[#2A083B] shadow-md transition-colors hover:bg-amber-300 whitespace-nowrap shrink-0"
          >
            Enter SARAS Store Now
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
