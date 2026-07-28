const CUSTOMER_PROFILE_KEY = "somos_customer_profile_v1";

export type CustomerBrowserProfile = {
  name: string;
  phone: string;
  updatedAt: string;
};

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

export function getCustomerBrowserProfile(): CustomerBrowserProfile | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CUSTOMER_PROFILE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const name = cleanText(parsed?.name, 120);
    const phone = cleanText(parsed?.phone, 40);
    if (!name || !phone) return null;

    return {
      name,
      phone,
      updatedAt: cleanText(parsed?.updatedAt, 40),
    };
  } catch {
    return null;
  }
}

export function saveCustomerBrowserProfile(name: string, phone: string) {
  if (typeof window === "undefined") return false;

  const profile: CustomerBrowserProfile = {
    name: cleanText(name, 120),
    phone: cleanText(phone, 40),
    updatedAt: new Date().toISOString(),
  };

  if (!profile.name || !profile.phone) return false;

  try {
    window.localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

export function clearCustomerBrowserProfile() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(CUSTOMER_PROFILE_KEY);
  } catch {
    // Algunos navegadores pueden bloquear el almacenamiento local.
  }
}
