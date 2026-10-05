create or replace function public.adjust_affiliate_commission_for_fee_refund(
  p_commission_id uuid, p_fee_refund_usd numeric, p_reference text, p_actor uuid
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_commission public.affiliate_commissions%rowtype;
declare v_prior_fee numeric(10,2);
declare v_prior_commission numeric(10,2);
declare v_adjustment numeric(10,2);
declare v_key text;
declare v_id uuid;
begin
  if p_fee_refund_usd <= 0 or p_reference is null or trim(p_reference) = '' or p_actor is null then
    raise exception 'Ajuste invalido';
  end if;
  select * into v_commission from public.affiliate_commissions where id = p_commission_id for update;
  if not found then raise exception 'Comision no encontrada'; end if;
  v_key := 'fee-refund:' || p_commission_id::text || ':' || trim(p_reference);
  select id into v_id from public.affiliate_commission_adjustments where source_key = v_key;
  if found then return v_id; end if;
  select coalesce(sum(-amount_usd), 0) into v_prior_commission
    from public.affiliate_commission_adjustments where commission_id = p_commission_id;
  v_prior_fee := round(v_prior_commission * 100 / v_commission.commission_percent, 2);
  if p_fee_refund_usd > v_commission.fee_usd - v_prior_fee then raise exception 'El reintegro supera el fee restante'; end if;
  v_adjustment := least(round(p_fee_refund_usd * v_commission.commission_percent / 100, 2),
    v_commission.amount_usd - v_prior_commission);
  if v_adjustment <= 0 then raise exception 'No queda comision por ajustar'; end if;
  insert into public.affiliate_commission_adjustments(commission_id, amount_usd, reason, source_key, created_by)
    values (p_commission_id, -v_adjustment, 'Fee reintegrado: ' || trim(p_reference), v_key, p_actor)
    returning id into v_id;
  if v_commission.status = 'available' and v_commission.amount_usd - v_prior_commission - v_adjustment <= 0 then
    update public.affiliate_commissions set status = 'reversed' where id = p_commission_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.adjust_affiliate_commission_for_fee_refund(uuid, numeric, text, uuid) from public, anon, authenticated;
grant execute on function public.adjust_affiliate_commission_for_fee_refund(uuid, numeric, text, uuid) to service_role;
