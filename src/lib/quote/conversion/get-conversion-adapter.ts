import type { ConversionAdapter } from "./conversion-adapter";
import { NoopConversionAdapter } from "./noop-conversion-adapter";

let instance: ConversionAdapter | null = null;

export function getConversionAdapter(): ConversionAdapter {
  if (!instance) instance = new NoopConversionAdapter();
  return instance;
}
