-- pg_cron was not enabled when 20260405190000 ran, so its schedule call was
-- swallowed by that migration's exception handler. Enable the extension before
-- applying this one; a missing cron schema should fail loudly here.

-- 16:10 UTC is 00:10 the next day in Kuala Lumpur. Rescheduling by the same job
-- name replaces any previous entry.
select cron.schedule(
  'finish-due-visas',
  '10 16 * * *',
  'select public.finish_due_visas();'
);
