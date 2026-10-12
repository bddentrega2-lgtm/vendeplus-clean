create or replace function public.release_rejected_affiliate_code()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'rejected' and old.status <> 'rejected' and new.affiliate_code_id is not null then
    update public.affiliate_codes set used_count = greatest(used_count - 1, 0)
      where id = new.affiliate_code_id;
  end if;
  return new;
end;
$$;
create trigger release_rejected_affiliate_code_after_update
after update of status on public.commerce_registration_requests
for each row when (old.status is distinct from new.status and new.status = 'rejected')
execute function public.release_rejected_affiliate_code();
