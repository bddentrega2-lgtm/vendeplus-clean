-- Remove the mistakenly deployed Entrega2 Control pilot schema from Somos.
-- These tables were verified empty before this migration was applied.
drop table if exists public.transport_control_driver_settlements;
drop table if exists public.transport_control_ally_settlements;
drop table if exists public.transport_control_weeks;
drop table if exists public.transport_control_services;
drop table if exists public.transport_control_imports;
drop table if exists public.transport_control_driver_rates;
drop table if exists public.transport_control_allies;
