-- Split full statistics and catalogue expansion into independent permanent achievements.

insert into public.store_achievement_unlocks (store_id, achievement_key, source)
select id, 'orders_100_product_limit', 'inherited'
from public.stores
on conflict (store_id, achievement_key) do nothing;
