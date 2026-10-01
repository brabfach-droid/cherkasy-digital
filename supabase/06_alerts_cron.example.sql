-- OPTIONAL: run after deploying the alerts Edge Function and creating Vault secrets.
-- Before running: in Supabase Vault create secrets named portal_supabase_url and portal_alerts_sync_secret.
-- portal_supabase_url: https://YOUR_PROJECT.supabase.co
-- portal_alerts_sync_secret: the SAME random value as Edge Function ALERTS_SYNC_SECRET.
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- No token is embedded in a frontend file or a cron SQL literal.
select cron.unschedule(jobid) from cron.job where jobname='portal-alerts-sync';
select cron.schedule('portal-alerts-sync','* * * * *',$job$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='portal_supabase_url')||'/functions/v1/alerts',
  headers := jsonb_build_object('Content-Type','application/json','x-sync-secret',(select decrypted_secret from vault.decrypted_secrets where name='portal_alerts_sync_secret')),
  body := '{}'::jsonb,
  timeout_milliseconds := 15000
 );
$job$);
