# SARAS — Old Book 3-Side Archive & Marketplace

**SARAS** (`saras-marketplace`) is a web application for cataloging, preserving, and purchasing pre-loved and vintage books. Every book in the marketplace is documented across all **three physical sides** — **Front Cover**, **Book Spine**, and **Back Cover** — so readers and collectors can inspect binding condition, edition markings, and cover preservation before ordering.

---

## Key Features

### 1. 3-Side Book Photography Studio
- **Live Camera Capture**: Built-in WebRTC camera studio with framing guides tailored for:
  1. **Side 1 · Front Cover**
  2. **Side 2 · Book Spine / Edge**
  3. **Side 3 · Back Cover**
- **Device Upload & Auto-Compression**: Supports direct mobile/desktop image uploads with client-side canvas compression for fast loading and storage efficiency.
- **Complete Attribution**: Records the **Book Name**, **Book Author Name**, **Contributor Name**, and optional **Binding / Condition Notes**.

### 2. Interactive Book Catalog & Inspection
- **3-Side Card Switcher**: Flip between the Front Cover, Spine, and Back Cover directly on any catalog card, or open the full **3-Side Archival Inspection Modal**.
- **Community & Personal Views**: Toggle between **All Added Books** and **Added by Me**, with instant search by book title, author, or contributor.
- **Clear Empty State**: Displays a clean `No books :(!` state with quick actions when no books are listed yet.

### 3. Authentication & Phone OTP Verification
- **Sign Up & Login Pages**: Supports one-click Google authentication as well as Email & Password credentials.
- **Phone Number & OTP Verification**: Allows contributors and buyers to verify their mobile phone numbers via 6-digit One-Time Password (OTP), storing verified contact records in an isolated private subcollection.

### 4. Buy Now Checkout with Step-1 Exact Location Capture
- **Step 01 — Exact Location First**: Captures high-accuracy GPS coordinates (`navigator.geolocation`) and reverse-geocodes street, locality, city, state, and PIN code via OpenStreetMap Nominatim (with manual entry and map-pin verification).
- **Step 02 — Sender Phone Number**: Records the buyer's active phone number for courier coordination.
- **Step 03 — Shiprocket-Ready Delivery Address**: Collects recipient full name, house/flat/street address, landmark, city, **State**, and **PIN Code**.

### 5. Password-Protected Admin Dispatch Console
- **Protected Access**: Clicking **Admin Panel** requires unlocking the secret owner password before any order details are displayed.
- **Shiprocket Fulfillment Workflow**:
  - View **which phone number** sent each order and **which book** was ordered.
  - View the buyer's **exact GPS location**, **State**, **PIN code**, and complete street address.
  - One-click **Copy All for Shiprocket**, individual field copy buttons, and **Download Shiprocket CSV** for bulk courier import.
  - Live fulfillment status tracking (`Pending` → `Entered in Shiprocket` → `Dispatched` → `Delivered`).

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS 4, Lucide Icons
- **Build Tool**: Vite 8
- **Authentication & Database**: Firebase Authentication & Cloud Firestore
- **Geolocation**: Web Geolocation API + OpenStreetMap Nominatim Reverse Geocoding
- **Deployment**: Vercel (`saras-marketplace`)

---

## Getting Started Locally

### Prerequisites
- Node.js 18+ and npm

### Installation

1. Clone the repository and install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

2. Start the development server on port `3000`:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

---

## Deploying to Vercel

This project includes a preconfigured `vercel.json` and `.npmrc` for seamless deployment:

```bash
npx vercel --prod --name saras-marketplace
```

After deploying, add your production domain (e.g., `saras-marketplace.vercel.app`) under **Firebase Console → Authentication → Settings → Authorized domains** so authentication works across your live URL.

---

## Project Structure

```text
saras-marketplace/
├── src/
│   ├── components/
│   │   ├── AdminOrdersPanel.tsx   # Password-protected Shiprocket dispatch dashboard
│   │   ├── BookInspectModal.tsx   # 3-side high-resolution book inspection modal
│   │   ├── BuyNowModal.tsx        # Step-1 Exact Location & Shiprocket address checkout
│   │   ├── CameraModal.tsx        # Live 3-side WebRTC book camera studio
│   │   └── PhoneOtpVerifier.tsx   # Mobile phone number & 6-digit OTP verification
│   ├── utils/
│   │   └── imageCompression.ts    # Client-side canvas JPEG compression
│   ├── App.tsx                    # Main application, auth pages, and catalog views
│   ├── firebase.ts                # Firebase initialization & validation constants
│   ├── index.css                  # Editorial typography & theme tokens
│   └── main.tsx                   # Application entry point
├── firestore.rules                # Hardened Firestore security rules
├── vercel.json                    # Vercel SPA build & routing configuration
└── package.json
```

---

## License

Apache-2.0
