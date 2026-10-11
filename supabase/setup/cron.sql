-- Run ONLY after the target project and setup batch have been approved.
-- Store via Dashboard Vault (never put literal secrets in migrations):
-- quickdrop_cleanup_url = https://PROJECT_REF.supabase.co/functions/v1/cleanup-transfers
-- quickdrop_cleanup_secret = the worker's dedicated CLEANUP_SECRET
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists(select 1 from vault.decrypted_secrets where name='quickdrop_cleanup_url')
    or not exists(select 1 from vault.decrypted_secrets where name='quickdrop_cleanup_secret') then
    raise exception 'Set the two QuickDrop Vault secrets first';
  end if;
  if exists(select 1 from cron.job where jobname='quickdrop-cleanup-transfers') then
    raise exception 'Job exists: inspect its schedule/command before changing it';
  end if;
end $$;

select cron.schedule('quickdrop-cleanup-transfers','*/5 * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='quickdrop_cleanup_url'),
    headers := jsonb_build_object('Content-Type','application/json','x-cleanup-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='quickdrop_cleanup_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 60000
  );
$job$);

-- Run a first authenticated worker request, then verify heartbeat before uploads.
-- pg_net response table may retain sensitive response metadata: use short retention.
