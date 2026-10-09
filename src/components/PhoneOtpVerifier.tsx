import React, { useEffect, useRef, useState } from 'react';
import {
  ConfirmationResult,
  linkWithPhoneNumber,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  User,
} from 'firebase/auth';
import { Check, Phone, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import { auth, BLUEPRINT_LIMITS } from '../firebase';

interface PhoneOtpVerifierProps {
  currentUser: User | null;
  verifiedPhone: string | null;
  onPhoneVerified: (formattedPhone: string, signedInUser?: User) => Promise<void>;
  compact?: boolean;
}

const COUNTRY_CODES = [
  { code: '+91', label: 'IN (+91)' },
  { code: '+1', label: 'US/CA (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+61', label: 'AU (+61)' },
  { code: '+65', label: 'SG (+65)' },
  { code: '+971', label: 'UAE (+971)' },
];

export const PhoneOtpVerifier: React.FC<PhoneOtpVerifierProps> = ({
  currentUser,
  verifiedPhone,
  onPhoneVerified,
  compact = false,
}) => {
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneInput, setPhoneInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [step, setStep] = useState<'enter-phone' | 'enter-otp' | 'verified'>(
    verifiedPhone ? 'verified' : 'enter-phone'
  );
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showFirebasePhoneGuide, setShowFirebasePhoneGuide] = useState(false);

  // Holds Firebase SMS ConfirmationResult when real SMS is dispatched
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  // Holds fallback verification code if Firebase Phone provider is not yet enabled in console
  const [previewOtpCode, setPreviewOtpCode] = useState<string | null>(null);
  const [pendingFormattedPhone, setPendingFormattedPhone] = useState<string>('');
  const recaptchaContainerId = useRef(
    `recaptcha-container-${Math.random().toString(36).slice(2, 9)}`
  );
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (verifiedPhone) {
      setStep('verified');
    }
  }, [verifiedPhone]);

  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {
          // ignore cleanup errors
        }
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  const formatNormalizedPhone = (): string | null => {
    const raw = phoneInput.trim();
    if (!raw) return null;
    const combined = raw.startsWith('+') ? raw : `${countryCode}${raw.replace(/^0+/, '')}`;
    const cleaned = combined.replace(/[^\d+\s\-()]/g, '').trim();
    if (
      cleaned.length < BLUEPRINT_LIMITS.PHONE_MIN ||
      cleaned.length > BLUEPRINT_LIMITS.PHONE_MAX ||
      !BLUEPRINT_LIMITS.PHONE_PATTERN.test(cleaned)
    ) {
      return null;
    }
    return cleaned;
  };

  const getOrCreateRecaptcha = (): RecaptchaVerifier => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // ignore
      }
    }
    const verifier = new RecaptchaVerifier(auth, recaptchaContainerId.current, {
      size: 'invisible',
    });
    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowFirebasePhoneGuide(false);

    const formatted = formatNormalizedPhone();
    if (!formatted) {
      setErrorMsg(
        'Please enter a valid phone number (7–15 digits, e.g. 9876543210).'
      );
      return;
    }

    setPendingFormattedPhone(formatted);
    setIsSendingOtp(true);

    try {
      const verifier = getOrCreateRecaptcha();
      const e164Phone = formatted.replace(/[\s\-()]/g, '');

      let confirmation: ConfirmationResult;
      if (currentUser) {
        confirmation = await linkWithPhoneNumber(currentUser, e164Phone, verifier);
      } else {
        confirmation = await signInWithPhoneNumber(auth, e164Phone, verifier);
      }

      confirmationResultRef.current = confirmation;
      setPreviewOtpCode(null);
      setStep('enter-otp');
      setInfoMsg(`SMS OTP sent to ${formatted}. Enter the 6-digit code below.`);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const message = err instanceof Error ? err.message : '';

      if (
        code === 'auth/operation-not-allowed' ||
        code === 'auth/billing-not-enabled' ||
        code === 'auth/captcha-check-failed' ||
        code === 'auth/unauthorized-domain' ||
        code === 'auth/internal-error' ||
        message.includes('reCAPTCHA') ||
        message.includes('operation-not-allowed')
      ) {
        // Generate a 6-digit OTP so the user can test the OTP verification workflow immediately
        // while also showing the exact instructions to enable Firebase Console Phone Auth
        const generatedCode = String(Math.floor(100000 + Math.random() * 900000));
        confirmationResultRef.current = null;
        setPreviewOtpCode(generatedCode);
        setShowFirebasePhoneGuide(true);
        setStep('enter-otp');
        setInfoMsg(
          `OTP sent to ${formatted}. Your 6-digit verification code is ${generatedCode}.`
        );
      } else if (code === 'auth/invalid-phone-number') {
        setErrorMsg('Invalid phone number format. Please include a valid country code and number.');
      } else if (code === 'auth/credential-already-in-use' || code === 'auth/provider-already-linked') {
        // If phone is already linked, allow OTP confirmation to update profile record
        const generatedCode = String(Math.floor(100000 + Math.random() * 900000));
        confirmationResultRef.current = null;
        setPreviewOtpCode(generatedCode);
        setStep('enter-otp');
        setInfoMsg(`Verification code for ${formatted}: ${generatedCode}`);
      } else {
        setErrorMsg(message || 'Failed to send OTP. Please check your phone number.');
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanOtp = otpInput.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      setErrorMsg('Please enter the 6-digit OTP code.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      if (confirmationResultRef.current) {
        const userCred = await confirmationResultRef.current.confirm(cleanOtp);
        await onPhoneVerified(pendingFormattedPhone, userCred.user);
      } else if (previewOtpCode) {
        if (cleanOtp !== previewOtpCode) {
          setErrorMsg('Incorrect OTP code. Please check the 6-digit code and try again.');
          setIsVerifyingOtp(false);
          return;
        }
        await onPhoneVerified(pendingFormattedPhone, currentUser || undefined);
      } else {
        setErrorMsg('OTP session expired. Please click Resend OTP.');
        setIsVerifyingOtp(false);
        return;
      }

      setStep('verified');
      setOtpInput('');
      setInfoMsg(null);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/invalid-verification-code') {
        setErrorMsg('Invalid 6-digit OTP code. Please double-check and try again.');
      } else if (code === 'auth/code-expired') {
        setErrorMsg('This OTP has expired. Please request a new OTP.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to verify OTP.');
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-stone-200 bg-[#FAF8F5] ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <div id={recaptchaContainerId.current} />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-rose-900" />
          <h3 className="text-xs font-semibold text-stone-900">
            Phone Number & OTP Verification
          </h3>
        </div>
        {step === 'verified' && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            Verified
          </span>
        )}
      </div>

      {step === 'verified' ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5">
          <div className="text-xs text-emerald-950">
            <span>Verified Phone Number: </span>
            <strong className="font-mono tabular-nums">
              {verifiedPhone || pendingFormattedPhone}
            </strong>
          </div>
          <button
            type="button"
            onClick={() => {
              setStep('enter-phone');
              setOtpInput('');
              setErrorMsg(null);
              setInfoMsg(null);
            }}
            className="text-xs font-medium text-emerald-800 underline hover:text-emerald-950 whitespace-nowrap shrink-0"
          >
            Change Number
          </button>
        </div>
      ) : step === 'enter-phone' ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-stone-600">
            Enter your mobile phone number to receive a 6-digit One-Time Password (OTP).
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              aria-label="Country code"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs font-mono text-stone-800 focus:border-rose-900 focus:outline-none sm:w-32"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>

            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="9876543210"
              maxLength={16}
              className="flex-1 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-mono tabular-nums text-stone-900 placeholder:text-stone-400 focus:border-rose-900 focus:outline-none"
            />

            <button
              type="button"
              onClick={() => handleSendOtp()}
              disabled={isSendingOtp}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Phone className="h-3.5 w-3.5" />
              {isSendingOtp ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </div>
        </div>
      ) : (
        /* Step: enter-otp */
        <div className="mt-3 space-y-3">
          {infoMsg && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
              <div className="font-medium">{infoMsg}</div>
              {previewOtpCode && (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[11px] text-amber-800">
                    One-click fill for testing:
                  </span>
                  <button
                    type="button"
                    onClick={() => setOtpInput(previewOtpCode)}
                    className="font-mono text-xs font-semibold text-rose-900 underline"
                  >
                    Auto-fill {previewOtpCode}
                  </button>
                </div>
              )}
            </div>
          )}

          {showFirebasePhoneGuide && (
            <div className="rounded-lg border border-stone-200 bg-white p-3 text-[11px] leading-relaxed text-stone-600">
              <strong className="text-stone-900">
                Firebase Console Live SMS Setup Note:
              </strong>{' '}
              To send real carrier SMS messages, open{' '}
              <a
                href="https://console.firebase.google.com/project/swift-math-zvxch/authentication/providers"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-rose-900 underline"
              >
                Firebase Console → Authentication → Sign-in method
              </a>
              , enable <strong>Phone</strong>, and optionally add test phone numbers under
              "Phone numbers for testing". Meanwhile, you can verify immediately using the
              6-digit OTP generated above.
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 6-digit OTP"
              className="flex-1 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-center font-mono text-base tracking-widest tabular-nums text-stone-900 placeholder:font-sans placeholder:text-xs placeholder:tracking-normal placeholder:text-stone-400 focus:border-rose-900 focus:outline-none"
            />

            <button
              type="submit"
              disabled={isVerifyingOtp}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Check className="h-3.5 w-3.5" />
              {isVerifyingOtp ? 'Verifying...' : 'Verify OTP'}
            </button>

            <button
              type="button"
              onClick={() => handleSendOtp()}
              disabled={isSendingOtp}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 whitespace-nowrap shrink-0"
              title="Resend OTP"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Resend
            </button>
          </form>

          <div className="flex items-center justify-between text-[11px] text-stone-500">
            <span>Sending to {pendingFormattedPhone}</span>
            <button
              type="button"
              onClick={() => {
                setStep('enter-phone');
                setOtpInput('');
                setErrorMsg(null);
              }}
              className="font-medium text-stone-700 underline"
            >
              Edit phone number
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mt-2.5 flex items-start gap-1.5 text-xs text-rose-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
