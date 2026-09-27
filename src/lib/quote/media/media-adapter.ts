/**
 * Media boundary (spec sections 20–21).
 *
 * There is no object storage backend yet, so this only validates and
 * creates a LOCAL, in-memory preview (a `blob:` object URL) — the file's
 * bytes are never uploaded anywhere and never persisted to localStorage.
 * Only lightweight metadata (filename, size, MIME type) is persisted with
 * the quote state, never the file itself.
 *
 * Production checklist for whoever replaces this with a real adapter
 * (spec section 21 — not implemented here):
 *   - Upload goes to private object storage, not a public bucket.
 *   - Server re-validates type/size — client MIME/extension checks below
 *     are a UX nicety, never trusted as the real check.
 *   - Server generates the stored filename/key — never trust a
 *     client-supplied filename for the storage path.
 *   - Access to the stored file uses signed, time-limited URLs.
 *   - Virus/content scanning before the file is considered usable.
 */

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

export type MediaValidationError = "invalid_type" | "too_large";

export function validateFile(file: File): MediaValidationError | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) return "invalid_type";
  if (file.size > MAX_FILE_SIZE_BYTES) return "too_large";
  return null;
}

export function mediaErrorMessage(error: MediaValidationError): string {
  switch (error) {
    case "invalid_type":
      return "Please upload a JPG, PNG, or WEBP image.";
    case "too_large":
      return "That photo is too large — please choose one under 8MB.";
  }
}
