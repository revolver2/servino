import { NextResponse } from "next/server";

/**
 * Closed set of safe professional-facing error codes — its own union,
 * kept separate from the admin (`admin-api-response.ts`) and customer
 * (`api-response.ts`) response modules, matching this codebase's existing
 * one-module-per-trust-boundary convention (D032).
 */
export type ProApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "RATE_LIMITED"
  | "SERVER_ERROR";

const STATUS_BY_CODE: Record<ProApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
};

export function proApiError(code: ProApiErrorCode, message: string, details?: unknown) {
  return NextResponse.json({ ok: false, code, message, details }, { status: STATUS_BY_CODE[code] });
}

export function proApiOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}
