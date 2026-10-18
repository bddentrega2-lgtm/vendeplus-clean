import { isNativeApp, readMobile, writeMobile, removeMobile } from "@/lib/mobile/state";

type Draft = { form: Record<string, unknown>; key: string; updatedAt: number };
export function readCheckoutDraft(slug: string): Draft | null {
  if (isNativeApp()) return readMobile<Draft | null>(`checkout_${slug}`, null);
  try { return JSON.parse(sessionStorage.getItem(`somos_checkout_${slug}`) || "null"); } catch { return null; }
}
export function writeCheckoutDraft(slug: string, draft: Draft) {
  if (isNativeApp()) { writeMobile(`checkout_${slug}`, draft); return; }
  try { sessionStorage.setItem(`somos_checkout_${slug}`, JSON.stringify(draft)); } catch { /* The current form remains usable. */ }
}
export function clearCheckoutDraft(slug: string) {
  removeMobile(`checkout_${slug}`);
  try { sessionStorage.removeItem(`somos_checkout_${slug}`); } catch { /* Optional persistence. */ }
}
