-- Register Entrega2 as a transport agency example instead of a direct panel provider.

with upserted_agency as (
  insert into public.transport_agencies (
    name,
    slug,
    contact_name,
    contact_email,
    contact_phone,
    whatsapp_phone,
    modality,
    pricing_type,
    status,
    is_active,
    coverage_notes,
    updated_at
  )
  values (
    'Entrega2',
    'entrega2',
    'Hector Moreno',
    'entregados.venezuela@gmail.com',
    '04124600742',
    '04124600742',
    'open',
    'manual',
    'active',
    true,
    'Agencia registrada como ejemplo para la red de transporte Vende+.',
    now()
  )
  on conflict (slug) do update set
    name = excluded.name,
    contact_name = excluded.contact_name,
    contact_email = excluded.contact_email,
    contact_phone = excluded.contact_phone,
    whatsapp_phone = excluded.whatsapp_phone,
    modality = excluded.modality,
    pricing_type = excluded.pricing_type,
    status = excluded.status,
    is_active = excluded.is_active,
    coverage_notes = excluded.coverage_notes,
    updated_at = now()
  returning id
)
insert into public.transport_agency_rates (
  agency_id,
  flat_fee_usd,
  manual_quote_message,
  is_active,
  updated_at
)
select
  id,
  0,
  'Entrega2 confirma la tarifa final por WhatsApp.',
  true,
  now()
from upserted_agency
on conflict (agency_id) do update set
  flat_fee_usd = excluded.flat_fee_usd,
  manual_quote_message = excluded.manual_quote_message,
  is_active = true,
  updated_at = now();

insert into public.transport_agency_users (
  agency_id,
  email,
  role
)
select
  id,
  'entregados.venezuela@gmail.com',
  'owner'
from public.transport_agencies
where slug = 'entrega2'
on conflict (agency_id, email) do update set
  role = excluded.role;
