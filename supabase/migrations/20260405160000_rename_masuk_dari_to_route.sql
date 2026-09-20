-- Rename visa port-of-entry field from Masuk Dari to Route.

alter table public.visas rename column masuk_dari to route;
