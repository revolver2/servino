import { NextResponse } from "next/server";

/**
 * Closed set of safe, customer-facing error codes (spec section 40).
 * API routes never leak stack traces or raw exception messages to the
 * client — every failure maps to one of these.
 */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_FUNNEL_STATE"
  | "PRICING_UNAVAILABLE"
  | "LEAD_SAVE_FAILED"
  | "RATE_LIMITED"
  | "BOOKING_INTENT_FAILED"
  | "NOT_FOUND"
  // Session G
  | "PAYMENTS_UNAVAILABLE"
  | "PAYMENT_CREATE_FAILED"
  | "PAYMENT_CAPTURE_FAILED"
  | "PAYMENT_DECLINED"
  | "CONFLICT"
  | "TOKEN_INVALID"
  // Session H — operational kill switches (spec sections 50–53)
  | "BOOKINGS_PAUSED";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_FUNNEL_STATE: 409,
  PRICING_UNAVAILABLE: 503,
  LEAD_SAVE_FAILED: 500,
  RATE_LIMITED: 429,
  BOOKING_INTENT_FAILED: 500,
  NOT_FOUND: 404,
  PAYMENTS_UNAVAILABLE: 503,
  PAYMENT_CREATE_FAILED: 502,
  PAYMENT_CAPTURE_FAILED: 502,
  PAYMENT_DECLINED: 402,
  CONFLICT: 409,
  TOKEN_INVALID: 400,
  BOOKINGS_PAUSED: 503,
};

export function apiError(code: ApiErrorCode, message: string, details?: unknown) {
  return NextResponse.json({ ok: false, code, message, details }, { status: STATUS_BY_CODE[code] });
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}
