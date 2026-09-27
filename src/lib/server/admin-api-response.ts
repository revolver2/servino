import { NextResponse } from "next/server";

/**
 * Closed set of safe admin-facing error codes — kept separate from the
 * customer-funnel `ApiErrorCode` union (`api-response.ts`) since admin and
 * customer routes are different trust boundaries with different failure
 * modes (spec section 40's "safe error messages" principle, extended).
 */
export type AdminApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "RATE_LIMITED"
  | "SERVER_ERROR";

const STATUS_BY_CODE: Record<AdminApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
};

export function adminApiError(code: AdminApiErrorCode, message: string, details?: unknown) {
  return NextResponse.json({ ok: false, code, message, details }, { status: STATUS_BY_CODE[code] });
}

export function adminApiOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}
