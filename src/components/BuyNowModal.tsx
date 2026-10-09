import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Navigation,
  Phone,
  ShoppingBag,
  X,
  Check,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { BLUEPRINT_LIMITS } from '../firebase';
import { BookRecord } from './BookInspectModal';
import { PhoneOtpVerifier } from './PhoneOtpVerifier';

export interface OrderSubmissionPayload {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  sellerName: string;
  customerName: string;
  customerPhone: string;
  exactLocation: string;
  fullAddress: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
}

interface BuyNowModalProps {
  book: BookRecord | null;
  currentUser: User | null;
  defaultCustomerName: string;
  verifiedPhone: string | null;
  onPhoneVerified: (formattedPhone: string, signedInUser?: User) => Promise<void>;
  onSubmitOrder: (payload: OrderSubmissionPayload) => Promise<string>;
  onClose: () => void;
}

const INDIAN_STATES_AND_UTS = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi (NCT)',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Other / International',
];

export const BuyNowModal: React.FC<BuyNowModalProps> = ({
  book,
  currentUser,
  defaultCustomerName,
  verifiedPhone,
  onPhoneVerified,
  onSubmitOrder,
  onClose,
}) => {
  // Step 1: Exact Location State (FIRST OF ALL when Buy Now is clicked)
  const [exactLocation, setExactLocation] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationStatusMsg, setLocationStatusMsg] = useState<string | null>(null);

  // Step 2: Shiprocket Delivery Address, State & Sender Phone Number
  const [customerName, setCustomerName] = useState(defaultCustomerName);
  const [customerPhone, setCustomerPhone] = useState(verifiedPhone || '');
  const [fullAddress, setFullAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');

  // Submission & Confirmation state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);

  useEffect(() => {
    setCustomerName(defaultCustomerName);
  }, [defaultCustomerName]);

  useEffect(() => {
    if (verifiedPhone) {
      setCustomerPhone(verifiedPhone);
    }
  }, [verifiedPhone]);

  useEffect(() => {
    // Reset confirmation state when opening for a new book
    setConfirmedOrderId(null);
    setErrorMsg(null);
  }, [book?.id]);

  if (!book) return null;

  const handleDetectExactLocation = () => {
    setErrorMsg(null);
    setLocationStatusMsg(null);

    if (!navigator.geolocation) {
      setErrorMsg(
        'Geolocation is not supported by this browser. Please type your exact location below.'
      );
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setGpsCoords({ lat, lng });

        const coordString = `GPS: ${lat}, ${lng}`;
        setExactLocation(coordString);

        // Attempt reverse geocoding via OpenStreetMap Nominatim to pre-fill State, City, PIN, and Exact Locality
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            {
              headers: {
                Accept: 'application/json',
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            const addr = data?.address || {};
            const displayName = typeof data?.display_name === 'string' ? data.display_name : '';

            const detectedState =
              addr.state || addr.state_district || addr.region || '';
            const detectedCity =
              addr.city || addr.town || addr.village || addr.county || addr.suburb || '';
            const detectedPin = addr.postcode || '';
            const roadPart = [
              addr.house_number,
              addr.road,
              addr.neighbourhood,
              addr.suburb,
            ]
              .filter(Boolean)
              .join(', ');

            const fullExact = displayName
              ? `${coordString} · ${displayName}`.slice(
                  0,
                  BLUEPRINT_LIMITS.ORDER_EXACT_LOCATION_MAX
                )
              : coordString;

            setExactLocation(fullExact);
            if (roadPart && !fullAddress) {
              setFullAddress(roadPart.slice(0, BLUEPRINT_LIMITS.ORDER_ADDRESS_MAX));
            }
            if (detectedCity && !city) {
              setCity(String(detectedCity).slice(0, BLUEPRINT_LIMITS.ORDER_CITY_MAX));
            }
            if (detectedState) {
              // Match with state list if possible, otherwise set directly
              const matched = INDIAN_STATES_AND_UTS.find((s) =>
                s.toLowerCase().includes(String(detectedState).toLowerCase())
              );
              setStateName(
                (matched || String(detectedState)).slice(
                  0,
                  BLUEPRINT_LIMITS.ORDER_STATE_MAX
                )
              );
            }
            if (detectedPin && !pincode) {
              setPincode(
                String(detectedPin)
                  .replace(/[^0-9A-Za-z\s\-]/g, '')
                  .slice(0, BLUEPRINT_LIMITS.ORDER_PINCODE_MAX)
              );
            }
            setLocationStatusMsg(
              'Exact GPS coordinates and address details detected automatically.'
            );
          } else {
            setLocationStatusMsg('Exact GPS coordinates captured.');
          }
        } catch {
          setLocationStatusMsg('Exact GPS coordinates captured.');
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (err) => {
        setIsDetectingLocation(false);
        setErrorMsg(
          `Could not auto-detect GPS (${err.message}). Please type your exact location and area in Step 1 below.`
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanExactLocation = exactLocation
      .trim()
      .slice(0, BLUEPRINT_LIMITS.ORDER_EXACT_LOCATION_MAX);
    const cleanName = customerName.trim().slice(0, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX);
    const cleanPhone = (verifiedPhone || customerPhone)
      .trim()
      .replace(/[^\d+\s\-()]/g, '')
      .slice(0, BLUEPRINT_LIMITS.PHONE_MAX);
    const cleanAddress = fullAddress
      .trim()
      .slice(0, BLUEPRINT_LIMITS.ORDER_ADDRESS_MAX);
    const cleanLandmark = landmark
      .trim()
      .slice(0, BLUEPRINT_LIMITS.ORDER_LANDMARK_MAX);
    const cleanCity = city.trim().slice(0, BLUEPRINT_LIMITS.ORDER_CITY_MAX);
    const cleanState = stateName.trim().slice(0, BLUEPRINT_LIMITS.ORDER_STATE_MAX);
    const cleanPincode = pincode
      .trim()
      .replace(/[^0-9A-Za-z\s\-]/g, '')
      .slice(0, BLUEPRINT_LIMITS.ORDER_PINCODE_MAX);

    if (cleanExactLocation.length < BLUEPRINT_LIMITS.ORDER_EXACT_LOCATION_MIN) {
      setErrorMsg(
        'Step 1 Required: Please click "Detect My Exact Location (GPS)" or enter your exact location first.'
      );
      return;
    }

    if (
      cleanPhone.length < BLUEPRINT_LIMITS.PHONE_MIN ||
      !BLUEPRINT_LIMITS.PHONE_PATTERN.test(cleanPhone)
    ) {
      setErrorMsg(
        'Please enter a valid mobile phone number (7–15 digits) so your order number is recorded.'
      );
      return;
    }

    if (cleanName.length < 1) {
      setErrorMsg('Please enter the recipient full name.');
      return;
    }

    if (cleanAddress.length < BLUEPRINT_LIMITS.ORDER_ADDRESS_MIN) {
      setErrorMsg(
        'Please enter your complete street/house delivery address (at least 5 characters) for Shiprocket.'
      );
      return;
    }

    if (cleanCity.length < BLUEPRINT_LIMITS.ORDER_CITY_MIN) {
      setErrorMsg('Please enter your City / District.');
      return;
    }

    if (cleanState.length < BLUEPRINT_LIMITS.ORDER_STATE_MIN) {
      setErrorMsg('Please select or enter your State for Shiprocket delivery.');
      return;
    }

    if (
      cleanPincode.length < BLUEPRINT_LIMITS.ORDER_PINCODE_MIN ||
      !BLUEPRINT_LIMITS.ORDER_PINCODE_PATTERN.test(cleanPincode)
    ) {
      setErrorMsg('Please enter a valid PIN / Postal Code (e.g., 110001).');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderId = await onSubmitOrder({
        bookId: book.id,
        bookTitle: book.title,
        bookAuthor: book.author,
        sellerName: book.ownerName,
        customerName: cleanName,
        customerPhone: cleanPhone,
        exactLocation: cleanExactLocation,
        fullAddress: cleanAddress,
        landmark: cleanLandmark,
        city: cleanCity,
        state: cleanState,
        pincode: cleanPincode,
      });
      setConfirmedOrderId(orderId);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not place order. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="buy-now-modal-title"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-stone-200 bg-[#FAF8F5] text-stone-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-rose-900" />
            <div>
              <h2
                id="buy-now-modal-title"
                className="font-serif text-lg font-semibold text-stone-900"
              >
                Buy Now — Exact Location & Delivery Checkout
              </h2>
              <p className="text-xs text-stone-500">
                {book.title} · By {book.author}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
            aria-label="Close Buy Now modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {confirmedOrderId ? (
          /* Order Confirmation State */
          <div className="space-y-6 p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
              <Check className="h-6 w-6" />
            </div>

            <div className="space-y-2">
              <div className="font-mono text-xs text-emerald-800">
                ORDER ID #{confirmedOrderId.slice(0, 8).toUpperCase()} CONFIRMED
              </div>
              <h3 className="font-serif text-2xl font-semibold text-stone-900">
                Your Book Order Has Been Placed
              </h3>
              <p className="mx-auto max-w-md text-sm text-stone-600">
                Your exact location, state, delivery address, and phone number have been
                sent to the SARAS dispatch desk for Shiprocket courier delivery.
              </p>
            </div>

            <div className="mx-auto max-w-md rounded-xl border border-stone-200 bg-white p-5 text-left text-xs space-y-2">
              <div className="flex justify-between border-b border-stone-100 pb-2">
                <span className="text-stone-500">Book Ordered</span>
                <span className="font-semibold text-stone-900">{book.title}</span>
              </div>
              <div className="flex justify-between border-b border-stone-100 pb-2">
                <span className="text-stone-500">Sent From Phone</span>
                <span className="font-mono font-semibold tabular-nums text-stone-900">
                  {verifiedPhone || customerPhone}
                </span>
              </div>
              <div className="flex justify-between border-b border-stone-100 pb-2">
                <span className="text-stone-500">State & PIN</span>
                <span className="font-medium text-stone-900">
                  {stateName} — <span className="font-mono tabular-nums">{pincode}</span>
                </span>
              </div>
              <div>
                <span className="text-stone-500 block">Exact Location & Address</span>
                <span className="mt-0.5 block font-medium text-stone-800">
                  {exactLocation}
                </span>
                <span className="mt-0.5 block text-stone-600">
                  {fullAddress}, {city}, {stateName} - {pincode}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-stone-900 px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-stone-800 whitespace-nowrap shrink-0"
            >
              Return to SARAS Catalog
            </button>
          </div>
        ) : (
          /* Checkout Form: Step 1 Exact Location -> Step 2 Phone & Shiprocket Address */
          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            {/* Book Summary Bar */}
            <div className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-3.5">
              <img
                src={book.frontPhoto}
                alt={book.title}
                referrerPolicy="no-referrer"
                className="h-16 w-14 rounded object-cover border border-stone-200 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-stone-500">
                  Added by {book.ownerName} · 3-Side Verified Book
                </div>
                <div className="truncate font-serif text-base font-semibold text-stone-900">
                  {book.title}
                </div>
                <div className="truncate text-xs text-stone-600">Author: {book.author}</div>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-800" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* ==============================================================
               STEP 01 (FIRST OF ALL): EXACT LOCATION OPTION
               ============================================================== */}
            <div className="rounded-xl border border-rose-900/25 bg-white p-5 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="font-mono text-[11px] font-semibold text-rose-900">
                    STEP 01 · FIRST REQUIRED STEP
                  </span>
                  <h3 className="font-serif text-base font-semibold text-stone-900">
                    01. Set Your Exact Location First
                  </h3>
                  <p className="text-xs text-stone-600">
                    Click to detect your exact GPS coordinates & locality, or enter your exact
                    drop-pin location below.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDetectExactLocation}
                  disabled={isDetectingLocation}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-rose-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Navigation className="h-4 w-4" />
                  {isDetectingLocation
                    ? 'Detecting Exact GPS...'
                    : 'Detect My Exact Location (GPS)'}
                </button>
              </div>

              {locationStatusMsg && (
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900">
                  <span className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-700" />
                    {locationStatusMsg}
                  </span>
                  {gpsCoords && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${gpsCoords.lat}&mlon=${gpsCoords.lng}#map=17/${gpsCoords.lat}/${gpsCoords.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-emerald-800 underline"
                    >
                      View Map Pin
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}

              <div>
                <label
                  htmlFor="exact-location-input"
                  className="block text-xs font-semibold text-stone-800"
                >
                  Exact Location (GPS Coordinates / Exact Locality Pinpoint) *
                </label>
                <div className="relative mt-1.5">
                  <MapPin className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-rose-900" />
                  <input
                    id="exact-location-input"
                    type="text"
                    required
                    maxLength={BLUEPRINT_LIMITS.ORDER_EXACT_LOCATION_MAX}
                    value={exactLocation}
                    onChange={(e) => setExactLocation(e.target.value)}
                    placeholder="Click 'Detect My Exact Location (GPS)' or type exact location / coordinates"
                    className="w-full rounded-lg border border-stone-300 bg-[#FAF8F5] py-2 pr-3.5 pl-9 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* ==============================================================
               STEP 02: PHONE NUMBER FROM WHICH ORDER IS SENT
               ============================================================== */}
            <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
              <div>
                <h3 className="font-serif text-base font-semibold text-stone-900">
                  02. Phone Number (Order Contact & OTP Verification)
                </h3>
                <p className="text-xs text-stone-600">
                  This phone number is recorded with your order for Shiprocket delivery updates.
                </p>
              </div>

              <PhoneOtpVerifier
                currentUser={currentUser}
                verifiedPhone={verifiedPhone}
                onPhoneVerified={async (phone, u) => {
                  setCustomerPhone(phone);
                  await onPhoneVerified(phone, u);
                }}
                compact
              />

              <div>
                <label
                  htmlFor="order-phone-input"
                  className="block text-xs font-semibold text-stone-700"
                >
                  Active Delivery Phone Number *
                </label>
                <div className="relative mt-1.5">
                  <Phone className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-stone-400" />
                  <input
                    id="order-phone-input"
                    type="tel"
                    required
                    maxLength={BLUEPRINT_LIMITS.PHONE_MAX}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full rounded-lg border border-stone-300 bg-[#FAF8F5] py-2 pr-3.5 pl-9 font-mono text-sm tabular-nums text-stone-900 placeholder:font-sans placeholder:text-stone-400 focus:border-rose-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* ==============================================================
               STEP 03: SHIPROCKET DELIVERY ADDRESS & STATE
               ============================================================== */}
            <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
              <div>
                <h3 className="font-serif text-base font-semibold text-stone-900">
                  03. Delivery Address & State (For Shiprocket Courier)
                </h3>
                <p className="text-xs text-stone-600">
                  Complete house/street address, city, state, and PIN code for courier dispatch.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="order-customer-name"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    Recipient Full Name *
                  </label>
                  <input
                    id="order-customer-name"
                    type="text"
                    required
                    maxLength={BLUEPRINT_LIMITS.DISPLAY_NAME_MAX}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Full Name for Delivery Label"
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-[#FAF8F5] px-3.5 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-900 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="order-full-address"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    Complete Street Address (House/Flat No., Building, Road, Area) *
                  </label>
                  <input
                    id="order-full-address"
                    type="text"
                    required
                    maxLength={BLUEPRINT_LIMITS.ORDER_ADDRESS_MAX}
                    value={fullAddress}
                    onChange={(e) => setFullAddress(e.target.value)}
                    placeholder="e.g., Flat 402, Saraswati Apartments, MG Road"
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-[#FAF8F5] px-3.5 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-900 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="order-landmark"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    Nearby Landmark (Optional)
                  </label>
                  <input
                    id="order-landmark"
                    type="text"
                    maxLength={BLUEPRINT_LIMITS.ORDER_LANDMARK_MAX}
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g., Near Central Library"
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-[#FAF8F5] px-3.5 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-900 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="order-city"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    City / District *
                  </label>
                  <input
                    id="order-city"
                    type="text"
                    required
                    maxLength={BLUEPRINT_LIMITS.ORDER_CITY_MAX}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g., Jaipur / Bengaluru / New Delhi"
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-[#FAF8F5] px-3.5 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-900 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="order-state"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    State *
                  </label>
                  <select
                    id="order-state"
                    required
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-[#FAF8F5] px-3.5 py-2 text-sm text-stone-900 focus:border-rose-900 focus:bg-white focus:outline-none"
                  >
                    <option value="">Select State...</option>
                    {INDIAN_STATES_AND_UTS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="order-pincode"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    PIN Code / Postal Code *
                  </label>
                  <input
                    id="order-pincode"
                    type="text"
                    required
                    maxLength={BLUEPRINT_LIMITS.ORDER_PINCODE_MAX}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="e.g., 302001"
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-[#FAF8F5] px-3.5 py-2 font-mono text-sm tabular-nums text-stone-900 placeholder:font-sans placeholder:text-stone-400 focus:border-rose-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer Submit Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-stone-200 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100 whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-900 px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-rose-800 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <ShoppingBag className="h-4 w-4" />
                {isSubmitting ? 'Placing Order...' : 'Confirm Buy Now Order'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
