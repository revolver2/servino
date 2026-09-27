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
import { readJson, writeJson } from "../storage";
import { getPricingAdapter } from "../pricing/get-pricing-adapter";
import { totalAreaM2 } from "../units";
import { getEnabledServices } from "@/lib/services-data";

type LocalExtras = {
  contact?: ContactDetails;
  timing?: TimingValue;
  bookingIntentId?: string;
  lastPrice?: PriceResult;
  paymentStatus?: string;
  paymentProviderOrderId?: string;
};

/**
 * ============================================================================
 * DEVELOPMENT-ONLY LEAD ADAPTER
 * ============================================================================
 * Backed by localStorage in the visitor's own browser. This is NOT a
 * database, is NOT visible to Servino staff, is NOT durable across
 * devices/browsers, and must never be described as "lead persistence" in
 * any product or admin context.
 *
 * As of B2, `getLeadAdapter()` no longer selects this by default — the
 * real `ApiLeadAdapter` is the production path (spec section 7). This
 * remains as a fully-working offline/local reference implementation
 * ("development fallback may remain only where explicitly appropriate" —
 * spec section 7), e.g. for running the frontend with no database at all.
 * ============================================================================
 */
export class DevLocalLeadAdapter implements LeadAdapter {
  private keyFor(sessionId: string): string {
    return `servino_dev_lead_${sessionId}`;
  }

  private extrasKeyFor(sessionId: string): string {
    return `servino_dev_lead_extras_${sessionId}`;
  }

  private readExtras(sessionId: string): LocalExtras {
    return readJson<LocalExtras>(this.extrasKeyFor(sessionId)) ?? {};
  }

  private writeExtras(sessionId: string, extras: LocalExtras): void {
    writeJson(this.extrasKeyFor(sessionId), extras);
  }

  async createLead(sessionId: string, attribution: Attribution): Promise<void> {
    const existing = await this.getLeadBySession(sessionId);
    if (existing) return;
    void attribution; // Actual initial state is written via saveQuoteProgress.
  }

  async updateLead(sessionId: string, patch: Partial<QuoteState>): Promise<void> {
    const current = await this.getLeadBySession(sessionId);
    if (!current) return;
    writeJson(this.keyFor(sessionId), { ...current, ...patch });
  }

  async saveQuoteProgress(sessionId: string, state: QuoteState): Promise<void> {
    writeJson(this.keyFor(sessionId), state);
  }

  async attachMediaReference(sessionId: string, media: PhotoState): Promise<void> {
    await this.updateLead(sessionId, { photo: media });
  }

  async saveContactDetails(sessionId: string, contact: ContactDetails): Promise<void> {
    const extras = this.readExtras(sessionId);
    this.writeExtras(sessionId, { ...extras, contact });
  }

  async markPriceViewed(sessionId: string): Promise<PriceResult> {
    const current = await this.getLeadBySession(sessionId);
    if (!current || !current.serviceSlug || !current.location.citySlug || !current.materialOwnership) {
      return {
        status: "unavailable",
        currency: "CAD",
        serviceSlug: current?.serviceSlug ?? "",
        serviceName: "",
        totalAreaM2: 0,
        materialOwnership: current?.materialOwnership ?? "INSTALL_ONLY",
        subtotalMinor: 0,
        taxMinor: 0,
        taxLabel: "",
        totalMinor: 0,
        pricingSource: "unavailable",
        generatedAt: new Date().toISOString(),
        unavailableReason: "Project details are incomplete.",
      };
    }

    const service = getEnabledServices().find((s) => s.slug === current.serviceSlug);
    const result = await getPricingAdapter().calculate({
      serviceSlug: current.serviceSlug,
      serviceName: service?.name ?? current.serviceSlug,
      citySlug: current.location.citySlug,
      totalAreaM2: totalAreaM2(current.measurements),
      materialOwnership: current.materialOwnership,
    });

    writeJson(this.keyFor(sessionId), { ...current, price: result, updatedAt: new Date().toISOString() });
    const extras = this.readExtras(sessionId);
    this.writeExtras(sessionId, { ...extras, lastPrice: result });
    return result;
  }

  async saveTiming(sessionId: string, value: TimingValue): Promise<void> {
    const extras = this.readExtras(sessionId);
    this.writeExtras(sessionId, { ...extras, timing: value });
  }

  async markBookingIntent(sessionId: string): Promise<{ bookingIntentId: string }> {
    const extras = this.readExtras(sessionId);
    const bookingIntentId = extras.bookingIntentId ?? `dev_booking_${Math.random().toString(36).slice(2, 12)}`;
    this.writeExtras(sessionId, { ...extras, bookingIntentId });
    return { bookingIntentId };
  }

  async getConfirmation(sessionId: string): Promise<ConfirmationResult> {
    const current = await this.getLeadBySession(sessionId);
    const extras = this.readExtras(sessionId);
    if (!current || !extras.bookingIntentId || !extras.lastPrice || extras.lastPrice.status !== "ok") {
      return { status: "not_found" };
    }
    return {
      status: "confirmed",
      summary: {
        serviceName: extras.lastPrice.serviceName,
        totalAreaM2: extras.lastPrice.totalAreaM2,
        materialOwnership: extras.lastPrice.materialOwnership,
        styleId: current.style,
        timing: extras.timing ?? null,
        currency: extras.lastPrice.currency,
        totalMinor: extras.lastPrice.totalMinor,
      },
      paymentStatus: extras.paymentStatus ?? null,
    };
  }

  async getLeadBySession(sessionId: string): Promise<QuoteState | null> {
    return readJson<QuoteState>(this.keyFor(sessionId));
  }

  async getPaymentStatus(sessionId: string): Promise<PaymentStatusResult> {
    const extras = this.readExtras(sessionId);
    if (!extras.bookingIntentId || !extras.lastPrice || extras.lastPrice.status !== "ok") {
      return { status: "not_found" };
    }
    return {
      status: "found",
      paymentsEnabled: true,
      amount: {
        currency: extras.lastPrice.currency,
        subtotalMinor: extras.lastPrice.subtotalMinor,
        taxMinor: extras.lastPrice.taxMinor,
        taxLabel: extras.lastPrice.taxLabel,
        totalMinor: extras.lastPrice.totalMinor,
      },
      payment: { status: extras.paymentStatus ?? "PENDING", providerOrderId: extras.paymentProviderOrderId ?? null },
    };
  }

  async createPaymentOrder(sessionId: string, testScenario?: TestPaymentScenario): Promise<CreatePaymentOrderResult> {
    const extras = this.readExtras(sessionId);
    if (extras.paymentStatus === "CAPTURED") return { alreadyCaptured: true, status: "CAPTURED" };

    if (testScenario === "OUTAGE") {
      throw new LeadAdapterError("PAYMENT_CREATE_FAILED", "Could not start payment.");
    }

    const providerOrderId = extras.paymentProviderOrderId ?? `dev_order_${Math.random().toString(36).slice(2, 12)}`;
    this.writeExtras(sessionId, {
      ...extras,
      paymentStatus: testScenario === "DECLINE" ? "DECLINE_PENDING" : "CREATED",
      paymentProviderOrderId: providerOrderId,
    });
    return { providerOrderId, amountMinor: extras.lastPrice?.totalMinor ?? 0, currency: extras.lastPrice?.currency ?? "CAD" };
  }

  async capturePaymentOrder(sessionId: string, _providerOrderId: string): Promise<CapturePaymentOrderResult> {
    const extras = this.readExtras(sessionId);
    if (extras.paymentStatus === "DECLINE_PENDING") {
      this.writeExtras(sessionId, { ...extras, paymentStatus: "FAILED" });
      throw new LeadAdapterError("PAYMENT_DECLINED", "Your payment was declined.");
    }
    this.writeExtras(sessionId, { ...extras, paymentStatus: "CAPTURED" });
    return { captured: true };
  }
}
