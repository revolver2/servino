import type { ConversionAdapter, ConversionEvent } from "./conversion-adapter";

/**
 * No-op development implementation. Real server-side Meta/Google
 * conversion delivery is out of scope for B1 (spec section 15) — this
 * just proves the call site and boundary exist.
 */
export class NoopConversionAdapter implements ConversionAdapter {
  sendConversion(event: ConversionEvent): void {
    if (process.env.NODE_ENV !== "production") {
      console.info("[conversion:noop]", event.name, event.eventId);
    }
  }
}
