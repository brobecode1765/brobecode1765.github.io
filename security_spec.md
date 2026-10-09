# SARAS — Security Specification & Red Team Audit (Phase 0 – Phase 5)

## 1. Data Invariants & Master Source of Truth

1. **Identity & Ownership Invariant**: Every `UserProfile` document at `/users/{userId}` must have `uid == userId == request.auth.uid`. Every `Book` document at `/books/{bookId}` must have `ownerId == request.auth.uid` and a corresponding existing user profile at `/users/{ownerId}`.
2. **Verified Contributor Invariant**: All write operations (`create`, `update`, `delete`) require `request.auth != null && request.auth.token.email_verified == true`.
3. **3-Side Photographic Completeness Invariant**: A `Book` cannot exist without all three side photographs (`frontPhoto`, `spinePhoto`, `backPhoto`), each bounded between `20` and `300,000` characters, along with `title` (`1..150` chars) and `author` (`1..120` chars).
4. **PII Isolation Invariant**: `/users/{userId}` stores strictly non-PII public archivist metadata (`uid`, `displayName`, `createdAt`, `updatedAt`). No emails, phone numbers, or physical addresses are stored in Firestore.
5. **Temporal Integrity & Immortal Fields Invariant**: `createdAt` and `updatedAt` must equal `request.time` on creation. On update, `createdAt`, `uid`, and `ownerId` are strictly immutable, and `updatedAt` must equal `request.time`.
6. **Query Enforcer Invariant**: `allow list` on `/books/{bookId}` never allows blanket reads; it explicitly evaluates `resource.data.visibility == 'public' || resource.data.ownerId == request.auth.uid`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

### Payload 1: Unverified Email Spoof Write (Identity Spoofing)
```json
{
  "auth": { "uid": "user_123", "token": { "email": "spoof@example.com", "email_verified": false } },
  "path": "/books/book_001",
  "op": "create",
  "data": {
    "title": "The Old Chronicles",
    "author": "A. E. Vance",
    "frontPhoto": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
    "spinePhoto": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
    "backPhoto": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
    "conditionNote": "Fine leather binding",
    "ownerId": "user_123",
    "ownerName": "Spoofer",
    "visibility": "public"
  }
}
```
*Expected Result*: `PERMISSION_DENIED` (`request.auth.token.email_verified == true` check fails).

### Payload 2: Cross-User Book Impersonation (Owner Mismatch)
```json
{
  "auth": { "uid": "attacker_99", "token": { "email_verified": true } },
  "path": "/books/book_002",
  "op": "create",
  "data": {
    "title": "Botany Illustrated",
    "author": "C. Linnaeus",
    "frontPhoto": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
    "spinePhoto": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
    "backPhoto": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
    "conditionNote": "",
    "ownerId": "victim_01",
    "ownerName": "Victim Name",
    "visibility": "public"
  }
}
```
*Expected Result*: `PERMISSION_DENIED` (`data.ownerId == request.auth.uid` check fails).

### Payload 3: Orphaned Book Creation Without UserProfile (Relational Sync Failure)
```json
{
  "auth": { "uid": "ghost_user", "token": { "email_verified": true } },
  "path": "/books/book_003",
  "op": "create",
  "data": {
    "title": "Histories & Tales",
    "author": "H. G. Wells",
    "frontPhoto": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
    "spinePhoto": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
    "backPhoto": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
    "conditionNote": "1748 Edition",
    "ownerId": "ghost_user",
    "ownerName": "Ghost",
    "visibility": "public"
  }
}
```
*Expected Result*: `PERMISSION_DENIED` (`exists(/databases/$(database)/documents/users/$(incoming().ownerId))` check fails).

### Payload 4: Shadow Field Injection on Book Create (Ghost Field Attack)
```json
{
  "auth": { "uid": "user_123", "token": { "email_verified": true } },
  "path": "/books/book_004",
  "op": "create",
  "data": {
    "title": "Vintage Poems",
    "author": "E. Dickinson",
    "frontPhoto": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
    "spinePhoto": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
    "backPhoto": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
    "conditionNote": "",
    "ownerId": "user_123",
    "ownerName": "Archivist",
    "visibility": "public",
    "isFeaturedAdmin": true
  }
}
```
*Expected Result*: `PERMISSION_DENIED` (`data.keys().hasOnly(...)` rejects `isFeaturedAdmin`).

### Payload 5: Missing 3rd Side Photo (Incomplete 3-Side Book Capture)
```json
{
  "auth": { "uid": "user_123", "token": { "email_verified": true } },
  "path": "/books/book_005",
  "op": "create",
  "data": {
    "title": "Incomplete Book",
    "author": "Unknown",
    "frontPhoto": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
    "spinePhoto": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
    "backPhoto": "",
    "conditionNote": "",
    "ownerId": "user_123",
    "ownerName": "Archivist",
    "visibility": "public"
  }
}
```
*Expected Result*: `PERMISSION_DENIED` (`backPhoto.size() >= 20` check fails).

### Payload 6: Path ID Poisoning (Regex & Length Violation)
```json
{
  "auth": { "uid": "user_123", "token": { "email_verified": true } },
  "path": "/books/invalid$id!with@special#chars",
  "op": "create",
  "data": { "title": "Valid", "author": "Valid" }
}
```
*Expected Result*: `PERMISSION_DENIED` (`isValidId(bookId)` regex check fails).

### Payload 7: Immortal Field Mutation (`ownerId` or `createdAt` Tampering on Update)
```json
{
  "auth": { "uid": "user_123", "token": { "email_verified": true } },
  "path": "/books/book_001",
  "op": "update",
  "data": {
    "ownerId": "another_user_456"
  }
}
```
*Expected Result*: `PERMISSION_DENIED` (`incoming().ownerId == existing().ownerId` and `affectedKeys().hasOnly(...)` fail).

### Payload 8: Update-Gap Value Poisoning (Oversized Title on Update)
```json
{
  "auth": { "uid": "user_123", "token": { "email_verified": true } },
  "path": "/books/book_001",
  "op": "update",
  "data": {
    "title": "A_200_CHARACTER_STRING_EXCEEDING_THE_150_CHAR_MAX_LIMIT_DEFINED_IN_BLUEPRINT..."
  }
}
```
*Expected Result*: `PERMISSION_DENIED` (`isValidBook(incoming())` wraps the entire `allow update` block and rejects `title.size() > 150`).

### Payload 9: Client-Forged Future Timestamp (Temporal Integrity Violation)
```json
{
  "auth": { "uid": "user_123", "token": { "email_verified": true } },
  "path": "/books/book_009",
  "op": "create",
  "data": {
    "createdAt": "2099-01-01T00:00:00Z"
  }
}
```
*Expected Result*: `PERMISSION_DENIED` (`incoming().createdAt == request.time` fails).

### Payload 10: Unauthorized Book Deletion by Non-Owner
```json
{
  "auth": { "uid": "attacker_99", "token": { "email_verified": true } },
  "path": "/books/book_001",
  "op": "delete"
}
```
*Expected Result*: `PERMISSION_DENIED` (`existing().ownerId == request.auth.uid` fails).

### Payload 11: Self-Assigned Privilege Escalation in UserProfile
```json
{
  "auth": { "uid": "user_123", "token": { "email_verified": true } },
  "path": "/users/user_123",
  "op": "create",
  "data": {
    "uid": "user_123",
    "displayName": "Archivist",
    "role": "admin"
  }
}
```
*Expected Result*: `PERMISSION_DENIED` (`isValidUserProfile` `hasOnly` rejects `role`).

### Payload 12: Unconstrained List Scrape Without Visibility or Owner Filter
```json
{
  "auth": null,
  "path": "/books",
  "op": "list"
}
```
*Expected Result*: `PERMISSION_DENIED` (`isSignedIn()` and `existing().visibility == 'public' || existing().ownerId == request.auth.uid` enforced).

---

## 3. Phase 5 Red Team Conflict Report

| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning | `isValid[Entity]` in Update | Value Poisoning | Audit Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/users/{userId}` | Blocked (`uid == request.auth.uid && userId == request.auth.uid`) | N/A (Immutable `uid`, `createdAt`) | Blocked (`isValidId`, `displayName <= 80`) | Present at top of `allow update` | Blocked (`isValidUserProfile(incoming())`) | **PASS** |
| `/books/{bookId}` | Blocked (`ownerId == request.auth.uid` + `exists(/users/$(ownerId))`) | Blocked (`visibility == 'public'` fixed, immutable `ownerId`, `createdAt`) | Blocked (`isValidId`, `photo <= 300000`, `title <= 150`) | Present at top of `allow update` | Blocked (`isValidBook(incoming())`) | **PASS** |
