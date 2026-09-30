begin;

alter table public.buyer_store_reviews add column observation text;
alter table public.buyer_store_reviews add constraint buyer_review_observation_length
  check (observation is null or char_length(observation) <= 500);

-- Keep the old RPC compatible; reuse its ownership, completion and merchant checks.
create function public.save_buyer_store_review_with_observation(
  p_order_id uuid, p_buyer_id uuid, p_rating integer, p_observation text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if char_length(p_observation) > 500 then raise exception 'Invalid observation'; end if;
  perform public.save_buyer_store_review(p_order_id, p_buyer_id, p_rating);
  update public.buyer_store_reviews
    set observation = nullif(btrim(p_observation, E' \t\n\r'), '')
    where order_id = p_order_id and buyer_user_id = p_buyer_id;
end;
$$;
revoke all on function public.save_buyer_store_review_with_observation(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.save_buyer_store_review_with_observation(uuid, uuid, integer, text) to service_role;

commit;
