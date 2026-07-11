-- Add issuer bank and payment date to subscription payment requests.

alter table public.store_subscription_payments
  add column if not exists payment_bank text,
  add column if not exists paid_at date;
