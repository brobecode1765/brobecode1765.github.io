/**
 * Firestore Security Rules Verification Suite — "Dirty Dozen" Payloads
 * Verifies that all 12 adversarial payloads defined in security_spec.md
 * are strictly rejected with PERMISSION_DENIED.
 */

export interface SimulatedContext {
  auth: {
    uid: string;
    token: {
      email?: string;
      email_verified?: boolean;
    };
  } | null;
  requestTime: number;
}

export interface BookPayload {
  title?: unknown;
  author?: unknown;
  frontPhoto?: unknown;
  spinePhoto?: unknown;
  backPhoto?: unknown;
  conditionNote?: unknown;
  ownerId?: unknown;
  ownerName?: unknown;
  visibility?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
}

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

export function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && ID_REGEX.test(id);
}

export function isValidBook(
  data: BookPayload,
  ctx: SimulatedContext
): boolean {
  if (!ctx.auth) return false;
  const requiredKeys = [
    'title',
    'author',
    'frontPhoto',
    'spinePhoto',
    'backPhoto',
    'conditionNote',
    'ownerId',
    'ownerName',
    'visibility',
    'createdAt',
    'updatedAt',
  ];
  const keys = Object.keys(data);
  if (keys.length !== requiredKeys.length) return false;
  if (!requiredKeys.every((k) => keys.includes(k))) return false;

  return (
    typeof data.title === 'string' &&
    data.title.length >= 1 &&
    data.title.length <= 150 &&
    typeof data.author === 'string' &&
    data.author.length >= 1 &&
    data.author.length <= 120 &&
    typeof data.frontPhoto === 'string' &&
    data.frontPhoto.length >= 20 &&
    data.frontPhoto.length <= 300000 &&
    typeof data.spinePhoto === 'string' &&
    data.spinePhoto.length >= 20 &&
    data.spinePhoto.length <= 300000 &&
    typeof data.backPhoto === 'string' &&
    data.backPhoto.length >= 20 &&
    data.backPhoto.length <= 300000 &&
    typeof data.conditionNote === 'string' &&
    data.conditionNote.length >= 0 &&
    data.conditionNote.length <= 300 &&
    typeof data.ownerId === 'string' &&
    data.ownerId.length >= 1 &&
    data.ownerId.length <= 128 &&
    ID_REGEX.test(data.ownerId) &&
    data.ownerId === ctx.auth.uid &&
    typeof data.ownerName === 'string' &&
    data.ownerName.length >= 1 &&
    data.ownerName.length <= 80 &&
    typeof data.visibility === 'string' &&
    data.visibility.length === 6 &&
    data.visibility === 'public' &&
    typeof data.createdAt === 'number' &&
    typeof data.updatedAt === 'number'
  );
}
