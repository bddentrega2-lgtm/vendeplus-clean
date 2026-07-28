type SubscriptionState = {
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  next_payment_due_at?: string | null;
};

const CARACAS_TIME_ZONE = "America/Caracas";

function caracasDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CARACAS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value || "1970";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";

  return `${year}-${month}-${day}`;
}

export function getSubscriptionCutoffDate(row?: SubscriptionState | null) {
  if (!row) return null;
  return row.next_payment_due_at || row.subscription_ends_at || row.trial_ends_at || null;
}

export function getDateKey(value?: string | null) {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function isDateBeforeToday(value?: string | null, now = new Date()) {
  const dateKey = getDateKey(value);
  if (!dateKey) return false;
  return dateKey < caracasDateKey(now);
}

export function isSubscriptionPastDue(row?: SubscriptionState | null, now = new Date()) {
  if (!row) return false;
  const status = String(row.subscription_status || "").toLowerCase();
  if (["past_due", "expired", "paused", "cancelled"].includes(status)) return true;
  return isDateBeforeToday(getSubscriptionCutoffDate(row), now);
}
