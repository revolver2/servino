import type { LeadAdapter } from "./lead-adapter";
import { ApiLeadAdapter } from "./api-lead-adapter";

let instance: LeadAdapter | null = null;

/**
 * B2: always the real backend-calling adapter (spec section 7 — "replace
 * production use of DevLocalLeadAdapter"). `DevLocalLeadAdapter` remains
 * in the codebase as a fully-functional local/offline reference
 * implementation but is no longer selected here by default.
 */
export function getLeadAdapter(): LeadAdapter {
  if (!instance) instance = new ApiLeadAdapter();
  return instance;
}
