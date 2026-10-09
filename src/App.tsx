/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  BookOpen,
  Camera,
  Check,
  Eye,
  LogOut,
  Plus,
  Search,
  Trash2,
  Upload,
  AlertTriangle,
  ShieldCheck,
  ShoppingBag,
  Package,
  MapPin,
  Phone,
  Lock,
  KeyRound,
} from 'lucide-react';
import {
  auth,
  BLUEPRINT_LIMITS,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { BOOK_SIDES, BookSideKey, CameraModal } from './components/CameraModal';
import { BookInspectModal, BookRecord } from './components/BookInspectModal';
import { PhoneOtpVerifier } from './components/PhoneOtpVerifier';
import { BuyNowModal, OrderSubmissionPayload } from './components/BuyNowModal';
import {
  AdminOrdersPanel,
  BookOrderRecord,
  OrderStatus,
} from './components/AdminOrdersPanel';
import { compressImageFileToDataUrl } from './utils/imageCompression';
import heroBooksImg from './assets/images/saras_vintage_books_hero_1791552919016.jpg';

type AuthMode = 'login' | 'signup';
type WorkspaceOption = 'browse' | 'add' | 'my-orders' | 'admin';
type CatalogScope = 'all' | 'mine';

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [fullNameInput, setFullNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [showConsoleGuide, setShowConsoleGuide] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // User profile display name & phone verification state synced with /users/{uid} and /users/{uid}/private/contact
  const [profileName, setProfileName] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);

  // Workspace options: Option 1 ('browse'), Option 2 ('add'), 'my-orders', and 'admin' (ONLY for brobecode1765@gmail.com)
  const [activeOption, setActiveOption] = useState<WorkspaceOption>('browse');
  const [catalogScope, setCatalogScope] = useState<CatalogScope>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Books catalog state
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const [activeSideByBook, setActiveSideByBook] = useState<Record<string, BookSideKey>>({});
  const [inspectedBook, setInspectedBook] = useState<BookRecord | null>(null);

  // Buy Now Modal state
  const [buyNowBook, setBuyNowBook] = useState<BookRecord | null>(null);

  // Orders state (Admin all-orders + Buyer my-orders)
  const [adminOrders, setAdminOrders] = useState<BookOrderRecord[]>([]);
  const [isLoadingAdminOrders, setIsLoadingAdminOrders] = useState(false);
  const [myOrders, setMyOrders] = useState<BookOrderRecord[]>([]);
  const [isLoadingMyOrders, setIsLoadingMyOrders] = useState(false);

  // Admin Password Gate state (requires password "hello" to unlock)
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState<string | null>(null);
  const [isUnlockingAdmin, setIsUnlockingAdmin] = useState(false);

  // Option 2: Add Book form state
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [addedByName, setAddedByName] = useState('');
  const [conditionNote, setConditionNote] = useState('');
  const [photos, setPhotos] = useState<Record<BookSideKey, string>>({
    frontPhoto: '',
    spinePhoto: '',
    backPhoto: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmittingBook, setIsSubmittingBook] = useState(false);

  // Camera Modal state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraInitialSide, setCameraInitialSide] = useState<BookSideKey>('frontPhoto');

  // File input refs for each of the 3 sides
  const fileInputRefs = useRef<Record<BookSideKey, HTMLInputElement | null>>({
    frontPhoto: null,
    spinePhoto: null,
    backPhoto: null,
  });

  // Hero image fallback state
  const [heroImgBroken, setHeroImgBroken] = useState(false);

  // Admin access is granted once the user unlocks the Admin Panel with the secret password "hello"
  const isAdminUser = Boolean(user && isAdminUnlocked);

  const isUserTokenVerified = (u: User): boolean => {
    return Boolean(u.emailVerified || u.phoneNumber);
  };

  // Unlock Admin Panel with secret password "hello"
  const handleAdminPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPasswordError(null);

    if (adminPasswordInput !== 'hello') {
      setAdminPasswordError(
        'Access Denied — Incorrect Admin Password. Only the owner knows the secret password.'
      );
      return;
    }

    if (!user) {
      setAdminPasswordError('Please sign in first before unlocking the Admin Panel.');
      return;
    }

    setIsUnlockingAdmin(true);
    try {
      const cleanUid = user.uid.trim();
      if (isUserTokenVerified(user)) {
        const adminDocRef = doc(db, 'admins', cleanUid);
        const adminSnap = await getDoc(adminDocRef);
        if (!adminSnap.exists()) {
          await setDoc(adminDocRef, {
            uid: cleanUid,
            accessCode: 'hello',
            createdAt: serverTimestamp(),
          });
        }
      }
      setIsAdminUnlocked(true);
      setAdminPasswordInput('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `admins/${user.uid}`);
    } finally {
      setIsUnlockingAdmin(false);
    }
  };

  // Ensure /users/{uid} exists for verified user, sync private phone contact, and register /admins/{uid} if owner
  const ensureUserProfileInFirestore = async (
    currentUser: User,
    preferredName?: string,
    phoneToPersist?: string | null
  ): Promise<string> => {
    const cleanUid = currentUser.uid.trim();
    if (
      !cleanUid ||
      cleanUid.length > BLUEPRINT_LIMITS.UID_MAX_LENGTH ||
      !BLUEPRINT_LIMITS.ID_PATTERN.test(cleanUid)
    ) {
      return 'Archivist';
    }

    const fallbackName = (
      preferredName?.trim() ||
      currentUser.displayName?.trim() ||
      currentUser.email?.split('@')[0]?.trim() ||
      currentUser.phoneNumber?.trim() ||
      'SARAS Reader'
    ).slice(0, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX);

    const effectivePhone =
      phoneToPersist?.trim() ||
      currentUser.phoneNumber?.trim() ||
      verifiedPhone?.trim() ||
      null;

    const userDocRef = doc(db, 'users', cleanUid);
    const privateContactRef = doc(db, 'users', cleanUid, 'private', 'contact');

    try {
      const snap = await getDoc(userDocRef);
      let resolvedName = fallbackName;
      let hasVerifiedPhone = Boolean(effectivePhone);

      if (snap.exists()) {
        const existingData = snap.data();
        const storedName =
          typeof existingData.displayName === 'string' && existingData.displayName.trim()
            ? existingData.displayName.trim()
            : fallbackName;
        resolvedName = preferredName?.trim()
          ? preferredName.trim().slice(0, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX)
          : storedName;
        hasVerifiedPhone = Boolean(existingData.phoneVerified || effectivePhone);

        if (
          isUserTokenVerified(currentUser) &&
          (resolvedName !== existingData.displayName ||
            hasVerifiedPhone !== existingData.phoneVerified ||
            typeof existingData.phoneVerified !== 'boolean')
        ) {
          await setDoc(
            userDocRef,
            {
              uid: cleanUid,
              displayName: resolvedName,
              phoneVerified: hasVerifiedPhone,
              createdAt: existingData.createdAt || serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: false }
          );
        }
      } else if (isUserTokenVerified(currentUser)) {
        await setDoc(userDocRef, {
          uid: cleanUid,
          displayName: resolvedName,
          phoneVerified: hasVerifiedPhone,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // Sync isolated PII phone record at /users/{uid}/private/contact
      if (isUserTokenVerified(currentUser)) {
        if (effectivePhone && BLUEPRINT_LIMITS.PHONE_PATTERN.test(effectivePhone)) {
          const cleanPhone = effectivePhone.slice(0, BLUEPRINT_LIMITS.PHONE_MAX);
          await setDoc(
            privateContactRef,
            {
              uid: cleanUid,
              phoneNumber: cleanPhone,
              phoneVerified: true,
              updatedAt: serverTimestamp(),
            },
            { merge: false }
          );
          setVerifiedPhone(cleanPhone);
        } else if (hasVerifiedPhone) {
          try {
            const contactSnap = await getDoc(privateContactRef);
            if (contactSnap.exists()) {
              const cData = contactSnap.data();
              if (typeof cData.phoneNumber === 'string') {
                setVerifiedPhone(cData.phoneNumber);
              }
            }
          } catch {
            // ignore if contact doc doesn't exist yet
          }
        }
      }

      return resolvedName;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${cleanUid}`);
    }
  };

  // Callback when PhoneOtpVerifier completes OTP confirmation
  const handlePhoneVerified = async (formattedPhone: string, signedInUser?: User) => {
    setVerifiedPhone(formattedPhone);
    const activeUser = signedInUser || user;
    if (activeUser) {
      await ensureUserProfileInFirestore(
        activeUser,
        fullNameInput.trim() || profileName || undefined,
        formattedPhone
      );
    }
  };

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);

      if (currentUser) {
        try {
          const resolvedName = await ensureUserProfileInFirestore(
            currentUser,
            fullNameInput.trim() || undefined,
            verifiedPhone
          );
          setProfileName(resolvedName);
          setAddedByName((prev) => prev || resolvedName);
        } catch (err) {
          console.error(err);
        }
      } else {
        setProfileName('');
        setAddedByName('');
        setBooks([]);
        setAdminOrders([]);
        setMyOrders([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time Firestore listener for books (Option 1)
  useEffect(() => {
    if (!isAuthReady || !user) {
      setBooks([]);
      setIsLoadingBooks(false);
      return;
    }

    setIsLoadingBooks(true);
    const booksCollection = collection(db, 'books');
    const booksQuery =
      catalogScope === 'mine'
        ? query(booksCollection, where('ownerId', '==', user.uid))
        : query(booksCollection, where('visibility', '==', BLUEPRINT_LIMITS.VISIBILITY_PUBLIC));

    const unsubscribe = onSnapshot(
      booksQuery,
      (snapshot) => {
        const fetched: BookRecord[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            title: String(data.title || ''),
            author: String(data.author || ''),
            frontPhoto: String(data.frontPhoto || ''),
            spinePhoto: String(data.spinePhoto || ''),
            backPhoto: String(data.backPhoto || ''),
            conditionNote: String(data.conditionNote || ''),
            ownerId: String(data.ownerId || ''),
            ownerName: String(data.ownerName || 'Contributor'),
            visibility: 'public',
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null,
          };
        });

        fetched.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });

        setBooks(fetched);
        setIsLoadingBooks(false);
      },
      (error) => {
        setIsLoadingBooks(false);
        handleFirestoreError(error, OperationType.LIST, 'books');
      }
    );

    return () => unsubscribe();
  }, [isAuthReady, user, catalogScope]);

  // Real-time Firestore listener for Buyer's own orders
  useEffect(() => {
    if (!isAuthReady || !user) {
      setMyOrders([]);
      return;
    }

    setIsLoadingMyOrders(true);
    const ordersRef = collection(db, 'orders');
    const buyerOrdersQuery = query(ordersRef, where('buyerId', '==', user.uid));

    const unsubscribe = onSnapshot(
      buyerOrdersQuery,
      (snapshot) => {
        const list: BookOrderRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            bookId: String(d.bookId || ''),
            bookTitle: String(d.bookTitle || ''),
            bookAuthor: String(d.bookAuthor || ''),
            sellerName: String(d.sellerName || ''),
            buyerId: String(d.buyerId || ''),
            customerName: String(d.customerName || ''),
            customerPhone: String(d.customerPhone || ''),
            exactLocation: String(d.exactLocation || ''),
            fullAddress: String(d.fullAddress || ''),
            landmark: String(d.landmark || ''),
            city: String(d.city || ''),
            state: String(d.state || ''),
            pincode: String(d.pincode || ''),
            status: (d.status as OrderStatus) || 'pending',
            adminEmail: String(d.adminEmail || BLUEPRINT_LIMITS.ADMIN_EMAIL),
            createdAt: d.createdAt || null,
            updatedAt: d.updatedAt || null,
          };
        });

        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setMyOrders(list);
        setIsLoadingMyOrders(false);
      },
      (error) => {
        setIsLoadingMyOrders(false);
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    );

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // Real-time Firestore listener for Admin Orders (STRICTLY ONLY for brobecode1765@gmail.com)
  useEffect(() => {
    if (!isAuthReady || !user || !isAdminUser) {
      setAdminOrders([]);
      return;
    }

    setIsLoadingAdminOrders(true);
    const ordersRef = collection(db, 'orders');
    const adminOrdersQuery = query(
      ordersRef,
      where('adminEmail', '==', BLUEPRINT_LIMITS.ADMIN_EMAIL)
    );

    const unsubscribe = onSnapshot(
      adminOrdersQuery,
      (snapshot) => {
        const list: BookOrderRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            bookId: String(d.bookId || ''),
            bookTitle: String(d.bookTitle || ''),
            bookAuthor: String(d.bookAuthor || ''),
            sellerName: String(d.sellerName || ''),
            buyerId: String(d.buyerId || ''),
            customerName: String(d.customerName || ''),
            customerPhone: String(d.customerPhone || ''),
            exactLocation: String(d.exactLocation || ''),
            fullAddress: String(d.fullAddress || ''),
            landmark: String(d.landmark || ''),
            city: String(d.city || ''),
            state: String(d.state || ''),
            pincode: String(d.pincode || ''),
            status: (d.status as OrderStatus) || 'pending',
            adminEmail: String(d.adminEmail || BLUEPRINT_LIMITS.ADMIN_EMAIL),
            createdAt: d.createdAt || null,
            updatedAt: d.updatedAt || null,
          };
        });

        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setAdminOrders(list);
        setIsLoadingAdminOrders(false);
      },
      (error) => {
        setIsLoadingAdminOrders(false);
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    );

    return () => unsubscribe();
  }, [isAuthReady, user, isAdminUser]);

  // Filtered books by search query
  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.ownerName.toLowerCase().includes(q)
    );
  }, [books, searchQuery]);

  // Google Sign-In / Sign-Up Handler
  const handleGoogleAuth = async () => {
    setAuthError(null);
    setShowConsoleGuide(false);
    setIsAuthenticating(true);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const preferred =
        authMode === 'signup' && fullNameInput.trim()
          ? fullNameInput.trim().slice(0, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX)
          : undefined;
      const resolvedName = await ensureUserProfileInFirestore(
        credential.user,
        preferred,
        verifiedPhone
      );
      setProfileName(resolvedName);
      setAddedByName(resolvedName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      if (!msg.includes('auth/popup-closed-by-user')) {
        setAuthError(msg);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Email/Password Sign-Up or Login Handler
  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setShowConsoleGuide(false);

    const trimmedEmail = emailInput.trim();
    const trimmedName = fullNameInput.trim();

    if (!trimmedEmail || !passwordInput) {
      setAuthError('Please enter both your email address and password.');
      return;
    }

    if (authMode === 'signup' && !trimmedName) {
      setAuthError('Please enter your name for book contributor attribution.');
      return;
    }

    setIsAuthenticating(true);
    try {
      if (authMode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, passwordInput);
        await updateProfile(cred.user, {
          displayName: trimmedName.slice(0, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
        });
        await sendEmailVerification(cred.user).catch(() => {});
        setProfileName(trimmedName.slice(0, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX));
        setAddedByName(trimmedName.slice(0, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX));
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, passwordInput);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/operation-not-allowed' ||
        code === 'auth/configuration-not-found'
      ) {
        setShowConsoleGuide(true);
        setAuthError(
          'Email/Password provider is not enabled in the Firebase Console yet. Use the instant Google button below or enable Email/Password in Firebase Console.'
        );
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setAuthError('Invalid email or password. Please check your credentials or use Google Sign-In.');
      } else if (code === 'auth/email-already-in-use') {
        setAuthError('This email is already registered. Switch to Log In or continue with Google.');
      } else if (code === 'auth/weak-password') {
        setAuthError('Password should be at least 6 characters long.');
      } else {
        setAuthError(err instanceof Error ? err.message : 'Unable to complete sign in.');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    await signOut(auth);
    setVerifiedPhone(null);
    setIsAdminUnlocked(false);
    setAdminPasswordInput('');
    setAdminPasswordError(null);
    setActiveOption('browse');
  };

  // Handle Side Photo Update
  const handleSidePhotoCaptured = (side: BookSideKey, dataUrl: string) => {
    setFormError(null);
    setPhotos((prev) => ({
      ...prev,
      [side]: dataUrl,
    }));
  };

  // Handle Direct File Upload for a specific side
  const handleDirectSideUpload = async (
    side: BookSideKey,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError(null);
    try {
      const compressed = await compressImageFileToDataUrl(file);
      handleSidePhotoCaptured(side, compressed);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not process image file.');
    } finally {
      e.target.value = '';
    }
  };

  // Open Camera Modal for a specific side
  const openCameraForSide = (side: BookSideKey) => {
    setCameraInitialSide(side);
    setIsCameraOpen(true);
  };

  // Submit new book with 3-side photos to Firestore
  const handleAddBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!user) {
      setFormError('You must be signed in to add a book.');
      return;
    }

    if (!isUserTokenVerified(user)) {
      setFormError(
        'Your account must have a verified email or verified phone token to publish books. Please sign in with Google for instant verification.'
      );
      return;
    }

    const cleanTitle = bookTitle.trim().slice(0, BLUEPRINT_LIMITS.BOOK_TITLE_MAX);
    const cleanAuthor = bookAuthor.trim().slice(0, BLUEPRINT_LIMITS.BOOK_AUTHOR_MAX);
    const cleanOwnerName = (addedByName.trim() || profileName || 'SARAS Reader').slice(
      0,
      BLUEPRINT_LIMITS.DISPLAY_NAME_MAX
    );
    const cleanCondition = conditionNote
      .trim()
      .slice(0, BLUEPRINT_LIMITS.BOOK_CONDITION_MAX);

    if (cleanTitle.length < BLUEPRINT_LIMITS.BOOK_TITLE_MIN) {
      setFormError('Please enter the Book Name.');
      return;
    }

    if (cleanAuthor.length < BLUEPRINT_LIMITS.BOOK_AUTHOR_MIN) {
      setFormError('Please enter the Book Author Name.');
      return;
    }

    if (!photos.frontPhoto || !photos.spinePhoto || !photos.backPhoto) {
      const missingSides = BOOK_SIDES.filter((s) => !photos[s.key])
        .map((s) => s.shortLabel)
        .join(', ');
      setFormError(
        `Please take or upload photos for all 3 sides of the book. Missing: ${missingSides}.`
      );
      return;
    }

    // Defensive payload validation against BLUEPRINT_LIMITS
    for (const side of BOOK_SIDES) {
      const dataUrl = photos[side.key];
      if (
        dataUrl.length < BLUEPRINT_LIMITS.BOOK_PHOTO_MIN ||
        dataUrl.length > BLUEPRINT_LIMITS.BOOK_PHOTO_MAX
      ) {
        setFormError(`${side.label} photo size is out of bounds. Please retake the photo.`);
        return;
      }
    }

    setIsSubmittingBook(true);
    try {
      await ensureUserProfileInFirestore(user, cleanOwnerName, verifiedPhone);

      const newBookRef = doc(collection(db, 'books'));
      const payload = {
        title: cleanTitle,
        author: cleanAuthor,
        frontPhoto: photos.frontPhoto,
        spinePhoto: photos.spinePhoto,
        backPhoto: photos.backPhoto,
        conditionNote: cleanCondition,
        ownerId: user.uid,
        ownerName: cleanOwnerName,
        visibility: BLUEPRINT_LIMITS.VISIBILITY_PUBLIC,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(newBookRef, payload);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `books/${newBookRef.id}`);
      }

      setBookTitle('');
      setBookAuthor('');
      setConditionNote('');
      setPhotos({ frontPhoto: '', spinePhoto: '', backPhoto: '' });
      setFormSuccess(`"${cleanTitle}" by ${cleanAuthor} was added to the SARAS archive.`);
      setActiveOption('browse');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to save book. Please try again.'
      );
    } finally {
      setIsSubmittingBook(false);
    }
  };

  // Submit Buy Now Order with Exact Location, State, Full Address, and Phone Number
  const handlePlaceBuyNowOrder = async (
    orderInput: OrderSubmissionPayload
  ): Promise<string> => {
    if (!user) {
      throw new Error('Please sign in to place an order.');
    }
    if (!isUserTokenVerified(user)) {
      throw new Error('Please sign in with a verified Google account to place an order.');
    }

    await ensureUserProfileInFirestore(
      user,
      orderInput.customerName,
      orderInput.customerPhone
    );

    const newOrderRef = doc(collection(db, 'orders'));
    const payload = {
      bookId: orderInput.bookId.trim().slice(0, BLUEPRINT_LIMITS.UID_MAX_LENGTH),
      bookTitle: orderInput.bookTitle.trim().slice(0, BLUEPRINT_LIMITS.BOOK_TITLE_MAX),
      bookAuthor: orderInput.bookAuthor.trim().slice(0, BLUEPRINT_LIMITS.BOOK_AUTHOR_MAX),
      sellerName: orderInput.sellerName.trim().slice(0, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
      buyerId: user.uid,
      customerName: orderInput.customerName
        .trim()
        .slice(0, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
      customerPhone: orderInput.customerPhone
        .trim()
        .slice(0, BLUEPRINT_LIMITS.PHONE_MAX),
      exactLocation: orderInput.exactLocation
        .trim()
        .slice(0, BLUEPRINT_LIMITS.ORDER_EXACT_LOCATION_MAX),
      fullAddress: orderInput.fullAddress
        .trim()
        .slice(0, BLUEPRINT_LIMITS.ORDER_ADDRESS_MAX),
      landmark: orderInput.landmark.trim().slice(0, BLUEPRINT_LIMITS.ORDER_LANDMARK_MAX),
      city: orderInput.city.trim().slice(0, BLUEPRINT_LIMITS.ORDER_CITY_MAX),
      state: orderInput.state.trim().slice(0, BLUEPRINT_LIMITS.ORDER_STATE_MAX),
      pincode: orderInput.pincode.trim().slice(0, BLUEPRINT_LIMITS.ORDER_PINCODE_MAX),
      status: 'pending' as const,
      adminEmail: BLUEPRINT_LIMITS.ADMIN_EMAIL,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(newOrderRef, payload);
      return newOrderRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `orders/${newOrderRef.id}`);
    }
  };

  // Admin: Update Order Status (Strictly only for brobecode1765@gmail.com)
  const handleAdminUpdateOrderStatus = async (
    order: BookOrderRecord,
    newStatus: OrderStatus
  ) => {
    if (!user || !isAdminUser) return;
    const orderDocRef = doc(db, 'orders', order.id);
    try {
      await setDoc(
        orderDocRef,
        {
          bookId: order.bookId,
          bookTitle: order.bookTitle,
          bookAuthor: order.bookAuthor,
          sellerName: order.sellerName,
          buyerId: order.buyerId,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          exactLocation: order.exactLocation,
          fullAddress: order.fullAddress,
          landmark: order.landmark,
          city: order.city,
          state: order.state,
          pincode: order.pincode,
          status: newStatus,
          adminEmail: order.adminEmail,
          createdAt: order.createdAt,
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
    }
  };

  // Delete book owned by current user
  const handleDeleteBook = async (bookId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'books', bookId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `books/${bookId}`);
    }
  };

  const capturedSidesCount = BOOK_SIDES.filter((s) => Boolean(photos[s.key])).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-stone-900">
      {/* Top Bar Contract: Strictly 1 row, 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 border-b border-stone-200 bg-[#FAF8F5]/95 px-6 py-4 backdrop-blur-xs">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            if (user) setActiveOption('browse');
          }}
          className="font-serif text-xl font-bold tracking-tight text-stone-900 whitespace-nowrap shrink-0"
        >
          SARAS
        </a>

        {/* Zone 2: 4–5 concise single-line text navigation links */}
        {user ? (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
            <button
              type="button"
              onClick={() => {
                setActiveOption('browse');
                setCatalogScope('all');
              }}
              className={`transition-colors hover:text-stone-900 whitespace-nowrap shrink-0 ${
                activeOption === 'browse' && catalogScope === 'all'
                  ? 'text-stone-900 underline underline-offset-8'
                  : ''
              }`}
            >
              Browse Books
            </button>
            <button
              type="button"
              onClick={() => setActiveOption('add')}
              className={`transition-colors hover:text-stone-900 whitespace-nowrap shrink-0 ${
                activeOption === 'add' ? 'text-stone-900 underline underline-offset-8' : ''
              }`}
            >
              Take Book Photos
            </button>
            <button
              type="button"
              onClick={() => setActiveOption('my-orders')}
              className={`transition-colors hover:text-stone-900 whitespace-nowrap shrink-0 ${
                activeOption === 'my-orders'
                  ? 'text-stone-900 underline underline-offset-8'
                  : ''
              }`}
            >
              My Orders ({myOrders.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveOption('admin');
                setAdminPasswordError(null);
              }}
              className={`inline-flex items-center gap-1.5 font-semibold text-rose-900 transition-colors hover:text-rose-800 whitespace-nowrap shrink-0 ${
                activeOption === 'admin' ? 'underline underline-offset-8' : ''
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              Admin Panel {isAdminUnlocked ? `(${adminOrders.length})` : ''}
            </button>
          </nav>
        ) : (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
            <button
              type="button"
              onClick={() => setAuthMode('signup')}
              className={`transition-colors hover:text-stone-900 whitespace-nowrap shrink-0 ${
                authMode === 'signup' ? 'text-stone-900 underline underline-offset-8' : ''
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`transition-colors hover:text-stone-900 whitespace-nowrap shrink-0 ${
                authMode === 'login' ? 'text-stone-900 underline underline-offset-8' : ''
              }`}
            >
              Log In
            </button>
            <a
              href="#phone-otp-box"
              className="transition-colors hover:text-stone-900 whitespace-nowrap shrink-0"
            >
              Phone OTP
            </a>
            <a
              href="#three-side-guide"
              className="transition-colors hover:text-stone-900 whitespace-nowrap shrink-0"
            >
              Archive Standard
            </a>
          </nav>
        )}

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          {user ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-800 transition-colors hover:bg-stone-100 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isAuthenticating}
              className="rounded-lg bg-rose-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              Continue with Google
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main id="top" className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        {!isAuthReady ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <p className="text-sm text-stone-500">Loading SARAS book archive...</p>
          </div>
        ) : !user ? (
          /* =========================================================
             UNAUTHENTICATED VIEW: SIGN UP PAGE & LOGIN PAGE + PHONE OTP
             ========================================================= */
          <div className="space-y-16">
            <section className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-stretch">
              {/* Left Column: Editorial Showcase & 3-Side Book Visual */}
              <div className="flex flex-col justify-between space-y-6 lg:col-span-7">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <span>Old Book Preservation</span>
                    <span aria-hidden="true">·</span>
                    <span>3-Side Photographic Record</span>
                    <span aria-hidden="true">·</span>
                    <span>Buy Now with Exact Location</span>
                  </div>
                  <h1 className="font-serif text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
                    Photograph, catalog, and order old books from all three sides.
                  </h1>
                  <p className="max-w-2xl text-base leading-relaxed text-stone-600">
                    SARAS lets readers and collectors preserve and purchase pre-loved books by
                    photographing all 3 sides — Front Cover, Book Spine, and Back Cover — paired
                    with Book Name, Author Name, Phone OTP verification, and exact GPS delivery
                    location.
                  </p>
                </div>

                {/* Hero Photography with Zero-Broken-Image Fallback */}
                <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-100 lg:h-full">
                  {!heroImgBroken ? (
                    <img
                      src={heroBooksImg}
                      alt="Stack of antique cloth-bound and weathered leather books on an oak desk"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgBroken(true)}
                      className="h-full max-h-[460px] w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-72 w-full flex-col items-center justify-center bg-stone-200/70 p-8 text-center">
                      <BookOpen className="mb-3 h-10 w-10 text-stone-600" />
                      <p className="font-serif text-lg font-medium text-stone-800">
                        SARAS 3-Side Old Book Archive
                      </p>
                      <p className="mt-1 text-xs text-stone-600">
                        Front Cover · Spine Binding · Back Cover
                      </p>
                    </div>
                  )}
                  <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent absolute inset-x-0 bottom-0 p-6 text-white">
                    <p className="font-serif text-lg font-medium">
                      Every book is archived with 3 angles, book name, author name, and Buy Now
                      delivery.
                    </p>
                    <p className="mt-1 text-xs text-stone-200">
                      Sign up, verify your phone number via OTP, and start photographing or
                      ordering books.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Sign Up Page & Login Page + Phone OTP Card */}
              <div
                id="auth-form"
                className="flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-8 shadow-xs lg:col-span-5"
              >
                <div className="space-y-5">
                  {/* Interactive Segmented Switcher: Sign Up Page vs Login Page */}
                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setAuthError(null);
                      }}
                      className={`rounded-md py-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        authMode === 'signup'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Sign Up Page
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError(null);
                      }}
                      className={`rounded-md py-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        authMode === 'login'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Login Page
                    </button>
                  </div>

                  <div>
                    <h2 className="font-serif text-2xl font-semibold text-stone-900">
                      {authMode === 'signup'
                        ? 'Create your SARAS account'
                        : 'Welcome back to SARAS'}
                    </h2>
                    <p className="mt-1 text-sm text-stone-600">
                      {authMode === 'signup'
                        ? 'Enter your name, verify your phone number with OTP, and sign up.'
                        : 'Log in with Google, Phone OTP, or Email to access the archive.'}
                    </p>
                  </div>

                  {authError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-900">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-800" />
                        <span>{authError}</span>
                      </div>
                      {showConsoleGuide && (
                        <div className="mt-2 border-t border-rose-200/80 pt-2 text-[11px] text-rose-800">
                          To use Email/Password instead of Google Popup: open Firebase Console →
                          Authentication → Sign-in method → Enable Email/Password. Or click{' '}
                          <strong>
                            {authMode === 'signup' ? 'Sign Up with Google' : 'Log In with Google'}
                          </strong>{' '}
                          below for instant access.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Name Input (on Sign Up) */}
                  {authMode === 'signup' && (
                    <div>
                      <label
                        htmlFor="signup-name"
                        className="block text-xs font-medium text-stone-700"
                      >
                        Your Name (shown on books you add)
                      </label>
                      <input
                        id="signup-name"
                        type="text"
                        maxLength={BLUEPRINT_LIMITS.DISPLAY_NAME_MAX}
                        value={fullNameInput}
                        onChange={(e) => setFullNameInput(e.target.value)}
                        placeholder="e.g., Kabir Verma"
                        className="mt-1.5 w-full rounded-lg border border-stone-300 bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-900 focus:bg-white focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Phone Number + Send OTP Verification Module */}
                  <div id="phone-otp-box">
                    <PhoneOtpVerifier
                      currentUser={user}
                      verifiedPhone={verifiedPhone}
                      onPhoneVerified={handlePhoneVerified}
                      compact
                    />
                  </div>

                  {/* Instant Verified Google Auth Button */}
                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={isAuthenticating}
                    className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-rose-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <span>
                      {isAuthenticating
                        ? 'Connecting...'
                        : authMode === 'signup'
                        ? 'Sign Up with Google'
                        : 'Log In with Google'}
                    </span>
                  </button>

                  <div className="relative flex items-center py-0.5">
                    <div className="grow border-t border-stone-200" />
                    <span className="mx-3 shrink-0 text-xs text-stone-400">
                      or use email credentials
                    </span>
                    <div className="grow border-t border-stone-200" />
                  </div>

                  {/* Email & Password Form */}
                  <form onSubmit={handleEmailAuthSubmit} className="space-y-3">
                    <div>
                      <label
                        htmlFor="auth-email"
                        className="block text-xs font-medium text-stone-700"
                      >
                        Email Address
                      </label>
                      <input
                        id="auth-email"
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="reader@example.com"
                        className="mt-1 w-full rounded-lg border border-stone-300 bg-[#FAF8F5] px-3.5 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-900 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="auth-password"
                        className="block text-xs font-medium text-stone-700"
                      >
                        Password
                      </label>
                      <input
                        id="auth-password"
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="••••••••"
                        className="mt-1 w-full rounded-lg border border-stone-300 bg-[#FAF8F5] px-3.5 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-900 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isAuthenticating}
                      className="w-full rounded-lg border border-stone-300 bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      {authMode === 'signup' ? 'Sign Up with Email' : 'Log In with Email'}
                    </button>
                  </form>
                </div>

                <div className="mt-6 border-t border-stone-200 pt-4 text-center text-xs text-stone-600">
                  {authMode === 'signup' ? (
                    <>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('login');
                          setAuthError(null);
                        }}
                        className="font-semibold text-rose-900 underline underline-offset-4"
                      >
                        Go to Login Page
                      </button>
                    </>
                  ) : (
                    <>
                      New to SARAS?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('signup');
                          setAuthError(null);
                        }}
                        className="font-semibold text-rose-900 underline underline-offset-4"
                      >
                        Go to Sign Up Page
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
        ) : (
          /* =========================================================
             AUTHENTICATED WORKSPACE:
             - Option 1: View Added Books + Buy Now (with Step 1 Exact Location)
             - Option 2: Take Picture & Add Book (All 3 Sides)
             - My Orders (Buyer Order History)
             - Admin Page (STRICTLY ONLY for brobecode1765@gmail.com)
             ========================================================= */
          <div className="space-y-10">
            {/* Welcome & Workspace Mode Switcher */}
            <section className="flex flex-col gap-6 border-b border-stone-200 pb-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                  <span>
                    Signed in as {profileName || user.email || user.phoneNumber || 'Reader'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {verifiedPhone ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-800">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Phone Verified ({verifiedPhone})
                      </span>
                    ) : (
                      <span>Phone not verified yet</span>
                    )}
                  </span>
                  {isAdminUser && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-rose-900">
                        Owner Admin ({BLUEPRINT_LIMITS.ADMIN_EMAIL})
                      </span>
                    </>
                  )}
                </div>
                <h1 className="font-serif text-3xl font-semibold text-stone-900 sm:text-4xl">
                  SARAS Old Book Archive & Store
                </h1>
                <p className="max-w-2xl text-sm text-stone-600">
                  Browse old books with 3-side photos and Buy Now delivery, or photograph your
                  own book from all 3 sides.
                </p>
              </div>

              {/* WORKSPACE OPTIONS SWITCHER */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveOption('browse');
                    setFormError(null);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                    activeOption === 'browse'
                      ? 'border-rose-900 bg-rose-900 text-white shadow-xs'
                      : 'border-stone-300 bg-white text-stone-800 hover:border-stone-400'
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                  Option 1: View Books ({books.length})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveOption('add');
                    setFormSuccess(null);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                    activeOption === 'add'
                      ? 'border-rose-900 bg-rose-900 text-white shadow-xs'
                      : 'border-stone-300 bg-white text-stone-800 hover:border-stone-400'
                  }`}
                >
                  <Camera className="h-4 w-4" />
                  Option 2: Take Picture & Add Book
                </button>

                <button
                  type="button"
                  onClick={() => setActiveOption('my-orders')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                    activeOption === 'my-orders'
                      ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                      : 'border-stone-300 bg-white text-stone-800 hover:border-stone-400'
                  }`}
                >
                  <Package className="h-4 w-4" />
                  My Orders ({myOrders.length})
                </button>

                {/* ADMIN PANEL BUTTON: Prompts for secret password "hello" when clicked */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveOption('admin');
                    setAdminPasswordError(null);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                    activeOption === 'admin'
                      ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                      : 'border-rose-900/40 bg-rose-50/70 text-rose-950 hover:bg-rose-100'
                  }`}
                >
                  <Lock className="h-3.5 w-3.5 text-rose-900" />
                  Admin Panel {isAdminUnlocked ? `(${adminOrders.length})` : '(Password Protected)'}
                </button>
              </div>
            </section>

            {/* Phone Number & OTP Verification Bar in Workspace */}
            <section>
              <PhoneOtpVerifier
                currentUser={user}
                verifiedPhone={verifiedPhone}
                onPhoneVerified={handlePhoneVerified}
              />
            </section>

            {formSuccess && (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-700" />
                  <span>{formSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormSuccess(null)}
                  className="text-xs font-medium text-emerald-800 underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {activeOption === 'admin' ? (
              isAdminUnlocked ? (
                /* ---------------------------------------------------------
                   UNLOCKED ADMIN PANEL (After entering secret password "hello")
                   Shows which phone number sent which order & exact location/state for Shiprocket
                   --------------------------------------------------------- */
                <AdminOrdersPanel
                  adminEmail={user.email || BLUEPRINT_LIMITS.ADMIN_EMAIL}
                  orders={adminOrders}
                  isLoading={isLoadingAdminOrders}
                  onUpdateOrderStatus={handleAdminUpdateOrderStatus}
                  onLockAdmin={() => {
                    setIsAdminUnlocked(false);
                    setAdminPasswordInput('');
                    setAdminPasswordError(null);
                  }}
                />
              ) : (
                /* ---------------------------------------------------------
                   LOCKED ADMIN PASSWORD GATE (Requires password "hello")
                   --------------------------------------------------------- */
                <section className="mx-auto max-w-md rounded-xl border border-stone-200 bg-white p-8 shadow-xs">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-900">
                      <KeyRound className="h-6 w-6" />
                    </div>
                    <h2 className="mt-4 font-serif text-2xl font-semibold text-stone-900">
                      Admin Panel Locked
                    </h2>
                    <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
                      This Admin Panel is restricted to the owner. Enter the secret Admin
                      Password to view customer phone numbers, exact locations, states, and
                      Shiprocket delivery addresses.
                    </p>
                  </div>

                  {adminPasswordError && (
                    <div className="mt-5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-900">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-800" />
                      <span>{adminPasswordError}</span>
                    </div>
                  )}

                  <form onSubmit={handleAdminPasswordSubmit} className="mt-6 space-y-4">
                    <div>
                      <label
                        htmlFor="admin-secret-password"
                        className="block text-xs font-semibold text-stone-700"
                      >
                        Enter Admin Password
                      </label>
                      <input
                        id="admin-secret-password"
                        type="password"
                        required
                        autoFocus
                        value={adminPasswordInput}
                        onChange={(e) => {
                          setAdminPasswordInput(e.target.value);
                          setAdminPasswordError(null);
                        }}
                        placeholder="Enter secret password..."
                        className="mt-1.5 w-full rounded-lg border border-stone-300 bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-900 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setActiveOption('browse')}
                        className="flex-1 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50 whitespace-nowrap shrink-0"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUnlockingAdmin}
                        className="flex-1 rounded-lg bg-rose-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-rose-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        {isUnlockingAdmin ? 'Verifying...' : 'Unlock Admin Panel'}
                      </button>
                    </div>
                  </form>
                </section>
              )
            ) : activeOption === 'my-orders' ? (
              /* ---------------------------------------------------------
                 BUYER'S OWN PLACED ORDERS VIEW
                 --------------------------------------------------------- */
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-2xl font-semibold text-stone-900">
                      My Placed Book Orders
                    </h2>
                    <p className="text-xs text-stone-600">
                      Orders you placed using Buy Now with your exact location, state, and phone
                      number.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveOption('browse')}
                    className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50 whitespace-nowrap shrink-0"
                  >
                    Browse More Books
                  </button>
                </div>

                {isLoadingMyOrders ? (
                  <div className="rounded-xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
                    Loading your orders...
                  </div>
                ) : myOrders.length === 0 ? (
                  <div className="rounded-xl border border-stone-200 bg-white p-12 text-center">
                    <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-stone-400" />
                    <h3 className="font-serif text-xl font-semibold text-stone-900">
                      You have not ordered any books yet
                    </h3>
                    <p className="mt-1 text-xs text-stone-500">
                      Click "Buy Now" on any book in the catalog to set your exact location and
                      delivery address.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {myOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="rounded-xl border border-stone-200 bg-white p-5 space-y-3"
                      >
                        <div className="flex items-center justify-between text-xs text-stone-500 border-b border-stone-100 pb-2">
                          <span className="font-mono font-semibold text-stone-800">
                            ORDER #{ord.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className="font-semibold text-rose-900">
                            {ord.status === 'pending'
                              ? 'Order Received'
                              : ord.status === 'ready_for_shiprocket'
                              ? 'Prepared for Shiprocket'
                              : ord.status === 'dispatched'
                              ? 'Dispatched'
                              : 'Delivered'}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-serif text-lg font-semibold text-stone-900">
                            {ord.bookTitle}
                          </h3>
                          <p className="text-xs text-stone-600">
                            Author: {ord.bookAuthor} · Listed by {ord.sellerName}
                          </p>
                        </div>
                        <div className="space-y-1 border-t border-stone-100 pt-2.5 text-xs text-stone-700">
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-stone-400" />
                            <span>Sent from: </span>
                            <strong className="font-mono tabular-nums">
                              {ord.customerPhone}
                            </strong>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-900" />
                            <span>
                              <strong>Exact Location:</strong> {ord.exactLocation}
                            </span>
                          </div>
                          <div className="text-stone-600 pl-5">
                            {ord.fullAddress}, {ord.city}, <strong>{ord.state}</strong> -{' '}
                            <span className="font-mono tabular-nums">{ord.pincode}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : activeOption === 'browse' ? (
              /* ---------------------------------------------------------
                 OPTION 1: VIEW BOOKS (PHOTOS, AUTHOR, BOOK NAME, WHOEVER ADDED + BUY NOW)
                 IF NO BOOKS -> SHOW "No books :( !"
                 --------------------------------------------------------- */
              <section className="space-y-6">
                {/* Filter & Search Toolbar */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Interactive Filter Tabs */}
                  <div className="inline-flex items-center gap-1 rounded-lg bg-stone-200/70 p-1 self-start">
                    <button
                      type="button"
                      onClick={() => setCatalogScope('all')}
                      className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        catalogScope === 'all'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      All Added Books (Community)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCatalogScope('mine')}
                      className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        catalogScope === 'mine'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Added by Me
                    </button>
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search book name, author, or person..."
                      className="w-full rounded-lg border border-stone-300 bg-white py-2 pr-3.5 pl-9 text-xs text-stone-900 placeholder:text-stone-400 focus:border-rose-900 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Catalog Grid or "No books :( !" Empty State */}
                {isLoadingBooks ? (
                  <div className="rounded-xl border border-stone-200 bg-white p-12 text-center">
                    <p className="text-sm text-stone-500">Loading books from archive...</p>
                  </div>
                ) : filteredBooks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-stone-200 bg-white px-6 py-16 text-center">
                    <BookOpen className="mb-4 h-12 w-12 text-stone-400" />
                    <h2 className="font-serif text-3xl font-semibold text-stone-900">
                      No books :(!
                    </h2>
                    <p className="mt-2 max-w-md text-sm text-stone-600">
                      {searchQuery.trim()
                        ? `No books matched "${searchQuery}". Try clearing your search or add a new book.`
                        : 'No old books have been added here yet. Be the first person to click photos of a book from all 3 sides and add its name and author!'}
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveOption('add');
                          openCameraForSide('frontPhoto');
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-rose-900 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-rose-800 whitespace-nowrap shrink-0"
                      >
                        <Camera className="h-4 w-4" />
                        Take Picture of Book (3 Sides)
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveOption('add')}
                        className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-800 transition-colors hover:bg-stone-50 whitespace-nowrap shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                        Add Book Details
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {filteredBooks.map((book) => {
                      const activeSide: BookSideKey =
                        activeSideByBook[book.id] || 'frontPhoto';
                      const isOwner = user.uid === book.ownerId || isAdminUser;

                      return (
                        <article
                          key={book.id}
                          className="group flex flex-col justify-between overflow-hidden rounded-xl border border-stone-200 bg-white transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div>
                            {/* Active Side Photo Display */}
                            <div className="relative aspect-4/3 w-full overflow-hidden bg-stone-100">
                              <img
                                src={book[activeSide]}
                                alt={`${book.title} — ${activeSide}`}
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => setInspectedBook(book)}
                                className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-lg bg-stone-950/80 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-xs transition-colors hover:bg-stone-900 whitespace-nowrap shrink-0"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Inspect 3 Sides
                              </button>
                            </div>

                            {/* Interactive 3-Side Switcher Bar */}
                            <div className="grid grid-cols-3 border-b border-stone-200 bg-[#FAF8F5] p-1.5 gap-1">
                              {BOOK_SIDES.map((side) => {
                                const isCurrent = activeSide === side.key;
                                return (
                                  <button
                                    key={side.key}
                                    type="button"
                                    onClick={() =>
                                      setActiveSideByBook((prev) => ({
                                        ...prev,
                                        [book.id]: side.key,
                                      }))
                                    }
                                    className={`rounded py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                                      isCurrent
                                        ? 'bg-stone-900 text-white'
                                        : 'text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
                                    }`}
                                  >
                                    {side.stepNumber}. {side.shortLabel}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Book Name, Author Name & Whoever Added Metadata */}
                            <div className="p-5 space-y-2">
                              {/* Clean unboxed metadata with typographic separators (Zero-Pill Discipline) */}
                              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                                <span>Added by {book.ownerName}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">3 Sides</span>
                              </div>

                              <h3 className="font-serif text-lg font-semibold text-stone-900 line-clamp-1">
                                {book.title}
                              </h3>

                              <p className="text-sm font-medium text-stone-700 line-clamp-1">
                                Author: {book.author}
                              </p>

                              {book.conditionNote && (
                                <p className="pt-1 text-xs text-stone-500 line-clamp-2">
                                  {book.conditionNote}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Card Footer Actions: Buy Now CTA + View All 3 Photos + Delete */}
                          <div className="space-y-3 border-t border-stone-100 px-5 py-4">
                            <button
                              type="button"
                              onClick={() => setBuyNowBook(book)}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-rose-800 whitespace-nowrap shrink-0"
                            >
                              <ShoppingBag className="h-3.5 w-3.5" />
                              Buy Now
                            </button>

                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => setInspectedBook(book)}
                                className="text-xs font-semibold text-stone-700 hover:text-stone-900 hover:underline whitespace-nowrap shrink-0"
                              >
                                View All 3 Photos
                              </button>

                              {isOwner && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBook(book.id)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 transition-colors hover:text-rose-800 whitespace-nowrap shrink-0"
                                  title="Delete book listing"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : (
              /* ---------------------------------------------------------
                 OPTION 2: TAKE PICTURE OF BOOK FROM ALL 3 SIDES & ADD BOOK
                 --------------------------------------------------------- */
              <section className="rounded-xl border border-stone-200 bg-white p-6 sm:p-8">
                <div className="flex flex-col gap-4 border-b border-stone-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <span>3-Side Photographic Capture</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {capturedSidesCount} / 3 Sides Ready
                      </span>
                    </div>
                    <h2 className="mt-1 font-serif text-2xl font-semibold text-stone-900">
                      Click Photos of Old Book (All 3 Sides) & Enter Details
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => openCameraForSide('frontPhoto')}
                    className="inline-flex items-center gap-2 rounded-lg bg-rose-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-rose-800 whitespace-nowrap shrink-0 self-start"
                  >
                    <Camera className="h-4 w-4" />
                    Open Live Camera Studio ({capturedSidesCount}/3)
                  </button>
                </div>

                {formError && (
                  <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-800" />
                    <span>{formError}</span>
                  </div>
                )}

                <form onSubmit={handleAddBookSubmit} className="mt-6 space-y-8">
                  {/* Step 1: Click Photo of Old Book from All 3 Sides */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-stone-900">
                        01. Book Photographs from All 3 Sides (Required)
                      </h3>
                      <span className="text-xs text-stone-500">
                        Use camera or upload file for each side
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                      {BOOK_SIDES.map((side) => {
                        const currentPhoto = photos[side.key];
                        return (
                          <div
                            key={side.key}
                            className="flex flex-col justify-between rounded-xl border border-stone-200 bg-[#FAF8F5] p-4"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-stone-900">
                                  {side.label}
                                </span>
                                {currentPhoto ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                    <Check className="h-3.5 w-3.5" />
                                    Captured
                                  </span>
                                ) : (
                                  <span className="text-xs text-stone-500">Required</span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-stone-500">{side.instruction}</p>

                              {/* Preview Slot */}
                              <div className="mt-3 aspect-4/3 w-full overflow-hidden rounded-lg border border-stone-200 bg-white">
                                {currentPhoto ? (
                                  <img
                                    src={currentPhoto}
                                    alt={side.label}
                                    referrerPolicy="no-referrer"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
                                    <Camera className="mb-2 h-8 w-8 text-stone-300" />
                                    <span className="text-xs font-medium text-stone-400">
                                      No {side.shortLabel} photo yet
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Capture & Upload Controls */}
                            <div className="mt-4 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => openCameraForSide(side.key)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-stone-800 whitespace-nowrap shrink-0"
                              >
                                <Camera className="h-3.5 w-3.5" />
                                Take Picture
                              </button>

                              <button
                                type="button"
                                onClick={() => fileInputRefs.current[side.key]?.click()}
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100 whitespace-nowrap shrink-0"
                              >
                                <Upload className="h-3.5 w-3.5" />
                                Upload Photo
                              </button>

                              <input
                                ref={(el) => {
                                  fileInputRefs.current[side.key] = el;
                                }}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => handleDirectSideUpload(side.key, e)}
                                className="hidden"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: Write Book Name, Book Author Name, and Contributor Name */}
                  <div className="space-y-4 border-t border-stone-200 pt-6">
                    <h3 className="text-base font-semibold text-stone-900">
                      02. Book Name & Book Author Name
                    </h3>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor="book-title-input"
                          className="block text-xs font-semibold text-stone-700"
                        >
                          Book Name (Required)
                        </label>
                        <input
                          id="book-title-input"
                          type="text"
                          required
                          maxLength={BLUEPRINT_LIMITS.BOOK_TITLE_MAX}
                          value={bookTitle}
                          onChange={(e) => setBookTitle(e.target.value)}
                          placeholder="e.g., Gitanjali / The Old Chronicles"
                          className="mt-1.5 w-full rounded-lg border border-stone-300 bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-900 focus:bg-white focus:outline-none"
                        />
                        <div className="mt-1 text-right font-mono text-[11px] tabular-nums text-stone-400">
                          {bookTitle.length}/{BLUEPRINT_LIMITS.BOOK_TITLE_MAX}
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="book-author-input"
                          className="block text-xs font-semibold text-stone-700"
                        >
                          Book Author Name (Required)
                        </label>
                        <input
                          id="book-author-input"
                          type="text"
                          required
                          maxLength={BLUEPRINT_LIMITS.BOOK_AUTHOR_MAX}
                          value={bookAuthor}
                          onChange={(e) => setBookAuthor(e.target.value)}
                          placeholder="e.g., Rabindranath Tagore"
                          className="mt-1.5 w-full rounded-lg border border-stone-300 bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-900 focus:bg-white focus:outline-none"
                        />
                        <div className="mt-1 text-right font-mono text-[11px] tabular-nums text-stone-400">
                          {bookAuthor.length}/{BLUEPRINT_LIMITS.BOOK_AUTHOR_MAX}
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="added-by-input"
                          className="block text-xs font-semibold text-stone-700"
                        >
                          Added By (Your Name)
                        </label>
                        <input
                          id="added-by-input"
                          type="text"
                          required
                          maxLength={BLUEPRINT_LIMITS.DISPLAY_NAME_MAX}
                          value={addedByName}
                          onChange={(e) => setAddedByName(e.target.value)}
                          placeholder="Your name as contributor"
                          className="mt-1.5 w-full rounded-lg border border-stone-300 bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-900 focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="condition-note-input"
                          className="block text-xs font-semibold text-stone-700"
                        >
                          Binding / Condition Note (Optional)
                        </label>
                        <input
                          id="condition-note-input"
                          type="text"
                          maxLength={BLUEPRINT_LIMITS.BOOK_CONDITION_MAX}
                          value={conditionNote}
                          onChange={(e) => setConditionNote(e.target.value)}
                          placeholder="e.g., 1964 Hardcover, intact spine, lightly yellowed pages"
                          className="mt-1.5 w-full rounded-lg border border-stone-300 bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-900 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit Actions */}
                  <div className="flex flex-wrap items-center justify-end gap-3 border-t border-stone-200 pt-6">
                    <button
                      type="button"
                      onClick={() => setActiveOption('browse')}
                      className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50 whitespace-nowrap shrink-0"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingBook}
                      className="inline-flex items-center gap-2 rounded-lg bg-rose-900 px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-rose-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <Check className="h-4 w-4" />
                      {isSubmittingBook ? 'Saving Book to Archive...' : 'Add Book to SARAS'}
                    </button>
                  </div>
                </form>
              </section>
            )}
          </div>
        )}

        {/* 3-Side Archival Standard Guide Section */}
        <section
          id="three-side-guide"
          className="mt-16 border-t border-stone-200 pt-12"
        >
          <div className="max-w-2xl">
            <h2 className="font-serif text-2xl font-semibold text-stone-900">
              How the SARAS 3-Side Book Capture Works
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              Every old book carries its history across three physical surfaces. Capturing all
              three sides ensures readers can verify the edition, binding integrity, and cover state.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {BOOK_SIDES.map((side) => (
              <div
                key={side.key}
                className="rounded-xl border border-stone-200 bg-white p-6"
              >
                <div className="font-mono text-xs font-medium text-rose-900">
                  {side.stepNumber} · {side.shortLabel}
                </div>
                <h3 className="mt-2 font-serif text-lg font-semibold text-stone-900">
                  {side.label}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  {side.instruction}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="mt-16 border-t border-stone-200 bg-white px-6 py-6 text-xs text-stone-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <span>SARAS — Old Book 3-Side Archive & Catalog</span>
          <div className="flex items-center gap-2">
            <span>Front Cover</span>
            <span aria-hidden="true">·</span>
            <span>Book Spine</span>
            <span aria-hidden="true">·</span>
            <span>Back Cover</span>
          </div>
        </div>
      </footer>

      {/* Live Camera Modal for Taking 3-Side Book Pictures */}
      <CameraModal
        isOpen={isCameraOpen}
        initialSide={cameraInitialSide}
        photos={photos}
        onCaptureSide={handleSidePhotoCaptured}
        onClose={() => setIsCameraOpen(false)}
      />

      {/* 3-Side Book Inspection Modal */}
      <BookInspectModal
        book={inspectedBook}
        currentUserId={user?.uid}
        onClose={() => setInspectedBook(null)}
        onDelete={handleDeleteBook}
        onBuyNow={(b) => setBuyNowBook(b)}
      />

      {/* Buy Now Checkout Modal: Step 1 Exact Location -> Step 2 Phone -> Step 3 Shiprocket State & Address */}
      <BuyNowModal
        book={buyNowBook}
        currentUser={user}
        defaultCustomerName={profileName || user?.displayName || ''}
        verifiedPhone={verifiedPhone}
        onPhoneVerified={handlePhoneVerified}
        onSubmitOrder={handlePlaceBuyNowOrder}
        onClose={() => setBuyNowBook(null)}
      />
    </div>
  );
}
