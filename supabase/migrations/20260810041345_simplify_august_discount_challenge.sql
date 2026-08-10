update public.monthly_challenges
set
  title = 'Activa un descuento y destaca tu producto',
  description = 'Activa un descuento nuevo en cualquier producto durante agosto.',
  reward_label = 'Producto destacado durante 7 días en el Marketplace',
  updated_at = now()
where challenge_key = 'august_2026_discount_first_sale';
