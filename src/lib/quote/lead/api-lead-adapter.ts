import type { Attribution, PhotoState, PriceResult, QuoteState } from "@/types/quote";
import type {
  CapturePaymentOrderResult,
  ConfirmationResult,
  ContactDetails,
  CreatePaymentOrderResult,
  PaymentStatusResult,
  TestPaymentScenario,
  TimingValue,
} from "@/types/lead";
import { LeadAdapterError } from "@/types/lead";
import type { LeadAdapter } from "./lead-adapter";
import { DevLocalLeadAdapter } from "./dev-local-lead-adapter";
import { totalAreaM2 } from "../units";

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new LeadAdapterError("NETWORK_ERROR", "Could not reach the server. Check your connection and try again.");
  }

  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!envelope || !envelope.ok) {
    throw new LeadAdapterError(envelope?.code ?? "UNKNOWN_ERROR", envelope?.message ?? "Something went wrong.");
  }
  return envelope.data;
}

async function getJson<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path);
  } catch {
    throw new LeadAdapterError("NETWORK_ERROR", "Could not reach the server.");
  }
  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!envelope || !envelope.ok) {
    throw new LeadAdapterError(envelope?.code ?? "UNKNOWN_ERROR", envelope?.message ?? "Something went wrong.");
  }
  return envelope.data;
}

/**
 * Real, backend-calling `LeadAdapter` (spec section 7) — the production
 * path as of B2. Composes a `DevLocalLeadAdapter` purely as a client-side
 * cache for full-fidelity funnel resume (per-wall measurements, photo
 * preview reference) — the durable, authoritative record lives in
 * PostgreSQL via the `/api/lead/*` routes. See docs/DATA_MODEL.md for why
 * these aren't the same data: the server only needs the aggregate total
 * area for pricing/booking, not a wall-by-wall breakdown.
 */
export class ApiLeadAdapter implements LeadAdapter {
  private local = new DevLocalLeadAdapter();

  private async postProgress(sessionId: string, state: QuoteState, step: QuoteState["currentStep"]) {
    await postJson("/api/lead/progress", {
      sessionId,
      attribution: state.attribution,
      serviceSlug: state.serviceSlug ?? undefined,
      postalCode: state.location.postalCode ?? undefined,
      measurementUnit: state.measurements.unit.toUpperCase() as "METRIC" | "IMPERIAL",
      totalAreaM2: totalAreaM2(state.measurements) || undefined,
      styleId: state.style ?? undefined,
      materialOwnership: state.materialOwnership ?? undefined,
      currentStep: step.toUpperCase(),
    });
  }

  async createLead(sessionId: string, attribution: Attribution): Promise<void> {
    await this.local.createLead(sessionId, attribution);
    await postJson("/api/lead/progress", {
      sessionId,
      attribution,
      currentStep: "PROJECT",
    });
  }

  async updateLead(sessionId: string, patch: Partial<QuoteState>): Promise<void> {
    await this.local.updateLead(sessionId, patch);
  }

  async saveQuoteProgress(sessionId: string, state: QuoteState): Promise<void> {
    await this.local.saveQuoteProgress(sessionId, state);
    try {
      await this.postProgress(sessionId, state, state.currentStep);
    } catch (err) {
      // Local cache already has this step's data — surface the failure
      // for callers that care (none currently block on it), but don't
      // throw and break the client-side funnel over a transient network
      // blip on an intermediate save. Steps that MUST succeed server-side
      // (contact, timing, booking intent) use their own dedicated methods
      // below, which do throw.
      console.error("[ApiLeadAdapter] saveQuoteProgress failed to reach server", err);
    }
  }

  async attachMediaReference(sessionId: string, media: PhotoState): Promise<void> {
    // No durable photo persistence in B2 (spec section 29) — local cache only.
    await this.local.attachMediaReference(sessionId, media);
  }

  async saveContactDetails(sessionId: string, contact: ContactDetails): Promise<void> {
    await postJson("/api/lead/contact", {
      sessionId,
      firstName: contact.firstName,
      email: contact.email,
      phone: contact.phone,
      honeypot: contact.honeypot,
      formRenderedAt: contact.formRenderedAt,
    });
  }

  async markPriceViewed(sessionId: string): Promise<PriceResult> {
    try {
      const result = await postJson<{ snapshotId: string; price: PriceResult }>("/api/lead/price", { sessionId });
      return result.price;
    } catch (err) {
      // Pricing being unavailable (or the funnel state being invalid) is
      // an expected, handle-able outcome, not an exceptional one — return
      // it through the same PriceResult shape PriceStep already renders a
      // failure state for (spec section 41), rather than throwing.
      const message = err instanceof LeadAdapterError ? err.message : "Pricing is temporarily unavailable.";
      return {
        status: "unavailable",
        currency: "CAD",
        serviceSlug: "",
        serviceName: "",
        totalAreaM2: 0,
        materialOwnership: "INSTALL_ONLY",
        subtotalMinor: 0,
        taxMinor: 0,
        taxLabel: "",
        totalMinor: 0,
        pricingSource: "unavailable",
        generatedAt: new Date().toISOString(),
        unavailableReason: message,
      };
    }
  }

  async saveTiming(sessionId: string, value: TimingValue): Promise<void> {
    await postJson("/api/lead/timing", { sessionId, value });
  }

  async markBookingIntent(sessionId: string): Promise<{ bookingIntentId: string }> {
    return postJson("/api/lead/booking-intent", { sessionId });
  }

  async getConfirmation(sessionId: string): Promise<ConfirmationResult> {
    try {
      return await getJson<ConfirmationResult>(`/api/lead/confirmation?sessionId=${encodeURIComponent(sessionId)}`);
    } catch {
      return { status: "error" };
    }
  }

  async getLeadBySession(sessionId: string): Promise<QuoteState | null> {
    return this.local.getLeadBySession(sessionId);
  }

  async getPaymentStatus(sessionId: string): Promise<PaymentStatusResult> {
    try {
      return await getJson<PaymentStatusResult>(`/api/lead/payment?sessionId=${encodeURIComponent(sessionId)}`);
    } catch {
      return { status: "not_found" };
    }
  }

  async createPaymentOrder(sessionId: string, testScenario?: TestPaymentScenario): Promise<CreatePaymentOrderResult> {
    return postJson("/api/lead/payment/create-order", { sessionId, testScenario });
  }

  async capturePaymentOrder(sessionId: string, providerOrderId: string): Promise<CapturePaymentOrderResult> {
    return postJson("/api/lead/payment/capture-order", { sessionId, providerOrderId });
  }
}
