import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

/* CRITICAL: Must pass firestoreDatabaseId from firebase-applet-config.json */
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Validate connection to Firestore on application boot
 */
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Verbatim validation constants synced with firebase-blueprint.json & firestore.rules
 */
export const BLUEPRINT_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_\-]+$/,
  PHONE_PATTERN: /^\+?[0-9\s\-()]+$/,
  PHONE_MIN: 7,
  PHONE_MAX: 20,
  UID_MAX_LENGTH: 128,
  DISPLAY_NAME_MIN: 1,
  DISPLAY_NAME_MAX: 80,
  BOOK_TITLE_MIN: 1,
  BOOK_TITLE_MAX: 150,
  BOOK_AUTHOR_MIN: 1,
  BOOK_AUTHOR_MAX: 120,
  BOOK_PHOTO_MIN: 20,
  BOOK_PHOTO_MAX: 300000,
  BOOK_CONDITION_MAX: 300,
  VISIBILITY_PUBLIC: 'public' as const,
  ADMIN_EMAIL: 'brobecode1765@gmail.com' as const,
  ORDER_EXACT_LOCATION_MIN: 3,
  ORDER_EXACT_LOCATION_MAX: 250,
  ORDER_ADDRESS_MIN: 5,
  ORDER_ADDRESS_MAX: 250,
  ORDER_LANDMARK_MAX: 300,
  ORDER_CITY_MIN: 2,
  ORDER_CITY_MAX: 80,
  ORDER_STATE_MIN: 2,
  ORDER_STATE_MAX: 80,
  ORDER_PINCODE_MIN: 4,
  ORDER_PINCODE_MAX: 12,
  ORDER_PINCODE_PATTERN: /^[0-9A-Za-z\s\-]+$/,
};
